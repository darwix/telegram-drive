import { describe, expect, it } from 'vitest'
import { createClient } from '../src/telegram/session.js'

describe('createClient', () => {
  it('passes networkSocket through to the TelegramClient options', () => {
    class FakeSocketFactory {
      static isWebSocket = false
    }
    const client = createClient(
      { apiId: 123, apiHash: 'hash', sessionString: '' },
      { networkSocket: FakeSocketFactory as unknown as never }
    )
    expect(client).toBeDefined()
    expect((client as unknown as { networkSocket?: unknown }).networkSocket).toBe(FakeSocketFactory)
  })

  it('omitting options still constructs a client (default socket)', () => {
    const client = createClient({ apiId: 123, apiHash: 'hash', sessionString: '' })
    expect(client).toBeDefined()
  })
})
