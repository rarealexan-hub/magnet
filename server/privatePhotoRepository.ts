import type { Pool } from "pg";
import type { AuditPhoto, PhotoCleanupRetryRepository, PrivatePhotoRepository } from "./privatePhotoLifecycle.js";

/** PostgreSQL boundary for private-photo metadata. All callers use this adapter,
 * keeping photo lifecycle SQL deterministic and preventing accidental payload
 * persistence in route code. */
export class PostgresPrivatePhotoRepository implements PrivatePhotoRepository, PhotoCleanupRetryRepository {
  constructor(private readonly db: Pick<Pool, "query">) {}

  async findAudit(id: string): Promise<any | null> {
    const result = await this.db.query("SELECT * FROM human_audits WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async setPhotoMetadata(id: string | number, photos: AuditPhoto[]): Promise<void> {
    const result = await this.db.query(
      "UPDATE human_audits SET photo_keys = $1::jsonb, updated_at = $2 WHERE id = $3",
      [JSON.stringify(photos), new Date(), id],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Audit record ${id} was not found while saving photo metadata`);
    }
  }

  async clearPhotos(id: string): Promise<void> {
    await this.db.query(
      "UPDATE human_audits SET photo_keys = '[]'::jsonb, photos_deleted_at = $1, updated_at = $1 WHERE id = $2",
      [new Date(), id],
    );
  }

  async listExpiredPhotos(releasedDays: number, unreleasedDays: number, now: Date): Promise<any[]> {
    const result = await this.db.query(
      `SELECT id, photo_keys FROM human_audits
       WHERE photos_deleted_at IS NULL AND photo_keys <> '[]'::jsonb
         AND ((final_report_ready_at IS NOT NULL
               AND final_report_ready_at <= $3::timestamptz - ($1 || ' days')::interval)
           OR (final_report_ready_at IS NULL
               AND created_at <= $3::timestamptz - ($2 || ' days')::interval))`,
      [releasedDays, unreleasedDays, now],
    );
    return result.rows;
  }

  async enqueuePhotoCleanup(keys: string[]): Promise<void> {
    const uniqueKeys = [...new Set(keys)];
    if (!uniqueKeys.length) return;
    const values = uniqueKeys.map((_, index) => `($${index + 1})`).join(", ");
    await this.db.query(
      `INSERT INTO private_photo_cleanup_queue (object_key)
       VALUES ${values}
       ON CONFLICT (object_key) DO NOTHING`,
      uniqueKeys,
    );
  }

  async listPhotoCleanupRetries(limit: number, now: Date): Promise<Array<{ key: string }>> {
    const result = await this.db.query(
      `SELECT object_key AS key FROM private_photo_cleanup_queue
       WHERE next_attempt_at <= $1
       ORDER BY next_attempt_at, created_at
       LIMIT $2`,
      [now, limit],
    );
    return result.rows;
  }

  async completePhotoCleanup(key: string): Promise<void> {
    await this.db.query("DELETE FROM private_photo_cleanup_queue WHERE object_key = $1", [key]);
  }

  async deferPhotoCleanup(key: string, nextAttemptAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE private_photo_cleanup_queue
       SET attempt_count = attempt_count + 1, next_attempt_at = $1, last_attempt_at = NOW()
       WHERE object_key = $2`,
      [nextAttemptAt, key],
    );
  }
}