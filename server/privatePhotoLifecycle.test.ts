import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { Readable } from "node:stream";
import { newDb } from "pg-mem";
import {
  auditReportPhotos,
  canReadPrivatePhoto,
  deleteAuditPhotos,
  newPollingCapabilityId,
  newPollingCapabilityIdFrom,
  processExpiredAuditPhotos,
  persistPhotoMetadata,
  mapAuditReportPhotos,
  retentionCutoff,
  uploadAndPersistAuditPhotos,
  uploadAuditPhotos,
  createPrivatePhotoRouter,
  type AuditPhoto,
  type PrivatePhotoStorage,
} from "./privatePhotoLifecycle.js";
import { PostgresPrivatePhotoRepository } from "./privatePhotoRepository.js";

class MemoryStorage implements PrivatePhotoStorage {
  objects = new Map<string, Buffer>();
  failDelete = false;
  failUploadAt = 0;
  uploadCount = 0;
  async uploadFromBytes(key: string, bytes: Buffer) {
    this.uploadCount++;
    if (this.failUploadAt === this.uploadCount) return { ok: false, error: new Error("offline") };
    this.objects.set(key, Buffer.from(bytes));
    return { ok: true };
  }
  async delete(key: string) {
    if (this.failDelete) return { ok: false, error: { message: "offline" } };
    this.objects.delete(key);
    return { ok: true };
  }
}

const file = (name: string, bytes: string) => ({
  originalname: name,
  mimetype: "image/png",
  buffer: Buffer.from(bytes),
});

test("production upload helper stores all photo groups at exact private keys", async () => {
  const storage = new MemoryStorage();
  const photos = await uploadAuditPhotos(storage, 42, [
    { kind: "screenshots", files: [file("screen.png", "s")] },
    { kind: "current", files: [file("one.png", "c1"), file("two.png", "c2")] },
    { kind: "additional", files: [file("extra.png", "a")], labels: ["Trip"] },
  ], async (bytes) => bytes);
  assert.deepEqual([...storage.objects.keys()], [
    "audits/42/screenshots/0",
    "audits/42/current/0",
    "audits/42/current/1",
    "audits/42/additional/0",
  ]);
  assert.equal(photos[3].label, "Trip");
  const metadata = auditReportPhotos(42, photos);
  assert.equal(JSON.stringify(metadata).includes("cz"), false);
  assert.equal(JSON.stringify(metadata).includes("YzE="), false);
  assert.deepEqual(Object.keys((metadata as unknown as { currentPhotos: object[] }).currentPhotos[0]).sort(), ["endpoint", "index", "kind", "label", "mimeType"]);
});

test("a later object upload failure removes earlier private objects and exposes no endpoints", async () => {
  const storage = new MemoryStorage();
  storage.failUploadAt = 2;
  let response: ReturnType<typeof auditReportPhotos> | undefined;

  await assert.rejects(async () => {
    const photos = await uploadAndPersistAuditPhotos(storage, {
      setPhotoMetadata: async () => assert.fail("metadata must not be persisted after upload failure"),
    }, 43, [
      { kind: "current", files: [file("one.png", "first"), file("two.png", "second")] },
    ], async (bytes) => bytes);
    response = auditReportPhotos(43, photos);
  }, /Object storage upload failed/);

  assert.equal(storage.uploadCount, 2);
  assert.equal(storage.objects.size, 0);
  assert.equal(response, undefined);
});

test("photo metadata persistence failure removes every uploaded object and exposes no endpoints", async () => {
  const storage = new MemoryStorage();
  let response: ReturnType<typeof auditReportPhotos> | undefined;

  await assert.rejects(async () => {
    const photos = await uploadAndPersistAuditPhotos(storage, {
      setPhotoMetadata: async () => { throw new Error("PostgreSQL unavailable"); },
    }, 44, [
      { kind: "screenshots", files: [file("screen.png", "screen")] },
      { kind: "current", files: [file("one.png", "first"), file("two.png", "second")] },
    ], async (bytes) => bytes);
    response = auditReportPhotos(44, photos);
  }, /PostgreSQL unavailable/);

  assert.equal(storage.uploadCount, 3);
  assert.equal(storage.objects.size, 0);
  assert.equal(response, undefined);
});

test("photo metadata persistence stores references only, never image bytes", async () => {
  let record: any = { intake_data: { screenshotCount: 1 }, client_brief: { score: { overall: 80 } } };
  const photos: AuditPhoto[] = [{ key: "audits/5/current/0", kind: "current", index: 0, mimeType: "image/png" }];
  await persistPhotoMetadata({
    setPhotoMetadata: async (_id, references) => { record.photo_keys = references; },
  }, 5, photos);
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes("base64"), false);
  assert.equal(serialized.includes("private-image"), false);
  assert.deepEqual(record.photo_keys, photos);
});

