// Personality reading (src/personaCore.ts): traits come from play with evidence, roles and niches rank by what the
// player spends time on, the zodiac only comments, and nothing shareable carries an amount.
import { blankRecord, normalizeRecord, handType, traderType, rhythm, learning, roles, niches, readPersona, personaPost, type PersonaRecord, type PersonaFacts } from '../src/personaCore.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const NOW = new Date(2026, 10, 17, 12, 0, 0).getTime()
const facts = (over: Partial<PersonaFacts> = {}): PersonaFacts => ({ skills: {}, tracks: {}, job: '', streak: 0, sign: null, ...over })
const rec = (f: (r: PersonaRecord) => void): PersonaRecord => { const r = blankRecord(NOW - 30 * 86_400_000); r.lastSeen = NOW; f(r); return r }
const value = (t: { value: string }) => t.value

// Nothing played: nothing guessed.
{
  const r = blankRecord(NOW)
  check(value(handType(r)) === 'Not read yet', 'no trades: hands not read')
  check(!!handType(r).unlock, 'no trades: says how to unlock')
  check(traderType(r).every((t) => t.value === 'Not read yet'), 'no trades: style and risk not read')
  check(value(rhythm(r, NOW)[0]!) === 'Not read yet', 'no activity: rhythm not read')
  const p = readPersona(r, facts(), NOW)
  check(p.title === 'A story still being written', `blank title (got ${p.title})`)
  check(p.roles.length === 0 && p.niches.length === 0, 'blank: no roles or niches')
}

// Hands.
{
  const diamond = rec((r) => { Object.assign(r.spot, { sells: 6, sellsAtProfit: 5, sellsAtLoss: 1, dips: 3, recovered: 3, panic: 0 }) })
  check(value(handType(diamond)) === 'Diamond hands', `diamond (got ${value(handType(diamond))})`)
  check(handType(diamond).why.some((w) => /Held through 3 dips/.test(w)), 'diamond evidence names the dips')
  const paper = rec((r) => { Object.assign(r.spot, { sells: 6, sellsAtProfit: 2, sellsAtLoss: 4, quickLoss: 3 }) })
  check(value(handType(paper)) === 'Paper hands', `paper (got ${value(handType(paper))})`)
  const panicky = rec((r) => { Object.assign(r.spot, { sells: 4, sellsAtLoss: 2, sellsAtProfit: 2, dips: 2, panic: 2 }) })
  check(value(handType(panicky)) === 'Paper hands', 'sold at the bottom of dips: paper')
  const steady = rec((r) => { Object.assign(r.spot, { sells: 5, sellsAtProfit: 4, sellsAtLoss: 1 }) })
  check(/Steady/.test(value(handType(steady))), 'mostly green sales, no dips: steady')
  check(handType(steady).confidence === 'low', 'five sales: low confidence')
  const lots = rec((r) => { Object.assign(r.spot, { sells: 12, sellsAtProfit: 10, sellsAtLoss: 2, dips: 5, recovered: 4 }) })
  check(handType(lots).confidence === 'high', 'seventeen samples: high confidence')
}

// Trading style and risk.
{
  const scalper = rec((r) => { Object.assign(r.spot, { buys: 8, sells: 8, holds: [2, 3, 4, 5, 6, 3, 2, 4], big: 6, alt: 2 }) })
  check(value(traderType(scalper)[0]!) === 'Scalper', `scalper (got ${value(traderType(scalper)[0]!)})`)
  const day = rec((r) => { Object.assign(r.spot, { buys: 5, sells: 5, holds: [45, 90, 200, 300, 600] }) })
  check(value(traderType(day)[0]!) === 'Day trader', 'hours-long holds: day trader')
  const swing = rec((r) => { Object.assign(r.spot, { buys: 4, sells: 4, holds: [3 * 1440, 5 * 1440, 2 * 1440, 4 * 1440] }) })
  check(value(traderType(swing)[0]!) === 'Swing trader', 'days-long holds: swing')
  const hodl = rec((r) => { Object.assign(r.spot, { buys: 6, sells: 1, holds: [] }) })
  check(/Long-term/.test(value(traderType(hodl)[0]!)), 'buys and rarely sells: long-term holder')
  const degen = rec((r) => { Object.assign(r.spot, { buys: 7, meme: 5, big: 2, sizes: [0.9, 1, 0.8] }) })
  check(/Degen/.test(value(traderType(degen)[1]!)), 'mostly memecoins: degen')
  const lev = rec((r) => { Object.assign(r.perps, { opens: 3, levSum: 30, lev10: 3, liquidations: 1 }) })
  check(/Degen/.test(value(traderType(lev)[1]!)), '10x perps and a liquidation: degen')
  const careful = rec((r) => { Object.assign(r.spot, { buys: 7, big: 6, alt: 1, sizes: [0.2, 0.25, 0.25, 0.2] }) })
  check(value(traderType(careful)[1]!) === 'Conservative', `big caps, small sizes: conservative (got ${value(traderType(careful)[1]!)})`)
  check(!traderType(careful).some((t) => t.why.some((w) => /\$/.test(w))), 'risk evidence never shows dollars')
}

