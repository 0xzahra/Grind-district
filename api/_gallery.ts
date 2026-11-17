// The Grind Art Gallery's exhibition, read live from Ethereum (served at /api/track?op=gallery). Underscore = not a
// Vercel function. For each piece the server reads the token's own metadata address and current owner from the
// chain (tokenURI and ownerOf over public RPC; for CryptoPunks, the fully on-chain image from the CryptoPunksData
// contract and the owner from the original market contract), fetches the metadata from IPFS or the creator's host,
// and returns a resized, cross-origin image link for the game to hang on the wall. Nothing is copied or stored:
// the images stay where their creators put them. Results are kept for six hours (here and at the CDN).
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem'

export type Piece = {
  id: string; room: 'beeple' | 'yuga' | 'onchain' | 'culture'
  title: string; artist: string; year: number; collection: string
  contract: string; token: string; kind?: 'punk'; note: string
}

/** The exhibition. Titles and notes are the curator's; images, names and owners come from the chain. */
export const PIECES: Piece[] = [
  { id: 'beeple-5000', room: 'beeple', title: 'EVERYDAYS: THE FIRST 5000 DAYS', artist: 'Beeple (Mike Winkelmann)', year: 2021, collection: 'MakersPlace', contract: '0x2a46f2ffd99e19a89476e2f62270e0a35bbf0756', token: '40913', note: 'A picture a day from 1 May 2007 to 7 January 2021, all 5,000 in one collage. Sold at Christie’s in March 2021 for $69.3 million: the first purely digital work, sold as an NFT, at a major auction house.' },
  { id: 'beeple-human-one', room: 'beeple', title: 'HUMAN ONE', artist: 'Beeple (Mike Winkelmann)', year: 2021, collection: 'HUMAN ONE', contract: '0xa4c38796C35Dca618FE22a4e77F4210D0b0350d6', token: '1', note: 'A walking astronaut in a changing world. The NFT is paired with a physical video sculpture that the artist keeps updating; sold at Christie’s in November 2021.' },
  { id: 'bayc-8817', room: 'yuga', title: 'Bored Ape #8817', artist: 'Yuga Labs', year: 2021, collection: 'Bored Ape Yacht Club', contract: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', token: '8817', note: '10,000 apes, each a mix of traits. Owning an ape is the membership card, and the holder gets commercial rights to that ape.' },
  { id: 'bayc-3749', room: 'yuga', title: 'Bored Ape #3749', artist: 'Yuga Labs', year: 2021, collection: 'Bored Ape Yacht Club', contract: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', token: '3749', note: 'Traits are written in the token’s metadata on IPFS, so anyone can check what makes an ape rare.' },
  { id: 'bayc-1', room: 'yuga', title: 'Bored Ape #1', artist: 'Yuga Labs', year: 2021, collection: 'Bored Ape Yacht Club', contract: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', token: '1', note: 'Token #1 of 10,000. Apes were minted in April 2021 for 0.08 ETH each.' },
  { id: 'mayc-2', room: 'yuga', title: 'Mutant Ape #2', artist: 'Yuga Labs', year: 2021, collection: 'Mutant Ape Yacht Club', contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', token: '2', note: 'Mutants were made when an ape holder gave their ape a serum: a second collection that grew out of the first.' },
  { id: 'mayc-30001', room: 'yuga', title: 'Mega Mutant', artist: 'Yuga Labs', year: 2021, collection: 'Mutant Ape Yacht Club', contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', token: '30001', note: 'A Mega Mutant: the result of the rarest of the three serums, so only a handful exist.' },
  { id: 'punk-5822', room: 'onchain', title: 'CryptoPunk #5822', artist: 'Larva Labs', year: 2017, collection: 'CryptoPunks', contract: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2', token: '5822', kind: 'punk', note: 'One of nine alien punks. 10,000 punks of 24×24 pixels, given away free in 2017; the images themselves have been stored fully on-chain since 2021.' },
  { id: 'punk-7804', room: 'onchain', title: 'CryptoPunk #7804', artist: 'Larva Labs', year: 2017, collection: 'CryptoPunks', contract: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2', token: '7804', kind: 'punk', note: 'An alien punk with a pipe, cap and shades. This picture is drawn from data inside an Ethereum contract, not from a server.' },
  { id: 'punk-3100', room: 'onchain', title: 'CryptoPunk #3100', artist: 'Larva Labs', year: 2017, collection: 'CryptoPunks', contract: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2', token: '3100', kind: 'punk', note: 'An alien punk in a headband. Punks came before the ERC-721 standard; they helped inspire it.' },
  { id: 'squiggle-0', room: 'onchain', title: 'Chromie Squiggle #0', artist: 'Snowfro (Erick Calderon)', year: 2020, collection: 'Art Blocks Curated', contract: '0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a', token: '0', note: 'The first piece of the first Art Blocks project. The code that draws every squiggle is stored on-chain; each token’s hash picks its colours and shape.' },
  { id: 'fidenza-313', room: 'onchain', title: 'Fidenza #313', artist: 'Tyler Hobbs', year: 2021, collection: 'Art Blocks Curated', contract: '0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270', token: '78000313', note: 'A flow-field algorithm lays down blocks of colour that never overlap. 999 outputs, each decided at mint.' },
  { id: 'ringers-879', room: 'onchain', title: 'Ringers #879', artist: 'Dmitri Cherniak', year: 2021, collection: 'Art Blocks Curated', contract: '0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270', token: '13000879', note: 'A string wound around a grid of pegs: one rule, endless arrangements. #879 is known as “The Goose”.' },
  { id: 'azuki-9605', room: 'culture', title: 'Azuki #9605', artist: 'Chiru Labs', year: 2022, collection: 'Azuki', contract: '0xED5AF388653567Af2F388E6224dC7C4b3241C544', token: '9605', note: 'Anime-style characters; the collection grew into a brand with physical goods and events.' },
  { id: 'doodles-1', room: 'culture', title: 'Doodle #1', artist: 'Burnt Toast (Scott Martin)', year: 2021, collection: 'Doodles', contract: '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e', token: '1', note: 'Pastel, hand-drawn characters by the illustrator Burnt Toast.' },
  { id: 'pudgy-6873', room: 'culture', title: 'Pudgy Penguin #6873', artist: 'Pudgy Penguins', year: 2021, collection: 'Pudgy Penguins', contract: '0xBd3531dA5CF5857e7CfAA92426877b022e612cf8', token: '6873', note: 'Penguins that became plush toys sold in shops: one of the clearest paths from an NFT collection to everyday products.' },
  { id: 'wow-1', room: 'culture', title: 'World of Women #1', artist: 'Yam Karkai', year: 2021, collection: 'World of Women', contract: '0xe785E82358879F061BC3dcAC6f0444462D4b5330', token: '1', note: 'Portraits celebrating women, by artist Yam Karkai, with a community focused on bringing more women into Web3.' },
  { id: 'coolcats-1', room: 'culture', title: 'Cool Cat #1', artist: 'Clon', year: 2021, collection: 'Cool Cats', contract: '0x1A92f7381B9F03921564a437210bB9396471050C', token: '1', note: 'Blue cats dressed up in thousands of outfits, from an artist known as Clon.' },
]

const RPCS = ['https://ethereum-rpc.publicnode.com', 'https://cloudflare-eth.com', 'https://eth.llamarpc.com']
const META_GATEWAYS = ['https://ipfs.filebase.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://4everland.io/ipfs/']
const PUNK_MARKET = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB'
const abi = parseAbi([
  'function tokenURI(uint256) view returns (string)',
  'function ownerOf(uint256) view returns (address)',
  'function punkImageSvg(uint16) view returns (string)',
  'function punkIndexToAddress(uint256) view returns (address)',
])
type Fn = 'tokenURI' | 'ownerOf' | 'punkImageSvg' | 'punkIndexToAddress'

async function call(to: string, fn: Fn, arg: bigint | number, ms = 7000): Promise<string | null> {
  const data = encodeFunctionData({ abi, functionName: fn, args: [fn === 'punkImageSvg' ? Number(arg) : BigInt(arg)] as never })
  for (const rpc of RPCS) {
    try {
      const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }), signal: AbortSignal.timeout(ms) })
      const j = await r.json() as { result?: string }
      if (j.result && j.result !== '0x') return String(decodeFunctionResult({ abi, functionName: fn, data: j.result as `0x${string}` }))
    } catch { /* next RPC */ }
  }
  return null
}

/** The IPFS path inside an ipfs:// URI or a gateway URL, if any. */
export function ipfsPath(u: string): string | null {
  if (u.startsWith('ipfs://')) return u.slice(7).replace(/^ipfs\//, '')
  const m = /^https?:\/\/[^/]+\/ipfs\/(.+)$/.exec(u)
  return m ? m[1]! : null
}

/** Where the game loads an image from: a resized, cross-origin copy, and the direct link as a fallback. */
export function imageUrls(src: string, width = 900): { img: string; raw: string } {
  const p = ipfsPath(src)
  const fetchFrom = p ? `https://ipfs.filebase.io/ipfs/${p}` : src
  const raw = p ? `https://gateway.pinata.cloud/ipfs/${p}` : src
  return { img: `https://wsrv.nl/?url=${encodeURIComponent(fetchFrom)}&w=${width}&h=${width}&fit=inside&output=jpg&q=84`, raw }
}

async function metadata(uri: string): Promise<Record<string, unknown> | null> {
  if (uri.startsWith('data:application/json;base64,')) { try { return JSON.parse(Buffer.from(uri.split(',')[1]!, 'base64').toString('utf8')) } catch { return null } }
  if (uri.startsWith('data:application/json')) { try { return JSON.parse(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))) } catch { return null } }
  const p = ipfsPath(uri)
  const urls = p ? META_GATEWAYS.map((g) => g + p) : [uri]
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })
      if (!r.ok) continue
      return await r.json() as Record<string, unknown>
    } catch { /* next gateway */ }
  }
  return null
}

