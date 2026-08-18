import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions/index.js'
import type { SocketFactory } from 'teleproto/extensions/index.js'

export interface TelegramCredentials {
  apiId: number
  apiHash: string
  sessionString: string
}

export interface CreateClientOptions {
  networkSocket?: SocketFactory
}

export function loadCredentialsFromEnv(sessionStringOverride?: string): TelegramCredentials {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH
  const sessionString = sessionStringOverride ?? process.env.TELEGRAM_SESSION ?? ''

  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set')
  }

  return { apiId, apiHash, sessionString }
}

export function createClient(creds: TelegramCredentials, options?: CreateClientOptions): TelegramClient {
  return new TelegramClient(new StringSession(creds.sessionString), creds.apiId, creds.apiHash, {
    connectionRetries: 5,
    ...(options?.networkSocket ? { networkSocket: options.networkSocket } : {}),
  })
}
