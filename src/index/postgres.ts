import postgres from 'postgres'
import type { IndexRow, IndexStore } from './types.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS objects (
  key TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_ids JSONB NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT,
  sha256 TEXT NOT NULL,
  chunked BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_objects_key_prefix ON objects(key);
`

interface DbRow {
  key: string
  chat_id: string
  message_ids: number[]
  size: string
  mime_type: string | null
  sha256: string
  chunked: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

function rowToIndexRow(row: DbRow): IndexRow {
  return {
    key: row.key,
    chatId: row.chat_id,
    messageIds: row.message_ids,
    size: Number(row.size),
    mimeType: row.mime_type ?? '',
    sha256: row.sha256,
    chunked: row.chunked,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  }
}

export class PostgresIndexStore implements IndexStore {
  private sql: postgres.Sql
  private ready: Promise<void>

  constructor(connectionString: string) {
    this.sql = postgres(connectionString)
    this.ready = this.sql.unsafe(SCHEMA).then(() => undefined)
  }

  private async db() {
    await this.ready
    return this.sql
  }

  async put(row: IndexRow): Promise<void> {
    const sql = await this.db()
    await sql`
      INSERT INTO objects (key, chat_id, message_ids, size, mime_type, sha256, chunked, metadata, created_at)
      VALUES (${row.key}, ${row.chatId}, ${sql.json(row.messageIds)}, ${row.size}, ${row.mimeType}, ${row.sha256}, ${row.chunked}, ${row.metadata ? sql.json(row.metadata as postgres.JSONValue) : null}, ${row.createdAt})
      ON CONFLICT (key) DO UPDATE SET
        chat_id = excluded.chat_id,
        message_ids = excluded.message_ids,
        size = excluded.size,
        mime_type = excluded.mime_type,
        sha256 = excluded.sha256,
        chunked = excluded.chunked,
        metadata = excluded.metadata,
        created_at = excluded.created_at
    `
  }

  async get(key: string): Promise<IndexRow | null> {
    const sql = await this.db()
    const rows = await sql<DbRow[]>`SELECT * FROM objects WHERE key = ${key}`
    return rows[0] ? rowToIndexRow(rows[0]) : null
  }

  async delete(key: string): Promise<void> {
    const sql = await this.db()
    await sql`DELETE FROM objects WHERE key = ${key}`
  }

  async list(prefix = ''): Promise<IndexRow[]> {
    const sql = await this.db()
    const rows = await sql<DbRow[]>`SELECT * FROM objects WHERE key LIKE ${prefix + '%'} ORDER BY key`
    return rows.map(rowToIndexRow)
  }

  close(): void {
    void this.sql.end()
  }
}
