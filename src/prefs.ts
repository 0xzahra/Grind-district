import { getSave } from './state.ts'

export function applyPrefs(): void {
  const save = getSave()
  document.body.classList.toggle('hints-off', !save.hints)
  document.body.classList.toggle('map-large', save.mapSize === 'large')
  document.body.classList.toggle('reduce-motion', save.reduceMotion)
}
