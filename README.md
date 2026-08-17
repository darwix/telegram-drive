# telegram-drive

Application-agnostic TypeScript library that uses a Telegram user account (via MTProto) as a blob storage backend. Nothing in this package knows about any downstream application — it's a generic key/value blob store over Telegram.

```ts
interface TelegramDriveClient {
  put(key: string, bytes: Buffer | Uint8Array, opts?: { mimeType?: string; metadata?: Record<string, unknown> }): Promise<ObjectRef>
  get(key: string): Promise<Buffer>
  head(key: string): Promise<ObjectRef | null>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<ObjectRef[]>
}
```

## Setup

1. `npm install`
2. Get `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` from https://my.telegram.org
3. Create a private Telegram channel to use as the storage bucket, note its chat ID
4. Copy `.env.example` to `.env` and fill in `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_DRIVE_CHAT_ID`
5. Run `npm run login` — one-time interactive login (phone → code → optional 2FA), prints a session string. Paste it into `.env` as `TELEGRAM_SESSION`.

## Usage

```ts
import { createTelegramDriveClient } from 'telegram-drive'

const drive = createTelegramDriveClient()

const ref = await drive.put('backups/2026-08-17.tar.gz', buffer, { mimeType: 'application/gzip' })
const bytes = await drive.get('backups/2026-08-17.tar.gz')
const meta = await drive.head('backups/2026-08-17.tar.gz')
const all = await drive.list('backups/')
await drive.delete('backups/2026-08-17.tar.gz')
```

Index metadata is stored in SQLite by default (`DRIVE_INDEX_PATH`, default `./drive-index.sqlite`). A Postgres adapter for multi-instance use exists as a stub (`src/index/postgres.ts`) — not implemented in v1.

Files above ~1.9GB are automatically split across multiple Telegram messages and reassembled on `get()`.

## Testing

- `npm test` — unit tests (chunking) always run.
- Integration tests (`test/client.test.ts`) require real Telegram credentials and are skipped unless `TELEGRAM_SESSION` is set. Run manually, not in CI, against a disposable key prefix.

## Non-goals (v1)

- No encryption layer
- No multi-channel sharding (single bucket/channel)
- No REST API wrapper — library only
- No application-specific code
