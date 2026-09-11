import crypto from "crypto";
import express, { type Request, type Response, type Router } from "express";

export interface AuditPhoto {
  key: string;
  mimeType: string;
  label?: string;
  kind: string;
  index: number;
}

export interface PrivatePhotoStorage {
  uploadFromBytes(key: string, bytes: Buffer, options?: { compress?: boolean }): Promise<{ ok: boolean; error?: unknown }>;
  delete(key: string, options?: { ignoreNotFound?: boolean }): Promise<{ ok: boolean; error?: { message?: string } }>;
}

export interface PhotoCleanupRetryRepository {
  enqueuePhotoCleanup(keys: string[]): Promise<void>;
  listPhotoCleanupRetries(limit: number, now: Date): Promise<Array<{ key: string }>>;
  completePhotoCleanup(key: string): Promise<void>;
  deferPhotoCleanup(key: string, nextAttemptAt: Date): Promise<void>;
}
export interface PrivatePhotoFile {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}

export function auditReportPhotos(auditId: string | number, photos: AuditPhoto[] = [], deleted = false) {
  const grouped: Record<string, unknown[]> = { screenshots: [], currentPhotos: [], additionalPhotos: [] };
  for (const photo of photos) {
    const kind = photo.kind === "screenshots" ? "screenshots" : photo.kind;
    const group = kind === "screenshots" ? "screenshots" : kind === "current" ? "currentPhotos" : "additionalPhotos";
    grouped[group].push({
      endpoint: `/api/audits/${auditId}/photos/${kind}/${photo.index}`,
      label: photo.label || null,
      mimeType: photo.mimeType,
      kind,
      index: photo.index,
    });
  }
  return { ...grouped, deleted };
}

/** The single response projection used by audit endpoints. */
export function mapAuditReportPhotos(row: {
  id: string | number;
  photo_keys?: AuditPhoto[] | null;
  photos_deleted_at?: unknown;
}) {
  return auditReportPhotos(row.id, row.photo_keys || [], !!row.photos_deleted_at);
}

export async function deleteAuditObjects(storage: PrivatePhotoStorage, keys: string[], bestEffort = false): Promise<string[]> {
  const failedKeys: string[] = [];
  await Promise.all(keys.map(async (key) => {
    try {
      const result = await storage.delete(key, { ignoreNotFound: true });
      if (!result.ok) throw new Error(result.error?.message || "Object storage deletion failed");
    } catch (error) {
      if (!bestEffort) throw error;
      failedKeys.push(key);
    }
  }));
  return failedKeys;
}

async function rollbackAuditObjects(
  storage: PrivatePhotoStorage,
  keys: string[],
  cleanupRetries?: Pick<PhotoCleanupRetryRepository, "enqueuePhotoCleanup">,
): Promise<void> {
  const failedKeys = await deleteAuditObjects(storage, keys, true);
  if (failedKeys.length && cleanupRetries) {
    try {
      await cleanupRetries.enqueuePhotoCleanup(failedKeys);
    } catch (error) {
      console.error("Failed to queue audit photo cleanup retries:", failedKeys, error);
    }
  }
}
/** Delete objects before committing metadata. A failed object deletion deliberately
 * leaves the database record untouched so a later retry can recover the photos. */
export async function deleteAuditPhotos(
  storage: PrivatePhotoStorage,
  photos: AuditPhoto[],
  markDeleted: () => Promise<void>,
): Promise<void> {
  await deleteAuditObjects(storage, photos.map((photo) => photo.key));
  await markDeleted();
}

export async function uploadAuditPhotos(
  storage: PrivatePhotoStorage,
  auditId: string | number,
  groups: Array<{ kind: string; files: PrivatePhotoFile[]; labels?: string[] }>,
  convertHeic: (buffer: Buffer) => Promise<Buffer>,
  cleanupRetries?: Pick<PhotoCleanupRetryRepository, "enqueuePhotoCleanup">,
): Promise<AuditPhoto[]> {
  const uploaded: AuditPhoto[] = [];
  try {
    for (const group of groups) {
      for (let index = 0; index < group.files.length; index++) {
        const file = group.files[index];
        const isHeic = /image\/hei[cf]/i.test(file.mimetype || "") || /\.hei[cf]$/i.test(file.originalname || "");
        const bytes = isHeic ? await convertHeic(file.buffer) : file.buffer;
        const photo: AuditPhoto = {
          key: `audits/${auditId}/${group.kind}/${index}`,
          mimeType: isHeic ? "image/jpeg" : (file.mimetype || "application/octet-stream"),
          ...(group.labels?.[index] ? { label: group.labels[index] } : {}),
          kind: group.kind,
          index,
        };
        const result = await storage.uploadFromBytes(photo.key, bytes, { compress: false });
        if (!result.ok) throw new Error(`Object storage upload failed: ${String(result.error)}`);
        uploaded.push(photo);
      }
    }
    return uploaded;
  } catch (error) {
    await rollbackAuditObjects(storage, uploaded.map((photo) => photo.key), cleanupRetries);
    throw error;
  }
}

export async function uploadAndPersistAuditPhotos(
  storage: PrivatePhotoStorage,
  repository: Pick<PrivatePhotoRepository, "setPhotoMetadata">,
  auditId: string | number,
  groups: Array<{ kind: string; files: PrivatePhotoFile[]; labels?: string[] }>,
  convertHeic: (buffer: Buffer) => Promise<Buffer>,
  cleanupRetries?: Pick<PhotoCleanupRetryRepository, "enqueuePhotoCleanup">,
): Promise<AuditPhoto[]> {
  const photos = await uploadAuditPhotos(storage, auditId, groups, convertHeic, cleanupRetries);
  try {
    await persistPhotoMetadata(repository, auditId, photos);
    return photos;
  } catch (error) {
    await rollbackAuditObjects(storage, photos.map((photo) => photo.key), cleanupRetries);
    throw error;
  }
}

