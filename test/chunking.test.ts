import { describe, expect, it } from 'vitest'
import { reassembleChunks, splitChunks } from '../src/telegram/chunking.js'

describe('chunking', () => {
  it('round-trips a buffer smaller than the chunk size (single chunk)', () => {
    const original = Buffer.from('hello world')
    const chunks = splitChunks(original, 1024)
    expect(chunks).toHaveLength(1)
    expect(reassembleChunks(chunks)).toEqual(original)
  })

  it('round-trips a buffer exactly at the chunk size', () => {
    const original = Buffer.alloc(100, 7)
    const chunks = splitChunks(original, 100)
    expect(chunks).toHaveLength(1)
    expect(reassembleChunks(chunks)).toEqual(original)
  })

  it('round-trips a buffer larger than the chunk size (multi chunk)', () => {
    const original = Buffer.from(Array.from({ length: 250 }, (_, i) => i % 256))
    const chunks = splitChunks(original, 100)
    expect(chunks).toHaveLength(3)
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50])
    expect(reassembleChunks(chunks)).toEqual(original)
  })

  it('handles an empty buffer', () => {
    const original = Buffer.alloc(0)
    const chunks = splitChunks(original, 100)
    expect(reassembleChunks(chunks)).toEqual(original)
  })
})
