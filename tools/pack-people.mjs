// Packs the Quaternius CC0 animated people (poly.pizza) for the web: keep Idle/Walk/Run, resample, weld, quantize, meshopt.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { resample, prune, dedup, weld, quantize, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
const SRC = process.env.SRC ?? '/workspace/gd/assets/'
const MAP = {
  man1: 'e6019b9f-aed0-400c-8df4-ce5b648e9b82', man2: '3746be88-6799-4817-929b-6bc067c47caa',
  man3: '985eacbf-9dde-44b7-9270-4e35c8400b13', man4: '66b57880-bcb0-479a-8d72-5c3e88afaa39',
  woman1: '51d5abdd-bb87-4b8d-9967-21738ffb8437', woman2: '906a0cbe-b0a4-4312-b898-0f974b6f6771',
  woman3: '9a6a3e55-23ce-4d5c-89bc-7d3f30307ed0', woman4: 'a642af96-e239-4c5f-b50d-7661ff51deec',
}
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
for (const [name, id] of Object.entries(MAP)) {
  const doc = await io.read(SRC + id + '.glb')
  for (const a of doc.getRoot().listAnimations()) {
    const n = a.getName()
    if (!/_(Idle|Walk|Run)$/.test(n)) a.dispose(); else a.setName(n.split('_').pop())
  }
  await doc.transform(prune(), dedup(), resample(), weld(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await io.write(`public/models/people/${name}.glb`, doc)
}