/** An SVG data URL safe for an <img> (raw '#' colours would end the URL early). */
export function svgUrl(s: string): string {
  if (!s.startsWith('data:image/svg+xml')) return s
  const comma = s.indexOf(',')
  const head = s.slice(0, comma)
  if (/;base64$/.test(head)) return s
  const body = s.slice(comma + 1)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(/%[0-9a-f]{2}/i.test(body) ? decodeURIComponent(body) : body)}`
}

export type Shown = Omit<Piece, 'kind'> & { name: string; desc: string; owner: string | null; img: string | null; raw: string | null; svg: string | null; onchain: boolean; chain: 'Ethereum'; etherscan: string }

async function resolve(p: Piece): Promise<Shown> {
  const base = { id: p.id, room: p.room, title: p.title, artist: p.artist, year: p.year, collection: p.collection, contract: p.contract, token: p.token, note: p.note, chain: 'Ethereum' as const }
  if (p.kind === 'punk') {
    const [svg, owner] = await Promise.all([call(p.contract, 'punkImageSvg', Number(p.token)), call(PUNK_MARKET, 'punkIndexToAddress', BigInt(p.token))])
    return { ...base, name: p.title, desc: '', owner, img: null, raw: null, svg: svg && svg.startsWith('data:image/svg') ? svgUrl(svg) : null, onchain: true, etherscan: `https://etherscan.io/address/${PUNK_MARKET}` }
  }
  const [uri, owner] = await Promise.all([call(p.contract, 'tokenURI', BigInt(p.token)), call(p.contract, 'ownerOf', BigInt(p.token))])
  const meta = uri ? await metadata(uri) : null
  const src = String(meta?.image ?? meta?.imageUrl ?? meta?.image_url ?? '')
  const onchain = !!uri && uri.startsWith('data:')
  const urls = src && !src.startsWith('data:') ? imageUrls(src) : null
  return {
    ...base, name: String(meta?.name ?? p.title), desc: String(meta?.description ?? '').replace(/\s+/g, ' ').slice(0, 240), owner, onchain,
    img: urls?.img ?? null, raw: urls?.raw ?? null, svg: src.startsWith('data:image/svg') ? svgUrl(src) : null,
    etherscan: `https://etherscan.io/nft/${p.contract.toLowerCase()}/${p.token}`,
  }
}

