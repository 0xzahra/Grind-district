// In-game Web3 events at the Conference centre: a rotating weekly programme (AMAs, Spaces-style talks,
// hackathon demo days, builder panels). Fictional, in-game only; joining gives in-game cash and reputation once per event.
export type GameEvent = { id: string; kind: 'AMA' | 'Spaces talk' | 'Demo day' | 'Panel' | 'Workshop'; title: string; host: string; hour: number; xp: number; rep: number }

const WEEK: Array<Omit<GameEvent, 'id'>[]> = [
  [{ kind: 'Spaces talk', title: 'Shipping on Base: what actually onboarded users', host: 'Campus builders', hour: 18, xp: 20, rep: 1 }],
  [{ kind: 'AMA', title: 'Ask the treasury: how the Safe is run', host: 'Grind District team', hour: 19, xp: 20, rep: 1 }],
  [{ kind: 'Workshop', title: 'Self-custody in 20 minutes', host: 'Campus', hour: 17, xp: 18, rep: 1 }],
  [{ kind: 'Panel', title: 'Bounties that paid: three teams, three receipts', host: 'Studio row', hour: 19, xp: 22, rep: 1 }],
  [{ kind: 'AMA', title: 'Founders AMA: building through a bear market', host: 'Campus booths', hour: 20, xp: 20, rep: 1 }],
  [{ kind: 'Demo day', title: 'Hackathon demo day: five-minute demos, no slides', host: 'District hackers', hour: 16, xp: 30, rep: 2 }],
  [{ kind: 'Spaces talk', title: 'Climate credits on-chain: what is real', host: 'Green desk', hour: 17, xp: 20, rep: 1 }],
]

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The next `days` days of programme, today first. An event is "open" from 2 h before its hour until it ends (1 h). */
export function schedule(now = new Date(), days = 5): Array<GameEvent & { day: Date; label: string; open: boolean }> {
  const out: Array<GameEvent & { day: Date; label: string; open: boolean }> = []
  for (let i = 0; i < days; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    for (const e of WEEK[day.getDay()]) {
      const start = new Date(day); start.setHours(e.hour, 0, 0, 0)
      const ms = start.getTime() - now.getTime()
      if (ms < -3_600_000) continue // finished
      const label = i === 0 ? `Today ${e.hour}:00` : i === 1 ? `Tomorrow ${e.hour}:00` : `${day.toLocaleDateString(undefined, { weekday: 'short' })} ${e.hour}:00`
      out.push({ ...e, id: `${key(day)}-${e.kind}`, day, label, open: ms <= 7_200_000 })
    }
  }
  return out
}

/** Draw the big screen: a calm schedule board (cream on deep slate, gold rule). */
export function paintSchedule(g: CanvasRenderingContext2D, w: number, h: number, now = new Date()): void {
  g.fillStyle = '#1b1f24'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#c9a25e'; g.fillRect(40, 92, w - 80, 3)
  g.fillStyle = '#f2ece0'; g.font = '600 46px -apple-system, Inter, sans-serif'; g.fillText('Upcoming Web3 events', 40, 70)
  g.font = '400 22px -apple-system, Inter, sans-serif'; g.fillStyle = '#a99f8f'
  g.textAlign = 'right'; g.fillText('Conference centre · Campus', w - 40, 70); g.textAlign = 'left'
  schedule(now, 5).slice(0, 5).forEach((e, i) => {
    const y = 150 + i * 70
    g.fillStyle = e.open ? '#c9a25e' : '#a99f8f'; g.font = '600 22px -apple-system, Inter, sans-serif'
    g.fillText(`${e.label}  ·  ${e.kind.toUpperCase()}${e.open ? '  ·  DOORS OPEN' : ''}`, 40, y)
    g.fillStyle = '#f2ece0'; g.font = '400 28px -apple-system, Inter, sans-serif'
    g.fillText(e.title.length > 52 ? `${e.title.slice(0, 51)}…` : e.title, 40, y + 34)
  })
}
