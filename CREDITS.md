# Third-party assets and licences

All assets are free for commercial use. None are paid assets or ripped from games.

| Asset | Files | Author | Source | Licence |
|---|---|---|---|---|
| Animated Men Pack (4 rigged people: Idle/Walk/Run kept) | public/models/people/man1-4.glb | Quaternius | https://poly.pizza/bundle/Animated-Men-Pack-DAC9SDgMQT (models: /m/DLptRuewTn, /m/HMnuH5geEG, /m/fjHyMd5Wxw, /m/mQnGoME1ez) | CC0 1.0 |
| Animated Women Pack (4 rigged people: Idle/Walk/Run kept) | public/models/people/woman1-4.glb | Quaternius | https://poly.pizza/bundle/Animated-Women-Pack-HHSKxnk1mY (models: /m/jpKRgGDxhk, /m/AQsd9ngvKU, /m/XqzeZGB7iU, /m/zMyPlQXBzq) | CC0 1.0 |
| RobotExpressive (Unit 4 robot) | public/models/chars/RobotExpressive.glb | Tomás Laulhé (three.js examples) | https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive | CC0 1.0 |
| Kloofendal 48d Partly Cloudy (Pure Sky) HDRI | public/tex/sky.hdr | Greg Zaal, Jarod Guest | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 1.0 |

Processing: tools/pack-people.mjs (meshopt compression, quantised, only 3 animations kept) and tools/pack-tex.mjs (512x256 HDRI).

## Nov 2026 (world and graphics overhaul)

The art direction moved to flat, faceted low-poly with painted finishes, so the photo-scanned PBR texture sets
(Poly Haven) and the Kenney Car Kit models were removed from `public/`. Surfaces are now painted in code
(`src/facets.ts`), buildings come from `src/architecture.ts`, and cars, display models, garments and props are
built in code (`src/cars.ts`, `src/showcase.ts`, `src/garments.ts`, `src/drinkStand.ts`). No new third-party
assets were added. The sky HDRI and the people and robot models above are still in use.