let cache: { at: number; items: Shown[] } | null = null
const TTL = 6 * 3600 * 1000
type Res = { status(n: number): { json(b: unknown): void }; setHeader?: (k: string, v: string) => void }

export async function galleryHandler(_req: unknown, res: Res) {
  const now = Date.now()
  if (!cache || now - cache.at > TTL) {
    const out = await Promise.all(PIECES.map((p) => Promise.race([
      resolve(p),
      new Promise<null>((done) => setTimeout(() => done(null), 14000)),
    ]).catch(() => null)))
    // Keep what was resolved before for any piece that did not answer this time.
    const items = PIECES.map((p, i) => {
      const fresh = out[i]
      const old = cache?.items.find((x) => x.id === p.id)
      return fresh && (fresh.img || fresh.svg) ? fresh : old ?? fresh
    }).filter((x): x is Shown => !!x)
    cache = { at: now, items }
  }
  const complete = cache.items.filter((x) => x.img || x.svg).length
  res.setHeader?.('cache-control', complete >= PIECES.length - 2 ? 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400' : 'public, max-age=60, s-maxage=120')
  return res.status(200).json({ at: cache.at, chain: 'Ethereum mainnet', items: cache.items, note: 'Read live from Ethereum. Each artwork belongs to its creator and holder; shown here for education, as any NFT viewer shows them. Grind District is not affiliated with these artists or collections.' })
}
