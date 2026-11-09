// Exact-amount + payer matching for automatic top-up. No chain, no money.
import {
  encodeUsdcAmount, encodeEthAmount, formatUsdc, amountLabel, matchPaymentLogs, pickOrderForPayment,
  TREASURY, USDC, TRANSFER_TOPIC, ETH_DEPOSITED,
} from '../api/_topupAuto.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }

const usdc5 = encodeUsdcAmount(5)
ok(usdc5 === 5_000_000n, `USDC $5 exact = ${usdc5}`)
ok(formatUsdc(usdc5) === '5', `format ${formatUsdc(usdc5)}`)
ok(amountLabel('USDC', usdc5) === '$5', `label ${amountLabel('USDC', usdc5)}`)
ok(encodeUsdcAmount(10) === 10_000_000n, 'USDC $10 exact')

const eth1 = encodeEthAmount(1)
ok(eth1 === 10n ** 15n, `ETH 0.001 exact = ${eth1}`)

const from = '0x1111111111111111111111111111111111111111'
const other = '0x2222222222222222222222222222222222222222'
const hash = '0x' + 'ab'.repeat(32)
const hash2 = '0x' + 'cd'.repeat(32)

const usdcLog = {
  address: USDC,
  topics: [TRANSFER_TOPIC, '0x' + from.slice(2).padStart(64, '0'), '0x' + TREASURY.slice(2).padStart(64, '0')],
  data: '0x' + usdc5.toString(16).padStart(64, '0'),
  transactionHash: hash,
  logIndex: '0x1',
  blockNumber: '0x10',
}
ok(!!matchPaymentLogs({ logs: [usdcLog], asset: 'USDC', amountRaw: usdc5, from }), 'USDC match exact 5 from payer')
ok(!matchPaymentLogs({ logs: [usdcLog], asset: 'USDC', amountRaw: usdc5 + 1n, from }), 'USDC wrong amount rejected')
ok(!matchPaymentLogs({ logs: [usdcLog], asset: 'USDC', amountRaw: usdc5, from: other }), 'USDC wrong payer rejected')
ok(!matchPaymentLogs({
  logs: [{ ...usdcLog, topics: [TRANSFER_TOPIC, usdcLog.topics[1], '0x' + '00'.repeat(32)] }],
  asset: 'USDC', amountRaw: usdc5, from,
}), 'USDC wrong recipient rejected')

const ethLog = {
  address: TREASURY,
  topics: [ETH_DEPOSITED, '0x' + from.slice(2).padStart(64, '0')],
  data: '0x' + eth1.toString(16).padStart(64, '0'),
  transactionHash: hash2,
  logIndex: '0x2',
  blockNumber: '0x11',
}
ok(!!matchPaymentLogs({ logs: [ethLog], asset: 'ETH', amountRaw: eth1, from }), 'ETH match from payer')
ok(!matchPaymentLogs({ logs: [ethLog], asset: 'ETH', amountRaw: eth1, from: other }), 'ETH wrong payer rejected')

// Oldest of two equal open orders wins
const o1 = { id: '11111111-1111-1111-1111-111111111111', created_at: '2026-11-09T10:00:00.000Z', status: 'waiting' }
const o2 = { id: '22222222-2222-2222-2222-222222222222', created_at: '2026-11-09T10:05:00.000Z', status: 'waiting' }
const oldest = pickOrderForPayment({ openOrders: [o2, o1], scannedOrderId: o1.id, txHash: hash })
ok(oldest.ok && oldest.orderId === o1.id, 'oldest order credited when scanned')
const newer = pickOrderForPayment({ openOrders: [o2, o1], scannedOrderId: o2.id, txHash: hash })
ok(!newer.ok && newer.reason === 'not_oldest', 'newer equal-amount order waits')

// Replay / duplicate: tx already taken by another order
const taken = pickOrderForPayment({
  openOrders: [o1, o2],
  scannedOrderId: o2.id,
  txHash: hash,
  ordersByTx: { [hash]: o1.id },
})
ok(!taken.ok && taken.reason === 'tx_taken', 'one tx cannot satisfy two orders')

// Same tx already on oldest — scanning newer reports not_oldest / or routes to oldest when oldest holds hash
const routed = pickOrderForPayment({
  openOrders: [{ ...o1, tx_hash: hash, status: 'detected' }, o2],
  scannedOrderId: o2.id,
  txHash: hash,
  ordersByTx: { [hash]: o1.id },
})
ok(!routed.ok && routed.reason === 'tx_taken', 'tx bound to other order is not reused')

// Scanning the order that already owns the tx is fine
const self = pickOrderForPayment({
  openOrders: [{ ...o1, tx_hash: hash, status: 'detected' }],
  scannedOrderId: o1.id,
  txHash: hash,
  ordersByTx: { [hash]: o1.id },
})
ok(self.ok && self.orderId === o1.id, 'owner of tx can proceed')

console.log(`\ntopup-auto: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
