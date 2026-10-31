const LIMIT = 62

const PLOTS: Array<{ x: number; z: number; w: number; d: number; door?: boolean }> = [
  { x: 0, z: -48, w: 16, d: 11 },
  { x: 16, z: -54, w: 8, d: 7, door: true },
  { x: -16, z: -54, w: 8, d: 7, door: true },
  { x: -48, z: 0, w: 12, d: 16 },
  { x: 48, z: 0, w: 12, d: 16 },
  { x: 0, z: 48, w: 16, d: 11 },
  { x: -22, z: -22, w: 8, d: 8, door: true },
  { x: -28, z: 16, w: 4.4, d: 2.6, door: true },
  { x: 36, z: 32, w: 7, d: 6 },
  { x: 52, z: 18, w: 6, d: 5 },
  { x: 52, z: 28, w: 6, d: 5 },
  { x: 52, z: 40, w: 6, d: 5 },
]

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: { x: number; z: number },
  others: Array<{ x: number; z: number }> = [],
): void {
  const X = (x: number) => ((x / LIMIT) * 0.5 + 0.5) * width
  const Y = (z: number) => ((z / LIMIT) * 0.5 + 0.5) * height
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#101816'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#2f6d58'
  ctx.lineWidth = Math.max(2, width / 36)
  ctx.beginPath()
  ctx.moveTo(X(-46), Y(0))
  ctx.lineTo(X(46), Y(0))
  ctx.moveTo(X(0), Y(-46))
  ctx.lineTo(X(0), Y(46))
  ctx.stroke()
  for (const plot of PLOTS) {
    const left = X(plot.x - plot.w / 2)
    const top = Y(plot.z - plot.d / 2)
    const w = (plot.w / LIMIT) * 0.5 * width
    const h = (plot.d / LIMIT) * 0.5 * height
    ctx.fillStyle = plot.door ? '#1a4a3c' : '#16362c'
    ctx.fillRect(left, top, w, h)
    if (plot.door) {
      ctx.fillStyle = '#17f790'
      ctx.fillRect(left + w / 2 - 2, top + h - 3, 4, 3)
    }
  }
  ctx.fillStyle = '#1a6a5c'
  ctx.beginPath()
  ctx.arc(X(-40), Y(40), Math.max(4, width / 28), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9dccb6'
  ctx.font = `600 ${Math.max(9, Math.round(width / 12))}px Outfit, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const marks: Array<[number, number, string]> = [[0, -50, 'C'], [-50, 0, 'F'], [50, 0, 'I'], [0, 50, 'T']]
  for (const [x, z, letter] of marks) ctx.fillText(letter, X(x), Y(z))
  ctx.fillStyle = '#ffd27a'
  for (const other of others) {
    ctx.beginPath()
    ctx.arc(X(other.x), Y(other.z), Math.max(2, width / 60), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#f7f9fc'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(X(player.x), Y(player.z), Math.max(4, width / 32), 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#17f790'
  ctx.beginPath()
  ctx.arc(X(player.x), Y(player.z), Math.max(2.5, width / 48), 0, Math.PI * 2)
  ctx.fill()
}
