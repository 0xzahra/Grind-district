// Skits (src/skit.ts): the recording format falls back sensibly, and the framing never reads outside the game
// frame (full screen keeps its shape under 1280 px; 9:16 is a centred crop with even sizes for the encoder).
import { pickMime, frameFor, MAX_SECS } from '../src/skit.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

check(pickMime(() => true).startsWith('video/mp4;codecs=avc1'), 'MP4 (H.264) first when offered')
check(pickMime((t) => t.startsWith('video/webm')).startsWith('video/webm;codecs=vp9'), 'WebM VP9 when there is no MP4')
check(pickMime(() => false) === '', 'nothing when the browser cannot record')
check(MAX_SECS === 60, 'one-minute cap')

for (const [cw, ch] of [[1920, 1080], [960, 540], [390 * 3, 844 * 3], [844, 390], [1280, 1280], [301, 677]]) {
  for (const f of ['screen', 'portrait'] as const) {
    const r = frameFor(cw, ch, f)
    const tag = `${f} ${cw}x${ch}`
    check(r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= cw && r.sy + r.sh <= ch, `${tag}: crop inside the frame`)
    check(r.w % 2 === 0 && r.h % 2 === 0 && r.w > 0 && r.h > 0, `${tag}: even output size (${r.w}x${r.h})`)
    check(Math.max(r.w, r.h) <= 1280, `${tag}: at most 1280 px`)
    if (f === 'portrait') check(Math.abs(r.w / r.h - 9 / 16) < 0.02 && Math.abs(r.sw / r.sh - 9 / 16) < 0.02, `${tag}: 9:16`)
    else check(Math.abs(r.w / r.h - cw / ch) < 0.02, `${tag}: keeps the screen's shape`)
  }
}

console.log(`skit: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
