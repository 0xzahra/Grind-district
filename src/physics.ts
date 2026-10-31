export const CITY_LIMIT = 62
export const PLAYER_R = 0.42

export type Circle = { kind: 'circle'; x: number; z: number; r: number }
export type Box = { kind: 'box'; x: number; z: number; hx: number; hz: number }
export type Obstacle = Circle | Box

export type Vec = { x: number; z: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function pushCircle(pos: Vec, vel: Vec, obstacle: Circle, radius: number): void {
  const dx = pos.x - obstacle.x
  const dz = pos.z - obstacle.z
  const min = obstacle.r + radius
  const distSq = dx * dx + dz * dz
  if (distSq >= min * min) return
  const dist = Math.sqrt(distSq) || 0.0001
  const nx = dx / dist
  const nz = dz / dist
  const push = min - dist
  pos.x += nx * push
  pos.z += nz * push
  const into = vel.x * nx + vel.z * nz
  if (into < 0) {
    vel.x -= into * nx
    vel.z -= into * nz
  }
}

function pushBox(pos: Vec, vel: Vec, box: Box, radius: number): void {
  const minX = box.x - box.hx
  const maxX = box.x + box.hx
  const minZ = box.z - box.hz
  const maxZ = box.z + box.hz
  const closestX = clamp(pos.x, minX, maxX)
  const closestZ = clamp(pos.z, minZ, maxZ)
  let dx = pos.x - closestX
  let dz = pos.z - closestZ
  const distSq = dx * dx + dz * dz
  if (distSq >= radius * radius) return
  if (distSq > 1e-10) {
    const dist = Math.sqrt(distSq)
    const nx = dx / dist
    const nz = dz / dist
    const push = radius - dist
    pos.x += nx * push
    pos.z += nz * push
    const into = vel.x * nx + vel.z * nz
    if (into < 0) {
      vel.x -= into * nx
      vel.z -= into * nz
    }
    return
  }
  const penLeft = pos.x - minX
  const penRight = maxX - pos.x
  const penNorth = pos.z - minZ
  const penSouth = maxZ - pos.z
  const least = Math.min(penLeft, penRight, penNorth, penSouth)
  if (least === penLeft) {
    pos.x = minX - radius
    if (vel.x > 0) vel.x = 0
  } else if (least === penRight) {
    pos.x = maxX + radius
    if (vel.x < 0) vel.x = 0
  } else if (least === penNorth) {
    pos.z = minZ - radius
    if (vel.z > 0) vel.z = 0
  } else {
    pos.z = maxZ + radius
    if (vel.z < 0) vel.z = 0
  }
}

export function resolveCollision(pos: Vec, vel: Vec, obstacles: readonly Obstacle[], radius: number, unbounded = false): void {
  if (unbounded) {
    /* interiors live outside the city square */
  } else if (pos.x > CITY_LIMIT) {
    pos.x = CITY_LIMIT
    if (vel.x > 0) vel.x = 0
  } else if (pos.x < -CITY_LIMIT) {
    pos.x = -CITY_LIMIT
    if (vel.x < 0) vel.x = 0
  }
  if (unbounded) {
    /* skip */
  } else if (pos.z > CITY_LIMIT) {
    pos.z = CITY_LIMIT
    if (vel.z > 0) vel.z = 0
  } else if (pos.z < -CITY_LIMIT) {
    pos.z = -CITY_LIMIT
    if (vel.z < 0) vel.z = 0
  }
  for (let pass = 0; pass < 3; pass += 1) {
    for (const obstacle of obstacles) {
      if (obstacle.kind === 'circle') pushCircle(pos, vel, obstacle, radius)
      else pushBox(pos, vel, obstacle, radius)
    }
  }
}

export function blocked(obstacles: readonly Obstacle[], x: number, z: number, radius: number): boolean {
  if (Math.abs(x) > CITY_LIMIT - 0.2 || Math.abs(z) > CITY_LIMIT - 0.2) return true
  for (const obstacle of obstacles) {
    if (obstacle.kind === 'circle') {
      const dx = x - obstacle.x
      const dz = z - obstacle.z
      const min = obstacle.r + radius
      if (dx * dx + dz * dz < min * min) return true
      continue
    }
    const closestX = clamp(x, obstacle.x - obstacle.hx, obstacle.x + obstacle.hx)
    const closestZ = clamp(z, obstacle.z - obstacle.hz, obstacle.z + obstacle.hz)
    const dx = x - closestX
    const dz = z - closestZ
    if (dx * dx + dz * dz < radius * radius) return true
  }
  return false
}
