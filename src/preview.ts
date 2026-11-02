import * as THREE from 'three'
import { assetUrl } from './assets.ts'
import { createCrowd } from './npcs.ts'
import { rankFor, type Graphics, type TimeOfDay } from './logic.ts'
import { getSave } from './state.ts'
import { createTraffic } from './traffic.ts'
import { createWorld } from './world.ts'

function loadMark(): Promise<THREE.Texture> {
  return assetUrl('/brand/shrimp.png', '/brand/shrimp.b64', 'image/png', 0x89).then((url) => (
    new Promise<THREE.Texture>((resolve, reject) => {
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
        resolve(texture)
      }, undefined, () => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
        reject(new Error('Could not load the district mark.'))
      })
    })
  ))
}

function phaseFor(time: TimeOfDay): number {
  if (time === 'day') return 0.42
  if (time === 'dusk') return 0.74
  return 0.02
}

function drawFallbackCity(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d')
  if (!context) {
    canvas.hidden = true
    return () => {}
  }

  const draw = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    const sky = context.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#111916')
    sky.addColorStop(0.5, '#26352d')
    sky.addColorStop(1, '#090d0b')
    context.fillStyle = sky
    context.fillRect(0, 0, width, height)

    const glow = context.createRadialGradient(width * 0.52, height * 0.5, 0, width * 0.52, height * 0.5, width * 0.68)
    glow.addColorStop(0, 'rgba(33, 243, 143, 0.22)')
    glow.addColorStop(1, 'rgba(33, 243, 143, 0)')
    context.fillStyle = glow
    context.fillRect(0, 0, width, height)

    const horizon = height * 0.54
    for (let index = 0; index < 30; index += 1) {
      const seed = (index * 37 + 19) % 101 / 101
      const x = index * width / 30
      const buildingWidth = width / 30 * (0.72 + seed * 0.35)
      const buildingHeight = height * (0.09 + seed * 0.29)
      const top = horizon - buildingHeight
      context.fillStyle = index % 3 === 0 ? '#18221d' : '#111915'
      context.fillRect(x, top, buildingWidth, buildingHeight)
      context.fillStyle = 'rgba(194, 235, 198, 0.28)'
      const rows = Math.max(2, Math.floor(buildingHeight / 15))
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          if ((index + row * 2 + column * 5) % 4 === 0) continue
          context.fillRect(x + 5 + column * 8, top + 7 + row * 12, 3, 4)
        }
      }
    }

    context.fillStyle = '#111916'
    context.beginPath()
    context.moveTo(width * 0.48, horizon)
    context.lineTo(0, height)
    context.lineTo(width, height)
    context.lineTo(width * 0.57, horizon)
    context.closePath()
    context.fill()

    context.lineWidth = 1
    context.strokeStyle = 'rgba(202, 236, 208, 0.16)'
    for (let index = 0; index <= 10; index += 1) {
      const x = index / 10 * width
      context.beginPath()
      context.moveTo(width * 0.52, horizon)
      context.lineTo(x, height)
      context.stroke()
    }
    for (let index = 1; index <= 7; index += 1) {
      const progress = index / 8
      const y = horizon + (height - horizon) * progress * progress
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.stroke()
    }

    const blocks = [
      [0.08, 0.62, 0.13, 0.19], [0.27, 0.67, 0.12, 0.16], [0.72, 0.63, 0.14, 0.21],
      [0.9, 0.7, 0.09, 0.15], [0.38, 0.78, 0.1, 0.12], [0.59, 0.76, 0.11, 0.13],
    ]
    for (const [x, y, blockWidth, blockHeight] of blocks) {
      const left = width * x
      const top = height * y
      const right = left + width * blockWidth
      const bottom = top + height * blockHeight
      context.fillStyle = '#25372c'
      context.fillRect(left, top, right - left, bottom - top)
      context.fillStyle = '#17231c'
      context.beginPath()
      context.moveTo(right, top)
      context.lineTo(right + width * 0.025, top - height * 0.025)
      context.lineTo(right + width * 0.025, bottom - height * 0.025)
      context.lineTo(right, bottom)
      context.closePath()
      context.fill()
      context.strokeStyle = 'rgba(33, 243, 143, 0.42)'
      context.strokeRect(left + 2, top + 2, right - left - 4, bottom - top - 4)
    }

    context.fillStyle = '#21f38f'
    for (const [x, y] of [[0.47, 0.74], [0.68, 0.66], [0.33, 0.57], [0.83, 0.81]]) {
      context.beginPath()
      context.arc(width * x, height * y, Math.max(2, width * 0.0025), 0, Math.PI * 2)
      context.fill()
    }
  }

  canvas.hidden = false
  draw()
  window.addEventListener('resize', draw)
  return () => {
    window.removeEventListener('resize', draw)
    canvas.hidden = true
  }
}

export async function startPreview(canvas: HTMLCanvasElement): Promise<() => void> {
  const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820
  const graphics: Graphics = mobile ? 'low' : 'medium'
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: false,
      powerPreference: mobile ? 'low-power' : 'high-performance',
      failIfMajorPerformanceCaveat: false,
    })
  } catch {
    return drawFallbackCity(canvas)
  }

  try {
    const save = getSave()
    const time = save.timeOfDay
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || save.reduceMotion
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 260)
    const mark = await loadMark()
    const dimensions = mark.image as { width?: number; height?: number }
    const world = createWorld({
      scene,
      anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
      mark,
      aspect: dimensions.width && dimensions.height ? dimensions.height / dimensions.width : 0.86,
      reduceMotion,
      rankLabel: rankFor(save.xp).label,
      getSeries: () => ({ unit: [], meme: [] }),
    })
    const crowd = createCrowd(scene)
    const traffic = createTraffic(scene, world.lanes, graphics)

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.88
    renderer.shadowMap.enabled = !mobile
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.setPixelRatio(Math.min(mobile ? 0.8 : 1.5, window.devicePixelRatio || 1))
    world.setGraphics(graphics)
    crowd.setGraphics(graphics)
    world.setLook({ time })
    world.setDaylight(phaseFor(time))
    world.sun.castShadow = !mobile
    const shadowSize = mobile ? 512 : 1024
    world.sun.shadow.mapSize.set(shadowSize, shadowSize)

    const focus = new THREE.Vector3(0, 0, 0)
    let frame = 0
    let previous = performance.now()
    let elapsed = 0
    let lastDraw = 0
    const frameInterval = mobile ? 1000 / 30 : 1000 / 45
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      if (document.hidden || now - lastDraw < frameInterval) return
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      lastDraw = now
      elapsed += dt

      const angle = 0.6 + (reduceMotion ? 0 : elapsed * 0.035)
      const radius = 30 + (reduceMotion ? 0 : Math.sin(elapsed * 0.07) * 4)
      camera.position.set(Math.cos(angle) * radius, 20 + (reduceMotion ? 0 : Math.sin(elapsed * 0.11) * 3), Math.sin(angle) * radius)
      focus.set(Math.cos(angle + 2.4) * 6, 3, Math.sin(angle + 2.4) * 6)
      camera.lookAt(focus)

      world.tick(elapsed, focus)
      const motionDt = reduceMotion ? 0 : dt
      const people = crowd.tick(motionDt)
      traffic.tick(motionDt, elapsed, focus, people)
      renderer.render(scene, camera)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      mark.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    }
  } catch {
    renderer.dispose()
    canvas.hidden = true
    return () => {}
  }
}
