import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions/index.js'

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH

  if (!apiId || !apiHash) {
    console.error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH before running login.')
    process.exit(1)
  }

  const rl = readline.createInterface({ input: stdin, output: stdout })
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 })

  await client.start({
    phoneNumber: async () => rl.question('Phone number: '),
    phoneCode: async () => rl.question('Code sent to Telegram: '),
    password: async () => rl.question('2FA password (leave blank if none): '),
    onError: (err) => console.error(err),
  })

  console.log('\nLogin successful. Save this as TELEGRAM_SESSION in your .env:\n')
  console.log(client.session.save())

  rl.close()
  await client.disconnect()
  process.exit(0)
}

main()
