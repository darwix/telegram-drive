export interface IndexRow {
  key: string
  chatId: string
  messageIds: number[]
  size: number
  mimeType: string
  sha256: string
  chunked: boolean
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface IndexStore {
  put(row: IndexRow): Promise<void>
  get(key: string): Promise<IndexRow | null>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<IndexRow[]>
  close(): void
}
