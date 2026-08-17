import { randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTelegramDriveClient } from '../src/client.js'
import type { TelegramDriveClient } from '../src/types.js'

// Requires real Telegram credentials (TELEGRAM_API_ID/HASH/SESSION, TELEGRAM_DRIVE_CHAT_ID).
// Not run in CI or by default — run manually once creds are available.
const hasCreds = !!process.env.TELEGRAM_SESSION

describe.skipIf(!hasCreds)('TelegramDriveClient integration', () => {
  const indexPath = `./test-drive-index-${randomUUID()}.sqlite`
  const testPrefix = `test/${randomUUID()}/`
  let client: TelegramDriveClient

  beforeAll(() => {
    client = createTelegramDriveClient({ indexPath })
  })

  afterAll(() => {
    unlinkSync(indexPath)
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
    const chunkedClient = createTelegramDriveClient({ indexPath, maxChunkSize: 100 })
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
