// Mocked automatic top-up matching. No chain, no money.
import {
  encodeUsdcAmount, encodeEthAmount, formatUsdc, matchPaymentLogs, TREASURY, USDC, TRANSFER_TOPIC, ETH_DEPOSITED,
} from '../api/_topupAuto.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }

const tag = '123456'
const usdcRaw = encodeUsdcAmount(10, tag)
ok(usdcRaw === 10_123_456n, `USDC encode 10+tag = ${usdcRaw}`)
ok(formatUsdc(usdcRaw) === '10.123456', `format ${formatUsdc(usdcRaw)}`)
const ethRaw = encodeEthAmount(1, tag)
ok(ethRaw === 10n ** 15n + 123456n, `ETH encode ${ethRaw}`)

const from = '0x1111111111111111111111111111111111111111'
const hash = '0x' + 'ab'.repeat(32)
const usdcLog = {
  address: USDC,
  topics: [TRANSFER_TOPIC, '0x' + from.slice(2).padStart(64, '0'), '0x' + TREASURY.slice(2).padStart(64, '0')],
  data: '0x' + usdcRaw.toString(16).padStart(64, '0'),
  transactionHash: hash,
  logIndex: '0x1',
  blockNumber: '0x10',
}
const hit = matchPaymentLogs({ logs: [usdcLog], asset: 'USDC', amountRaw: usdcRaw })
ok(!!hit && hit.hash === hash && hit.from === from, `USDC match`)
ok(!matchPaymentLogs({ logs: [usdcLog], asset: 'USDC', amountRaw: usdcRaw + 1n }), 'USDC wrong amount rejected')
ok(!matchPaymentLogs({ logs: [usdcLog], asset: 'USDC', amountRaw: usdcRaw, from: '0x2222222222222222222222222222222222222222' }), 'USDC wrong from rejected')

const ethLog = {
  address: TREASURY,
  topics: [ETH_DEPOSITED, '0x' + from.slice(2).padStart(64, '0')],
  data: '0x' + ethRaw.toString(16).padStart(64, '0'),
  transactionHash: '0x' + 'cd'.repeat(32),
  logIndex: '0x2',
  blockNumber: '0x11',
}
ok(!!matchPaymentLogs({ logs: [ethLog], asset: 'ETH', amountRaw: ethRaw, from }), 'ETH match')
ok(!matchPaymentLogs({
  logs: [{ ...usdcLog, topics: [TRANSFER_TOPIC, usdcLog.topics[1], '0x' + '00'.repeat(32)] }],
  asset: 'USDC', amountRaw: usdcRaw,
}), 'USDC to other address rejected')

console.log(`\ntopup-auto: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
