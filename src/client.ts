import { createHash } from 'node:crypto'
import { MtprotoClient } from './telegram/mtprotoClient.js'
import { loadCredentialsFromEnv } from './telegram/session.js'
import { DEFAULT_MAX_CHUNK_SIZE, reassembleChunks, splitChunks } from './telegram/chunking.js'
import { PostgresIndexStore } from './index/postgres.js'
import type { IndexStore, IndexRow } from './index/types.js'
import type { ObjectRef, PutOptions, TelegramDriveClient } from './types.js'

export interface CreateClientOptions {
  chatId?: string
  connectionString?: string
  indexStore?: IndexStore
  maxChunkSize?: number
}

function rowToRef(row: IndexRow): ObjectRef {
  return {
    key: row.key,
    size: row.size,
    mimeType: row.mimeType,
    chatId: row.chatId,
    messageId: row.messageIds[0],
    sha256: row.sha256,
    createdAt: row.createdAt,
    chunked: row.chunked || undefined,
    chunkCount: row.chunked ? row.messageIds.length : undefined,
  }
}

export function createTelegramDriveClient(opts: CreateClientOptions = {}): TelegramDriveClient {
  const chatId = opts.chatId ?? process.env.TELEGRAM_DRIVE_CHAT_ID
  if (!chatId) throw new Error('chatId required (pass opts.chatId or set TELEGRAM_DRIVE_CHAT_ID)')

  const maxChunkSize = opts.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE
  const connectionString = opts.connectionString ?? process.env.DRIVE_INDEX_DATABASE_URL
  if (!opts.indexStore && !connectionString) {
    throw new Error('connectionString required (pass opts.connectionString or set DRIVE_INDEX_DATABASE_URL)')
  }
  const index = opts.indexStore ?? new PostgresIndexStore(connectionString!)
  const mtproto = new MtprotoClient(loadCredentialsFromEnv())

  let connected: Promise<void> | null = null
  async function ensureConnected() {
    if (!connected) connected = mtproto.connect()
    await connected
  }

  return {
    async put(key, bytes, opts: PutOptions = {}) {
      await ensureConnected()
      const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      const chunks = splitChunks(buffer, maxChunkSize)
      const chunked = chunks.length > 1

      const messageIds: number[] = []
      for (let i = 0; i < chunks.length; i++) {
        const fileName = chunked ? `${key}.part${i}` : key
        const sent = await mtproto.sendFile(chatId, chunks[i], { fileName, mimeType: opts.mimeType })
        messageIds.push(sent.id)
      }

      const row: IndexRow = {
        key,
        chatId,
        messageIds,
        size: buffer.length,
        mimeType: opts.mimeType ?? 'application/octet-stream',
        sha256,
        chunked,
        metadata: opts.metadata,
        createdAt: new Date().toISOString(),
      }
      await index.put(row)
      return rowToRef(row)
    },

    async get(key) {
      await ensureConnected()
      const row = await index.get(key)
      if (!row) throw new Error(`Object not found: ${key}`)
      const buffers = await Promise.all(row.messageIds.map((id) => mtproto.downloadMedia(row.chatId, id)))
      return row.chunked ? reassembleChunks(buffers) : buffers[0]
    },

    async head(key) {
      const row = await index.get(key)
      return row ? rowToRef(row) : null
    },

    async delete(key) {
      await ensureConnected()
      const row = await index.get(key)
      if (!row) return
      await mtproto.deleteMessages(row.chatId, row.messageIds)
      await index.delete(key)
    },

    async list(prefix) {
      const rows = await index.list(prefix)
      return rows.map(rowToRef)
    },
  }
}
