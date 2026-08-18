export interface ObjectRef {
  key: string
  size: number
  mimeType: string
  chatId: string
  messageId: number
  sha256: string
  createdAt: string
  chunked?: boolean
  chunkCount?: number
}

export interface PutOptions {
  mimeType?: string
  metadata?: Record<string, unknown>
}

export interface TelegramDriveClient {
  put(key: string, bytes: Buffer | Uint8Array, opts?: PutOptions): Promise<ObjectRef>
  get(key: string): Promise<Buffer>
  head(key: string): Promise<ObjectRef | null>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<ObjectRef[]>
  disconnect(): Promise<void>
}
