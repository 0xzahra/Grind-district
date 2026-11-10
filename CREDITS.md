# Third-party assets and licences

All assets are free for commercial use. None are paid assets or ripped from games.

| Asset | Files | Author | Source | Licence |
|---|---|---|---|---|
| Microsoft Rocketbox Avatar Library: 10 rigged adults (Male_Adult_04/08/12/15, Business_Male_05, Female_Adult_01/06/10/11, Business_Female_01) and motion-capture clips (idle, walk, jog, run, talk) | public/models/people/*.glb, *.mask.png, motion-m.glb, motion-f.glb | Microsoft (original figures by Rocketbox Studios) | https://github.com/microsoft/Microsoft-Rocketbox | MIT (licence text in public/models/people/LICENSE-Rocketbox.txt) |
| RobotExpressive (Unit 4 robot) | public/models/chars/RobotExpressive.glb | Tomás Laulhé (three.js examples) | https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive | CC0 1.0 |
| Kloofendal 48d Partly Cloudy (Pure Sky) HDRI | public/tex/sky.hdr | Greg Zaal, Jarod Guest | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 1.0 |

Processing: tools/pack-rocketbox.mjs (each figure becomes one skinned mesh on a 23-bone rig with one 1024x640 WebP atlas, about 3,500 to 5,000 triangles, meshopt-compressed, plus a baked colour-region mask) and tools/pack-tex.mjs (512x256 HDRI).

## Nov 2026 (world and graphics overhaul)

The art direction moved to flat, faceted low-poly with painted finishes, so the photo-scanned PBR texture sets
(Poly Haven) and the Kenney Car Kit models were removed from `public/`. Surfaces are now painted in code
(`src/facets.ts`), buildings come from `src/architecture.ts`, and cars, display models, garments and props are
built in code (`src/cars.ts`, `src/showcase.ts`, `src/garments.ts`, `src/drinkStand.ts`). No new third-party
assets were added. The sky HDRI and the robot model above are still in use.

## Nov 2026 (people)

The blocky Quaternius people were replaced with semi-realistic rigged figures from the Microsoft Rocketbox
Avatar Library (MIT), with its motion-captured idle, walk, jog, run and talk clips. The city, cars and props
stay faceted low-poly. Outfit colours from the Boutique are applied to each figure's texture through a baked
region mask (skin, hair, top, bottom, shoes), so the wardrobe and the skin-tone and hair choices still work.
