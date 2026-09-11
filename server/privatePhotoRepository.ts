import type { Pool } from "pg";
import type { AuditPhoto, PrivatePhotoRepository } from "./privatePhotoLifecycle.js";

/** PostgreSQL boundary for private-photo metadata. All callers use this adapter,
 * keeping photo lifecycle SQL deterministic and preventing accidental payload
 * persistence in route code. */
export class PostgresPrivatePhotoRepository implements PrivatePhotoRepository {
  constructor(private readonly db: Pick<Pool, "query">) {}

  async findAudit(id: string): Promise<any | null> {
    const result = await this.db.query("SELECT * FROM human_audits WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async setPhotoMetadata(id: string | number, photos: AuditPhoto[]): Promise<void> {
    await this.db.query(
      "UPDATE human_audits SET photo_keys = $1::jsonb, updated_at = $2 WHERE id = $3",
      [JSON.stringify(photos), new Date(), id],
    );
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
}