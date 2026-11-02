import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleTopupBalance } from '../../server/topup-api.ts'

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await handleTopupBalance(req, res)
}