// Rhythm and habit.
{
  const owl = rec((r) => { r.hours[23] = 10; r.hours[0] = 8; r.hours[1] = 6; r.hours[14] = 2; r.days[6] = 14; r.days[0] = 6; r.days[3] = 6 })
  const t = rhythm(owl, NOW)
  check(value(t[0]!) === 'Night owl', `night owl (got ${value(t[0]!)})`)
  check(t[0]!.why.some((w) => /weekend warrior/.test(w)), 'weekend share noticed')
  const reg = rec((r) => { r.hours[8] = 20; for (let i = 0; i < 10; i++) r.active.push(new Date(NOW - i * 86_400_000).toISOString().slice(0, 10)) })
  check(rhythm(reg, NOW).some((x) => x.value === 'Daily regular'), 'ten of fourteen days: daily regular')
}

// Learning.
{
  const quick = learning(blankRecord(NOW), facts({ skills: { a: { passed: true, tries: 1 }, b: { passed: true, tries: 1 }, c: { passed: true, tries: 1 }, d: { passed: true, tries: 1 } } }))
  check(value(quick) === 'Quick study', 'four first-try passes: quick study')
  const persistent = learning(blankRecord(NOW), facts({ skills: { a: { passed: true, tries: 3 }, b: { passed: true, tries: 2 }, c: { passed: true, tries: 1 } } }))
  check(/Persistent/.test(value(persistent)), 'retries: persistent')
}

// Roles and niches follow what the player spends time on.
{
  const social = rec((r) => { r.acts.greet = 20; r.acts.message = 8; r.acts.event = 5; r.places.conference = 3 })
  const rs = roles(social, facts({ skills: { community: { passed: true, tries: 1 } }, job: 'community' }))
  check(rs[0]?.id === 'community', `social player: community manager first (got ${rs[0]?.id})`)
  check(rs[0]!.why.length > 0 && rs.length <= 3, 'reasons given, top three only')
  const trader = rec((r) => { Object.assign(r.spot, { buys: 12, sells: 10 }); Object.assign(r.perps, { opens: 5 }); r.places.trading = 6 })
  const rt = roles(trader, facts({ skills: { spot: { passed: true }, risk: { passed: true } } }))
  check(rt[0]?.id === 'trader', `trader first (got ${rt[0]?.id})`)
  check(rt[0]!.level === 'Strong', `lots of trading: strong fit (got ${rt[0]!.level})`)
  const meme = rec((r) => { Object.assign(r.spot, { buys: 6, meme: 6 }) })
  const nm = niches(meme, facts({ skills: { memes: { passed: true } } }))
  check(nm[0]?.id === 'memes', `meme buyer: memecoin niche (got ${nm[0]?.id})`)
  const thin = rec((r) => { r.acts.greet = 1 })
  const rthin = roles(thin, facts())
  // One greeting is not a career: no role is matched until there is real evidence (courses, tracks, activity).
  check(rthin.length === 0, `one greeting: too little to match a role yet (got ${rthin[0]?.id})`)
}

// Zodiac comments, never decides.
{
  const diamond = rec((r) => { Object.assign(r.spot, { sells: 6, sellsAtProfit: 5, sellsAtLoss: 1, dips: 3, recovered: 3 }) })
  const taurus = readPersona(diamond, facts({ sign: { name: 'Taurus', sym: '♉', trait: '' } }), NOW)
  check(taurus.zodiac?.agrees === true, 'Taurus with diamond hands: agrees')
  const aries = readPersona(rec((r) => { Object.assign(r.spot, { buys: 7, big: 6, alt: 1, sizes: [0.2, 0.2, 0.2] }) }), facts({ sign: { name: 'Aries', sym: '♈', trait: '' } }), NOW)
  check(aries.zodiac?.agrees === false && /different story/.test(aries.zodiac.note), 'Aries playing it safe: play disagrees')
  const none = readPersona(blankRecord(NOW), facts({ sign: { name: 'Leo', sym: '♌', trait: '' } }), NOW)
  check(none.zodiac?.agrees === null, 'no play yet: no verdict')
  const noSign = readPersona(diamond, facts(), NOW)
  check(JSON.stringify(noSign.traits) === JSON.stringify(taurus.traits), 'the sign never changes a trait')
}

// Sharing and storage.
{
  const r = rec((x) => { Object.assign(x.spot, { buys: 8, sells: 8, holds: [2, 3, 4, 5, 6, 3, 2, 4], sizes: [0.5] }); x.hours[22] = 20 })
  const p = readPersona(r, facts({ skills: { spot: { passed: true } } }), NOW)
  const post = personaPost(p, 'https://www.grinddistrict.app/?ref=amara')
  check(!/\$|usd|usdc/i.test(post), 'post has no amounts')
  check(post.includes(p.title) && post.length < 400, 'post carries the title and stays short')
  check(p.title.startsWith('The '), `a titled archetype (got ${p.title})`)
  const fixed = normalizeRecord({ hours: [1, 2], spot: { buys: 'x', sells: 3, holds: [1, 'a', 2] }, acts: { greet: 2, bad: 'x' } }, NOW)
  check(fixed.hours.length === 24 && fixed.spot.sells === 3 && fixed.spot.buys === 0, 'repairs bad fields')
  check(fixed.spot.holds.length === 2 && fixed.acts.greet === 2 && !('bad' in fixed.acts), 'drops bad values')
  check(normalizeRecord('nonsense', NOW).v === 1, 'garbage gives a blank record')
}

console.log(`persona: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
