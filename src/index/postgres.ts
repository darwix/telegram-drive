import type { IndexRow, IndexStore } from './types.js'

// ponytail: stub only, no instance needs multi-process index yet. Implement with `pg` when v1 needs multi-instance use.
export class PostgresIndexStore implements IndexStore {
  constructor(_connectionString: string) {}

  async put(_row: IndexRow): Promise<void> {
    throw new Error('PostgresIndexStore not implemented')
  }

  async get(_key: string): Promise<IndexRow | null> {
    throw new Error('PostgresIndexStore not implemented')
  }

  async delete(_key: string): Promise<void> {
    throw new Error('PostgresIndexStore not implemented')
  }

  async list(_prefix?: string): Promise<IndexRow[]> {
    throw new Error('PostgresIndexStore not implemented')
  }

  close(): void {}
}
