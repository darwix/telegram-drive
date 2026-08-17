import Database from 'better-sqlite3'
import type { IndexRow, IndexStore } from './types.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS objects (
  key TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_ids TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT,
  sha256 TEXT NOT NULL,
  chunked INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_objects_key_prefix ON objects(key);
`

interface DbRow {
  key: string
  chat_id: string
  message_ids: string
  size: number
  mime_type: string | null
  sha256: string
  chunked: number
  metadata: string | null
  created_at: string
}

function rowToIndexRow(row: DbRow): IndexRow {
  return {
    key: row.key,
    chatId: row.chat_id,
    messageIds: JSON.parse(row.message_ids),
    size: row.size,
    mimeType: row.mime_type ?? '',
    sha256: row.sha256,
    chunked: row.chunked === 1,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  }
}

export class SqliteIndexStore implements IndexStore {
  private db: Database.Database

  constructor(path: string) {
    this.db = new Database(path)
    this.db.exec(SCHEMA)
  }

  async put(row: IndexRow): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO objects (key, chat_id, message_ids, size, mime_type, sha256, chunked, metadata, created_at)
         VALUES (@key, @chatId, @messageIds, @size, @mimeType, @sha256, @chunked, @metadata, @createdAt)
         ON CONFLICT(key) DO UPDATE SET
           chat_id = excluded.chat_id,
           message_ids = excluded.message_ids,
           size = excluded.size,
           mime_type = excluded.mime_type,
           sha256 = excluded.sha256,
           chunked = excluded.chunked,
           metadata = excluded.metadata,
           created_at = excluded.created_at`
      )
      .run({
        key: row.key,
        chatId: row.chatId,
        messageIds: JSON.stringify(row.messageIds),
        size: row.size,
        mimeType: row.mimeType,
        sha256: row.sha256,
        chunked: row.chunked ? 1 : 0,
        metadata: row.metadata ? JSON.stringify(row.metadata) : null,
        createdAt: row.createdAt,
      })
  }

  async get(key: string): Promise<IndexRow | null> {
    const row = this.db.prepare('SELECT * FROM objects WHERE key = ?').get(key) as DbRow | undefined
    return row ? rowToIndexRow(row) : null
  }

  async delete(key: string): Promise<void> {
    this.db.prepare('DELETE FROM objects WHERE key = ?').run(key)
  }

  async list(prefix = ''): Promise<IndexRow[]> {
    const rows = this.db
      .prepare('SELECT * FROM objects WHERE key LIKE ? ORDER BY key')
      .all(`${prefix}%`) as DbRow[]
    return rows.map(rowToIndexRow)
  }

  close(): void {
    this.db.close()
  }
}