test("Postgres private-photo adapter persists metadata and selects deterministic retention rows", async () => {
  const db = newDb();
  const pg = db.adapters.createPg();
  const pool = new pg.Pool();
  await pool.query(`CREATE TABLE human_audits (
    id bigint primary key, email text, access_token text, photo_keys jsonb not null default '[]',
    intake_data jsonb not null default '{}', client_brief jsonb not null default '{}',
    final_report_ready_at timestamptz, created_at timestamptz not null,
    photos_deleted_at timestamptz, updated_at timestamptz
  )`);
  const now = new Date("2025-01-31T00:00:00Z");
  const raw = "data:image/png;base64,SECRET_IMAGE_BYTES";
  await pool.query(
    `INSERT INTO human_audits (id,email,access_token,photo_keys,intake_data,client_brief,final_report_ready_at,created_at)
     VALUES (1,'a@x.test','tok','[]',$1,$2,$3,$4),
            (2,'b@x.test','tok2','[]','{}','{}',NULL,$4),
            (3,'c@x.test','tok3','[]','{}','{}',$5,$4),
            (4,'d@x.test','tok4','[]','{}','{}',NULL,$6),
            (5,'e@x.test','tok5','[]','{}','{}',NULL,$7),
            (6,'f@x.test','tok6','[]','{}','{}',NULL,$4)`,
    [JSON.stringify({ screenshotCount: 1 }), JSON.stringify({ report: "kept" }), new Date("2025-01-01"), new Date("2024-12-01"), new Date("2025-01-15"), new Date("2024-01-01"), new Date("2025-01-15")],
  );
  const repository = new PostgresPrivatePhotoRepository(pool);
  const storage = new MemoryStorage();
  const sentinel = "RAW_SENTINEL_SCREENSHOT_BASE64";
  const uploaded = await uploadAuditPhotos(storage, 1, [
    { kind: "screenshots", files: [file("screen.png", sentinel)] },
    { kind: "current", files: [file("current.png", "RAW_CURRENT_MARKER")] },
    { kind: "additional", files: [file("additional.png", "RAW_ADDITIONAL_MARKER")] },
  ], async (bytes) => bytes);
  await persistPhotoMetadata(repository, 1, uploaded);
  const row = await repository.findAudit("1");
  assert.deepEqual(row.photo_keys, [
    { key: "audits/1/screenshots/0", mimeType: "image/png", kind: "screenshots", index: 0 },
    { key: "audits/1/current/0", mimeType: "image/png", kind: "current", index: 0 },
    { key: "audits/1/additional/0", mimeType: "image/png", kind: "additional", index: 0 },
  ]);
  const persisted = JSON.stringify(row);
  assert.equal(persisted.includes(sentinel), false);
  assert.equal(persisted.includes("RAW_CURRENT_MARKER"), false);
  assert.equal(persisted.includes("RAW_ADDITIONAL_MARKER"), false);
  assert.equal(persisted.includes("base64"), false);
  assert.equal(JSON.stringify(row.intake_data).includes(raw), false);
  assert.equal(JSON.stringify(row.client_brief).includes(raw), false);
  await pool.query("UPDATE human_audits SET photo_keys = $1::jsonb WHERE id IN (2,3,4,5,6)", [JSON.stringify(uploaded)]);
  await pool.query("UPDATE human_audits SET photos_deleted_at = $1 WHERE id = 6", [now]);
  const eligible = await repository.listExpiredPhotos(30, 60, now);
  assert.deepEqual(eligible.map((item: any) => Number(item.id)).sort(), [1, 2, 4]);
  await repository.clearPhotos("1");
  const cleared = await repository.findAudit("1");
  assert.deepEqual(cleared.photo_keys, []);
  assert.ok(cleared.photos_deleted_at);
  assert.deepEqual(mapAuditReportPhotos(cleared), {
    screenshots: [], currentPhotos: [], additionalPhotos: [], deleted: true,
  });
});

test("private photo authorization allows token, owner, and valid admin only", () => {
  const base = { accessToken: "token", ownerEmail: "owner@example.com", adminEmails: ["admin@example.com"], adminKey: "secret" };
  assert.equal(canReadPrivatePhoto({ ...base, providedToken: "token" }), true);
  assert.equal(canReadPrivatePhoto({ ...base, authenticatedEmail: "owner@example.com" }), true);
  assert.equal(canReadPrivatePhoto({ ...base, authenticatedEmail: "admin@example.com", providedAdminKey: "secret" }), true);
  assert.equal(canReadPrivatePhoto({ ...base }), false);
  assert.equal(canReadPrivatePhoto({ ...base, providedToken: "bad" }), false);
  assert.equal(canReadPrivatePhoto({ ...base, authenticatedEmail: "admin@example.com", providedAdminKey: "wrong" }), false);
  assert.equal(canReadPrivatePhoto({ ...base, adminKey: "sécret", providedAdminKey: "secret" }), false);
});

