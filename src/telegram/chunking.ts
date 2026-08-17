export const DEFAULT_MAX_CHUNK_SIZE = 1_900_000_000

export function splitChunks(bytes: Buffer | Uint8Array, maxChunkSize = DEFAULT_MAX_CHUNK_SIZE): Buffer[] {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (buf.length === 0) return [buf]
  const chunks: Buffer[] = []
  for (let offset = 0; offset < buf.length; offset += maxChunkSize) {
    chunks.push(buf.subarray(offset, offset + maxChunkSize))
  }
  return chunks
}

export function reassembleChunks(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers)
}
