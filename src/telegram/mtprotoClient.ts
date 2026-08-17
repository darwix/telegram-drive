import { Api, TelegramClient } from 'telegram'
import PQueue from 'p-queue'
import type { TelegramCredentials } from './session.js'
import { createClient } from './session.js'

export interface SendFileOptions {
  fileName: string
  mimeType?: string
}

export class MtprotoClient {
  private client: TelegramClient
  private connected = false
  private queue = new PQueue({ concurrency: 1 })

  constructor(creds: TelegramCredentials) {
    this.client = createClient(creds)
  }

  async connect(): Promise<void> {
    if (this.connected) return
    await this.client.connect()
    this.connected = true
  }

  async sendFile(chatId: string, buffer: Buffer, opts: SendFileOptions): Promise<{ id: number }> {
    return this.withRetry(async () => {
      const message = await this.client.sendFile(chatId, {
        file: buffer,
        attributes: [new Api.DocumentAttributeFilename({ fileName: opts.fileName })],
        forceDocument: true,
        workers: 1,
      })
      return { id: message.id }
    })
  }

  async downloadMedia(chatId: string, messageId: number): Promise<Buffer> {
    return this.withRetry(async () => {
      const messages = await this.client.getMessages(chatId, { ids: [messageId] })
      const message = messages[0]
      if (!message) throw new Error(`Message ${messageId} not found in chat ${chatId}`)
      const data = await this.client.downloadMedia(message, {})
      if (!data) throw new Error(`No media found for message ${messageId} in chat ${chatId}`)
      return Buffer.isBuffer(data) ? data : Buffer.from(data as string, 'binary')
    })
  }

  async deleteMessages(chatId: string, messageIds: number[]): Promise<void> {
    await this.withRetry(async () => {
      await this.client.deleteMessages(chatId, messageIds, { revoke: true })
    })
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      for (;;) {
        try {
          return await fn()
        } catch (err: any) {
          if (err?.seconds && typeof err.seconds === 'number') {
            await new Promise((resolve) => setTimeout(resolve, (err.seconds + 1) * 1000))
            continue
          }
          throw err
        }
      }
    }) as Promise<T>
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.client.disconnect()
    this.connected = false
  }
}
