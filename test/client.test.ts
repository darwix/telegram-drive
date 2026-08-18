import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTelegramDriveClient } from '../src/client.js'
import type { TelegramDriveClient } from '../src/types.js'

// Requires real Telegram credentials (TELEGRAM_API_ID/HASH/SESSION, TELEGRAM_DRIVE_CHAT_ID)
// and a reachable Postgres instance (DRIVE_INDEX_DATABASE_URL).
// Not run in CI or by default — run manually once creds are available.
const hasCreds = !!process.env.TELEGRAM_SESSION && !!process.env.DRIVE_INDEX_DATABASE_URL

describe.skipIf(!hasCreds)('TelegramDriveClient integration', () => {
  const testPrefix = `test/${randomUUID()}/`
  let client: TelegramDriveClient

  beforeAll(() => {
    client = createTelegramDriveClient()
  })

  afterAll(async () => {
    const rows = await client.list(testPrefix)
    await Promise.all(rows.map((row) => client.delete(row.key)))
  })

  it('puts and gets a small object', async () => {
    const key = `${testPrefix}small.txt`
    const bytes = Buffer.from('hello telegram-drive')
    const ref = await client.put(key, bytes, { mimeType: 'text/plain' })
    expect(ref.key).toBe(key)
    expect(ref.size).toBe(bytes.length)

    const fetched = await client.get(key)
    expect(fetched.equals(bytes)).toBe(true)
  })

  it('deletes an object and head returns null', async () => {
    const key = `${testPrefix}to-delete.txt`
    await client.put(key, Buffer.from('bye'))
    await client.delete(key)
    expect(await client.head(key)).toBeNull()
  })

  it('round-trips a chunked object', async () => {
    const key = `${testPrefix}chunked.bin`
    const bytes = Buffer.alloc(250, 42)
    const chunkedClient = createTelegramDriveClient({ maxChunkSize: 100 })
    const ref = await chunkedClient.put(key, bytes)
    expect(ref.chunked).toBe(true)
    expect(ref.chunkCount).toBe(3)

    const fetched = await chunkedClient.get(key)
    expect(fetched.equals(bytes)).toBe(true)
  })

  it('survives flood-wait under rapid concurrent puts', async () => {
    const puts = Array.from({ length: 5 }, (_, i) =>
      client.put(`${testPrefix}rapid-${i}.txt`, Buffer.from(`rapid ${i}`))
    )
    await expect(Promise.all(puts)).resolves.toHaveLength(5)
  })
})

describe('createTelegramDriveClient sessionString override', () => {
  it('does not throw when sessionString is passed even without TELEGRAM_SESSION set', () => {
    const savedSession = process.env.TELEGRAM_SESSION
    const savedApiId = process.env.TELEGRAM_API_ID
    const savedApiHash = process.env.TELEGRAM_API_HASH
    delete process.env.TELEGRAM_SESSION
    process.env.TELEGRAM_API_ID = '123456'
    process.env.TELEGRAM_API_HASH = 'test_hash'
    try {
      expect(() =>
        createTelegramDriveClient({
          chatId: '-1',
          connectionString: 'postgres://fake',
          sessionString: '',
        })
      ).not.toThrow()
    } finally {
      if (savedSession !== undefined) process.env.TELEGRAM_SESSION = savedSession
      if (savedApiId !== undefined) process.env.TELEGRAM_API_ID = savedApiId
      if (savedApiHash !== undefined) process.env.TELEGRAM_API_HASH = savedApiHash
    }
  })
})
