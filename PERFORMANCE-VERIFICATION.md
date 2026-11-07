# Step 6 performance verification

Implemented presets (not measured FPS claims):

| Preset | DPR cap | Shadows | Map | Point lights | Noncolliding decor |
| --- | --- | --- | --- | --- | --- |
| Low | 1 | off | 512 unused | 0 | every fourth |
| Medium | 1.5 | on | 1024 | 2 (plaza, campus) | every second |
| High | 2 | on | 2048 | 4 (previously 6) | all |

Hemi/sun/fill remain. Changes occur on Settings close through SceneGate. Both existing cached and lazily entered room decoration receive the selected tier. Density touches only skyline and explicitly noncolliding room decoration, never colliders/furniture/targets. Traffic gameplay/counts are unchanged by this patch; Claude's proposal to vary colliding cars was deliberately not used. MSAA remains the existing context configuration, not falsely advertised as runtime-switchable.

Clear redundant work removed: DOM place refresh only when place changes, minimap at 10Hz instead of each frame, one shared skyline material, no redundant setPixelRatio call when unchanged. No claimed diagnosis of the reported one-minute entry or sliding.

Open preview with `?debugMetrics=1` and inspect `window.__grindPerformance`. Opt-in local-only numeric diagnostics: main-to-fonts/renderer/mascot/world/compile/first-render phase times, last 600 raw frame intervals (not movement-dt clipped), median/estimated FPS, render calls/triangles/programs, tier/DPR/shadows/light/decor counts and paused/indoors booleans. No identifiers, account fields, transmissions or paid telemetry. `?debugScene=1` additionally exposes pose/resize counters for scene freeze checks. Initial JS download/auth before main() is NOT included in the main-to-walkable number; record navigation/Enter-to-walkable separately in browser tools.

Required pending acceptance: run same plaza -> home -> campus loop in each preset with 4x CPU slowdown and mid-range Android viewport/network settings. Record cold navigation and Enter-to-walkable separately, FPS/frame stalls, draw calls, shader program count, actual counts and menu resize stability. Test real mid-range Android too: CPU emulation does not throttle a desktop GPU. Test course completion/CV, profile pages and top-up screen against live, separating intentional UI/room changes from regressions. No phone/browser performance test has been performed in this executor.

Preset changes may cause a first-use shader compilation hitch; do not promise zero stalls. Home zoom-out/pinch and sliding movement remain acceptance observations, not new features implemented beyond the six-step scope.