test("production photo router serves bytes only to authorized identities", async () => {
  const app = express();
  const bytes = Buffer.from("private-image");
  const audit = { email: "owner@example.com", access_token: "audit-token", photo_keys: [{ key: "audits/7/current/0", kind: "current", index: 0, mimeType: "image/png" }] };
  app.use(createPrivatePhotoRouter({
    repository: { findAudit: async () => audit },
    storage: { downloadAsStream: () => Readable.from(bytes) },
    identify: (req) => req.headers.authorization === "Bearer owner-jwt" ? { email: "owner@example.com" } : req.headers.authorization === "Bearer admin-jwt" ? { email: "admin@example.com" } : undefined,
    adminEmails: ["admin@example.com"],
    adminKey: "admin-secret",
  }));
  const server = await new Promise<http.Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const port = (server.address() as { port: number }).port;
  const request = (headers: Record<string, string> = {}, token = "") => new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve) => {
    const req = http.request({ port, path: `/api/audits/7/photos/current/0${token ? `?token=${token}` : ""}`, headers }, (res) => {
      const chunks: Buffer[] = []; res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
    }); req.end();
  });
  assert.equal((await request()).status, 403);
  for (const headers of [
    { authorization: "Bearer owner-jwt" },
    { authorization: "Bearer admin-jwt", "x-admin-key": "admin-secret" },
    {},
  ] as Record<string, string>[]) {
    const response = await request(headers, headers.authorization ? "" : "audit-token");
    assert.deepEqual(response.body, bytes);
    assert.equal(response.headers["cache-control"], "private, no-store");
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("manual deletion does not clear metadata when storage deletion fails", async () => {
  const storage = new MemoryStorage();
  const photos: AuditPhoto[] = [{ key: "audits/1/current/0", kind: "current", index: 0, mimeType: "image/png" }];
  let metadataDeleted = false;
  storage.failDelete = true;
  await assert.rejects(deleteAuditPhotos(storage, photos, async () => { metadataDeleted = true; }));
  assert.equal(metadataDeleted, false);
});

test("manual deletion clears metadata only after all objects are deleted", async () => {
  const storage = new MemoryStorage();
  const photos: AuditPhoto[] = [{ key: "audits/1/screenshots/0", kind: "screenshots", index: 0, mimeType: "image/png" }];
  storage.objects.set(photos[0].key, Buffer.from("image"));
  let metadata: AuditPhoto[] | null = photos;
  await deleteAuditPhotos(storage, photos, async () => { metadata = []; });
  assert.deepEqual(metadata, []);
  assert.equal(storage.objects.size, 0);
});

test("retention cutoffs distinguish released and unreleased audits", () => {
  const now = new Date("2025-01-31T00:00:00Z");
  assert.equal(retentionCutoff(true, 30, 60, now).toISOString(), "2025-01-01T00:00:00.000Z");
  assert.equal(retentionCutoff(false, 30, 60, now).toISOString(), "2024-12-02T00:00:00.000Z");
});

test("retention orchestration deletes eligible rows, clears successful metadata, and preserves failures", async () => {
  const storage = new MemoryStorage();
  storage.objects.set("released", Buffer.from("r"));
  storage.objects.set("unreleased", Buffer.from("u"));
  storage.objects.set("retry", Buffer.from("x"));
  const rows = [
    { id: 1, photo_keys: [{ key: "released", kind: "current", index: 0, mimeType: "image/png" }] },
    { id: 2, photo_keys: [{ key: "unreleased", kind: "current", index: 0, mimeType: "image/png" }] },
    { id: 3, photo_keys: [{ key: "retry", kind: "current", index: 0, mimeType: "image/png" }] },
  ];
  const cleared: string[] = [];
  storage.failDelete = false;
  await processExpiredAuditPhotos({
    findAudit: async () => null,
    listExpiredPhotos: async () => rows.slice(0, 2),
    clearPhotos: async (id) => { cleared.push(id); },
  }, storage, { releasedDays: 30, unreleasedDays: 60 });
  assert.deepEqual(cleared.sort(), ["1", "2"]);
  assert.equal(storage.objects.has("released"), false);
  storage.failDelete = true;
  await processExpiredAuditPhotos({
    findAudit: async () => null,
    listExpiredPhotos: async () => rows.slice(2),
    clearPhotos: async (id) => { cleared.push(id); },
  }, storage, { releasedDays: 30, unreleasedDays: 60 });
  assert.equal(cleared.includes("3"), false);
  assert.equal(storage.objects.has("retry"), true);
});

test("removed photo metadata is represented as a deleted placeholder state", () => {
  const result = auditReportPhotos(9, [], true);
  assert.deepEqual(result, { screenshots: [], currentPhotos: [], additionalPhotos: [], deleted: true });
});

test("polling capability ids are 32 random bytes, hexadecimal, and non-sequential", () => {
  const ids = Array.from({ length: 200 }, () => newPollingCapabilityId());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[0-9a-f]{64}$/.test(id)));
  assert.ok(ids.some((id, i) => i > 0 && id !== ids[i - 1]));
  assert.ok(ids.some((id) => !/^0+$/.test(id)));
});

test("polling capability source requests exactly 32 cryptographic bytes", () => {
  let requested = 0;
  const id = newPollingCapabilityIdFrom((size) => {
    requested = size;
    return Buffer.alloc(size, 7);
  });
  assert.equal(requested, 32);
  assert.equal(id.length, 64);
});