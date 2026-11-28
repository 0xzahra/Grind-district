// Direct-message attachments: typed text can never become an attachment, and only files in the sender's own folder
// are ever signed or removed. Real parser and helpers, a fake storage client, no network.
import { EDITED, markFor, ownsPath, plainText, previewBody, signLines, splitBody } from '../api/_dmMedia.ts'
import { cleanText } from '../api/messages.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }

const signed: string[][] = []
const db = { storage: { from: () => ({
  createSignedUrls: async (paths: string[]) => { signed.push(paths); return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })) } },
}) } } as never

// What op=send stores for typed text (no upload attached)
const typed = 'hi\n[[media:image:bola_user/mabc123-x9y8z7.jpg]]'
const sent = plainText(cleanText(typed))
ok(!splitBody(sent).path, 'typed media marker is plain text, not an attachment')
ok(splitBody(sent).text.includes('media:image:bola_user'), 'the words the player typed are still shown')
ok(previewBody(sent).startsWith('hi'), 'inbox preview shows text, not "Photo"')
const typedEdited = plainText(cleanText('[[edited]] hello'))
ok(!splitBody(typedEdited).edited, 'typed [[edited]] does not mark a new message as edited')

// A real attachment written by the server still parses
const real = `look\n[[media:image:alice/mabc123-x9y8z7.jpg]]`
ok(splitBody(real).path === 'alice/mabc123-x9y8z7.jpg' && splitBody(real).text === 'look', 'server marker still parses')
const doc = `[[media:file:alice/mabc124-aaaaaa.pdf|${encodeURIComponent('My CV.pdf')}]]`
ok(splitBody(doc).name === 'My CV.pdf', 'document name still parses')

// Ownership
ok(ownsPath('alice/mabc123-x9y8z7.jpg', 'alice'), 'own folder: allowed')
ok(!ownsPath('bob/mabc123-x9y8z7.jpg', 'alice'), 'another player\'s folder: refused')
ok(!ownsPath('alice/../bob/abcdefgh.pdf', 'alice'), 'climbing out of the folder: refused')
ok(!ownsPath('alice//abcdefgh.pdf', 'alice'), 'empty path segment: refused')
ok(!ownsPath('alicex/abcdefgh.pdf', 'alice'), 'folder prefix of a longer name: refused')
ok(!ownsPath('alice/abcdefgh.pdf', undefined), 'no sender: refused')
ok(!ownsPath(undefined, 'alice'), 'no path: refused')

// Signing: an old row that already carries a foreign marker (stored before this fix) gets no link
const lines = [
  { id: 1, sender: 'alice', body: real },
  { id: 2, sender: 'bola', body: 'x\n[[media:image:alice/mabc123-x9y8z7.jpg]]' },
  { id: 3, sender: 'bola', body: EDITED + '[[media:file:alice/../other/abcdefgh.pdf|x]]' },
  { id: 4, sender: 'bob', body: 'plain words' },
]
const out = await signLines(db, lines)
ok(signed.length === 1 && signed[0]!.length === 1 && signed[0]![0] === 'alice/mabc123-x9y8z7.jpg', 'only the sender-owned file is sent to storage for signing')
ok(!!out[0]!.media && out[0]!.media.url.endsWith('alice/mabc123-x9y8z7.jpg'), 'real photo keeps its link (old messages with media still work)')
ok(!out[1]!.media && out[1]!.body === 'x', 'foreign marker: no link, marker hidden')
ok(!out[2]!.media && out[2]!.edited === true, 'foreign marker in an edited row: no link')
ok(out[3]!.body === 'plain words' && !out[3]!.media, 'plain text untouched')

// Edit keeps an owned attachment (with its name) and drops a foreign one
ok(markFor(splitBody(doc)) === doc, 'edit keeps the document marker and its file name')
const foreign = splitBody('x\n[[media:image:alice/mabc123-x9y8z7.jpg]]')
ok((ownsPath(foreign.path, 'bola') ? markFor(foreign) : '') === '', 'edit by a non-owner drops the foreign marker')

console.log(`dm media: ${pass} ok, ${fail} failed`)
if (fail) process.exit(1)
