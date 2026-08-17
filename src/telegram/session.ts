import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

export interface TelegramCredentials {
  apiId: number
  apiHash: string
  sessionString: string
}

export function loadCredentialsFromEnv(): TelegramCredentials {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH
  const sessionString = process.env.TELEGRAM_SESSION ?? ''

  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set')
  }

  return { apiId, apiHash, sessionString }
}

export function createClient(creds: TelegramCredentials): TelegramClient {
  return new TelegramClient(new StringSession(creds.sessionString), creds.apiId, creds.apiHash, {
    connectionRetries: 5,
  })
}
