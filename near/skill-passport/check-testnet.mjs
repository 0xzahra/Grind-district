// Read-only check of the deployed testnet contract: node near/skill-passport/check-testnet.mjs [contract] [account]
const C = process.argv[2] ?? 'grinddistrict-passport.testnet', A = process.argv[3] ?? 'grinddistrict-player1.testnet'
const view = async (m, a) => { const r = await (await fetch('https://rpc.testnet.near.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: C, method_name: m, args_base64: Buffer.from(JSON.stringify(a)).toString('base64') } }) })).json(); return JSON.parse(Buffer.from(r.result.result).toString()) }
const info = await view('passport_info', {}), courses = await view('get_courses', {}), spot = await view('get_completion', { account_id: A, course_id: 'spot' }), risk = await view('has_completed', { account_id: A, course_id: 'risk' })
console.log({ attestation: info.attestation, courses: courses.length, spot, riskCompleted: risk })
if (info.attestation !== 'self-attested' || courses.length !== 20 || !spot || risk !== false) { console.error('FAIL'); process.exit(1) }
console.log('OK')
