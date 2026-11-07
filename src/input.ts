export type FrameInput = {
  x: number
  y: number
  stick: number
  run: boolean
  lookX: number
  lookY: number
  zoom: number
  tap: { nx: number; ny: number } | null
  interact: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

export function createInput(canvas: HTMLCanvasElement, stick: HTMLElement, nub: HTMLElement): {
  read: () => FrameInput
  requestInteract: () => void
  discard: () => void
} {
  const down = new Set<string>()
  let joyX = 0
  let joyY = 0
  let stickId: number | null = null
  let originX = 0
  let originY = 0
  const maxRadius = 42

  let lookId: number | null = null
  let lastX = 0
  let lastY = 0
  let downX = 0
  let downY = 0
  let dragged = false
  let lookX = 0
  let lookY = 0
  let zoom = 0
  let pendingTap: { nx: number; ny: number } | null = null
  let interactQueued = false

  const placeNub = (dx: number, dy: number) => {
    nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
  }

  const moveStick = (event: PointerEvent) => {
    let dx = event.clientX - originX
    let dy = event.clientY - originY
    const mag = Math.hypot(dx, dy)
    if (mag > maxRadius) {
      dx = (dx / mag) * maxRadius
      dy = (dy / mag) * maxRadius
    }
    placeNub(dx, dy)
    joyX = dx / maxRadius
    joyY = -dy / maxRadius
  }

  stick.addEventListener('pointerdown', (event) => {
    try {
      stick.setPointerCapture(event.pointerId)
    } catch {
      // The pointer can vanish before capture, especially on a quick tap.
    }
    stickId = event.pointerId
    const rect = stick.getBoundingClientRect()
    originX = rect.left + rect.width / 2
    originY = rect.top + rect.height / 2
    moveStick(event)
    event.preventDefault()
  })

  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== stickId) return
    moveStick(event)
  })

  const endStick = (event: PointerEvent) => {
    if (event.pointerId !== stickId) return
    stickId = null
    joyX = 0
    joyY = 0
    placeNub(0, 0)
  }

  stick.addEventListener('pointerup', endStick)
  stick.addEventListener('pointercancel', endStick)

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 2) return
    lookId = event.pointerId
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Looking still works from move events if capture is unavailable.
    }
    lastX = downX = event.clientX
    lastY = downY = event.clientY
    dragged = false
  })

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookId) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) dragged = true
    lookX += dx
    lookY += dy
  })

  const endLook = (event: PointerEvent) => {
    if (event.pointerId !== lookId) return
    if (!dragged && event.button === 0 && document.elementFromPoint(event.clientX, event.clientY) === canvas) {
      const rect = canvas.getBoundingClientRect()
      pendingTap = {
        nx: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        ny: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      }
    }
    lookId = null
  }

  canvas.addEventListener('pointerup', endLook)
  canvas.addEventListener('pointercancel', (event) => {
    if (event.pointerId === lookId) lookId = null
  })

  canvas.addEventListener('contextmenu', (event) => event.preventDefault())

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      zoom += event.deltaY
    },
    { passive: false },
  )

  window.addEventListener('keydown', (event) => {
    if (isTyping(event.target)) return
    if (event.code.startsWith('Arrow')) event.preventDefault()
    if (event.code === 'KeyE' && !event.repeat) interactQueued = true
    down.add(event.code)
  })

  window.addEventListener('keyup', (event) => {
    down.delete(event.code)
  })

  window.addEventListener('blur', () => {
    down.clear()
    joyX = 0
    joyY = 0
    placeNub(0, 0)
  })

  return {
    discard() {
      if (lookId !== null && canvas.hasPointerCapture(lookId)) canvas.releasePointerCapture(lookId)
      if (stickId !== null && stick.hasPointerCapture(stickId)) stick.releasePointerCapture(stickId)
      lookId = stickId = null
      down.clear()
      joyX = joyY = lookX = lookY = zoom = 0
      pendingTap = null
      interactQueued = false
      placeNub(0, 0)
    },
    requestInteract() {
      interactQueued = true
    },
    read() {
      let keyX = 0
      let keyY = 0
      if (down.has('KeyW') || down.has('ArrowUp')) keyY += 1
      if (down.has('KeyS') || down.has('ArrowDown')) keyY -= 1
      if (down.has('KeyD') || down.has('ArrowRight')) keyX += 1
      if (down.has('KeyA') || down.has('ArrowLeft')) keyX -= 1

      const frame: FrameInput = {
        x: clamp(keyX + joyX, -1, 1),
        y: clamp(keyY + joyY, -1, 1),
        stick: Math.min(1, Math.hypot(joyX, joyY)),
        run: down.has('ShiftLeft') || down.has('ShiftRight'),
        lookX,
        lookY,
        zoom,
        tap: pendingTap,
        interact: interactQueued,
      }
      lookX = 0
      lookY = 0
      zoom = 0
      pendingTap = null
      interactQueued = false
      return frame
    },
  }
}
