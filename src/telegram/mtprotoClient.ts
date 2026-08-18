import { Api, TelegramClient } from 'teleproto'
import { CustomFile } from 'teleproto/client/uploads.js'
import PQueue from 'p-queue'
import type { SocketFactory } from 'teleproto/extensions/index.js'
import type { TelegramCredentials } from './session.js'
import { createClient } from './session.js'

export interface SendFileOptions {
  fileName: string
  mimeType?: string
}

export interface MtprotoClientOptions {
  networkSocket?: SocketFactory
}

export class MtprotoClient {
  private client: TelegramClient
  private connected = false
  private queue = new PQueue({ concurrency: 1 })

  constructor(creds: TelegramCredentials, options?: MtprotoClientOptions) {
    this.client = createClient(creds, options)
  }

  async connect(): Promise<void> {
    if (this.connected) return
    await this.client.connect()
    this.connected = true
  }

  async sendFile(chatId: string, buffer: Buffer, opts: SendFileOptions): Promise<{ id: number }> {
    return this.withRetry(async () => {
      // uploadFile is called directly (rather than passing the CustomFile to
      // sendFile) so maxBufferSize can be forced above the buffer's size —
      // teleproto's sendFile always reads from CustomFile.path via node:fs
      // once fileSize exceeds its internal 20MB default, which doesn't exist
      // on Workers. Uploading via buffer only keeps this fs-free everywhere.
      const handle = await this.client.uploadFile({
        file: new CustomFile(opts.fileName, buffer.length, '', buffer),
        maxBufferSize: buffer.length,
        workers: 1,
      })
      const message = await this.client.sendFile(chatId, {
        file: handle,
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
