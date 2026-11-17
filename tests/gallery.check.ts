// Grind Art Gallery (api/_gallery.ts): image links resolve from IPFS and http sources to a resized cross-origin copy
// with the original as a fallback, and the exhibition list is well formed (unique pieces, real contract addresses,
// every room on a wall in src/gallery.ts). No network: the live chain reads are checked by hand.
import { readFileSync } from 'node:fs'
import { PIECES, ipfsPath, imageUrls } from '../api/_gallery.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

check(ipfsPath('ipfs://QmA/1.png') === 'QmA/1.png', 'ipfs:// path')
check(ipfsPath('ipfs://ipfs/QmB') === 'QmB', 'ipfs://ipfs/ path')
check(ipfsPath('https://ipfs.io/ipfs/QmC/7') === 'QmC/7', 'gateway URL path')
check(ipfsPath('https://media-proxy.artblocks.io/1/0xabc/0.png') === null, 'plain http is not IPFS')
const a = imageUrls('ipfs://QmTtM1G6GNodp6u4sENHkeirgR3aCq3nqcy43jb5FQW7B4')
check(a.img.startsWith('https://wsrv.nl/?url=') && a.img.includes(encodeURIComponent('https://ipfs.filebase.io/ipfs/QmTtM1G6')), 'IPFS image resized from a gateway that serves it')
check(a.raw === 'https://gateway.pinata.cloud/ipfs/QmTtM1G6GNodp6u4sENHkeirgR3aCq3nqcy43jb5FQW7B4', 'IPFS fallback is a cross-origin gateway')
const b = imageUrls('https://nft.beeple-collect.com/humanone/x.png', 640)
check(b.raw === 'https://nft.beeple-collect.com/humanone/x.png' && b.img.includes('&w=640&'), 'http image resized at the asked width, original kept')

const ids = new Set(PIECES.map((p) => p.id))
check(ids.size === PIECES.length, 'unique piece ids')
check(PIECES.every((p) => /^0x[0-9a-fA-F]{40}$/.test(p.contract) && /^\d+$/.test(p.token)), 'contracts and token ids are well formed')
check(PIECES.some((p) => p.artist.startsWith('Beeple')) && PIECES.some((p) => p.collection === 'Bored Ape Yacht Club') && PIECES.some((p) => p.collection === 'Mutant Ape Yacht Club'), 'Beeple, BAYC and MAYC are in the show')
check(PIECES.every((p) => p.note.length > 20 && p.title && p.year >= 2017), 'every piece has a label')
const client = readFileSync(new URL('../src/gallery.ts', import.meta.url), 'utf8')
const missing = PIECES.filter((p) => !client.includes(`'${p.id}'`))
check(missing.length === 0, `every piece hangs on a wall (missing: ${missing.map((p) => p.id).join(', ')})`)

console.log(`gallery: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