export async function processPhotoCleanupRetries(
  repository: PhotoCleanupRetryRepository,
  storage: PrivatePhotoStorage,
  options: { limit?: number; now?: Date; retryDelayMs?: number } = {},
): Promise<void> {
  const now = options.now || new Date();
  const rows = await repository.listPhotoCleanupRetries(options.limit || 100, now);
  for (const row of rows) {
    try {
      await deleteAuditObjects(storage, [row.key]);
      await repository.completePhotoCleanup(row.key);
    } catch (error) {
      await repository.deferPhotoCleanup(
        row.key,
        new Date(now.getTime() + (options.retryDelayMs || 15 * 60 * 1000)),
      );
      console.error("Audit photo cleanup retry failed:", row.key, error);
    }
  }
}
export function newPollingCapabilityId(): string {
  return newPollingCapabilityIdFrom((size) => crypto.randomBytes(size));
}

export function newPollingCapabilityIdFrom(randomBytes: (size: number) => Buffer): string {
  return randomBytes(32).toString("hex");
}

export function canReadPrivatePhoto(input: {
  accessToken?: string;
  providedToken?: string;
  ownerEmail?: string;
  authenticatedEmail?: string;
  authenticatedEmailVerified?: boolean;
  adminEmails?: Iterable<string>;
  adminKey?: string;
  providedAdminKey?: string;
}): boolean {
  if (input.providedToken && input.accessToken && input.providedToken === input.accessToken) return true;
  if (input.authenticatedEmailVerified && input.ownerEmail && input.authenticatedEmail &&
      input.ownerEmail.toLowerCase() === input.authenticatedEmail.toLowerCase()) return true;
  const admins = new Set(Array.from(input.adminEmails || [], (email) => email.toLowerCase()));
  if (!input.authenticatedEmail || !admins.has(input.authenticatedEmail.toLowerCase())) return false;
  if (!input.adminKey || !input.providedAdminKey) return false;
  const configured = Buffer.from(input.adminKey);
  const provided = Buffer.from(input.providedAdminKey);
  return configured.length === provided.length && crypto.timingSafeEqual(configured, provided);
}

export interface PrivatePhotoRepository {
  findAudit(id: string): Promise<any | null>;
  setPhotoMetadata?(id: string | number, photos: AuditPhoto[]): Promise<void>;
  clearPhotos(id: string): Promise<void>;
  listExpiredPhotos(releasedDays: number, unreleasedDays: number, now: Date): Promise<any[]>;
}

export async function persistPhotoMetadata(
  repository: Pick<PrivatePhotoRepository, "setPhotoMetadata">,
  auditId: string | number,
  photos: AuditPhoto[],
): Promise<void> {
  if (!repository.setPhotoMetadata) throw new Error("Photo metadata repository is not configured");
  await repository.setPhotoMetadata(auditId, photos);
}

export async function processExpiredAuditPhotos(
  repository: PrivatePhotoRepository,
  storage: PrivatePhotoStorage,
  options: { releasedDays: number; unreleasedDays: number; now?: Date },
) {
  const rows = await repository.listExpiredPhotos(options.releasedDays, options.unreleasedDays, options.now || new Date());
  for (const row of rows) {
    try {
      await deleteAuditPhotos(storage, row.photo_keys || [], () => repository.clearPhotos(String(row.id)));
    } catch (error) {
      console.error("Audit photo retention deletion failed:", row.id, error);
    }
  }
}

export function createPrivatePhotoRouter(deps: {
  repository: Pick<PrivatePhotoRepository, "findAudit">;
  storage: { downloadAsStream(key: string): NodeJS.ReadableStream };
  identify?: (req: Request) => Promise<{ email?: string; emailVerified?: boolean } | undefined> | { email?: string; emailVerified?: boolean } | undefined;
  adminEmails?: Iterable<string>;
  adminKey?: string;
}): Router {
  const router = express.Router();
  router.get("/api/audits/:auditId/photos/:kind/:index", async (req: Request, res: Response) => {
    try {
      const audit = await deps.repository.findAudit(String(req.params.auditId));
      if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }
      const identity = await deps.identify?.(req);
      if (!canReadPrivatePhoto({
        accessToken: audit.access_token,
        providedToken: typeof req.query.token === "string" ? req.query.token : "",
        ownerEmail: String(audit.email),
        authenticatedEmail: identity?.email,
        authenticatedEmailVerified: identity?.emailVerified,
        adminEmails: deps.adminEmails,
        adminKey: deps.adminKey,
        providedAdminKey: req.get("x-admin-key"),
      })) { res.status(403).json({ error: "Not authorized" }); return; }
      const photo = (audit.photo_keys || []).find((item: AuditPhoto) =>
        item.kind === req.params.kind && item.index === Number(req.params.index));
      if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }
      const stream = deps.storage.downloadAsStream(photo.key);
      res.setHeader("Content-Type", photo.mimeType);
      res.setHeader("Cache-Control", "private, no-store");
      stream.on("error", () => { if (!res.headersSent) res.status(404).json({ error: "Photo unavailable" }); else res.destroy(); });
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: "Failed to load photo" });
    }
  });
  return router;
}

export function retentionCutoff(
  released: boolean,
  releasedDays = 30,
  unreleasedDays = 60,
  now = new Date(),
): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - (released ? releasedDays : unreleasedDays));
  return cutoff;
}
