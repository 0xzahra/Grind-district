export type HouseId = 'yours' | 'adaeze' | 'malik' | 'nia' | 'vacant'
export type DoorSide = 'px' | 'nx' | 'pz' | 'nz'

export type House = {
  id: HouseId
  x: number
  z: number
  w: number
  d: number
  h: number
  door: DoorSide
  title: string
  subtitle: string
  spotTitle: string
  body: string
  enter: string
  seed: number
}

export const HOUSES: House[] = [
  {
    id: 'yours',
    x: 36,
    z: 32,
    w: 7,
    d: 6,
    h: 3.6,
    door: 'nx',
    title: 'Your house',
    subtitle: 'the key is yours',
    spotTitle: 'Your house',
    body: 'Front room, desk, and closet. Claim the room from inside. Messaging and voice are later.',
    enter: 'Go inside',
    seed: 31,
  },
  {
    id: 'adaeze',
    x: 52,
    z: 18,
    w: 6,
    d: 5,
    h: 3.4,
    door: 'nx',
    title: 'Notes',
    subtitle: 'course notes',
    spotTitle: 'Notes house',
    body: 'Learning-hall notes on paper. The door is open.',
    enter: 'Knock',
    seed: 33,
  },
  {
    id: 'malik',
    x: 52,
    z: 28,
    w: 6,
    d: 5,
    h: 3.4,
    door: 'nx',
    title: 'The set',
    subtitle: 'one set',
    spotTitle: 'Set house',
    body: 'Mats by the door. One set is logged and the chart stays outside.',
    enter: 'Knock',
    seed: 35,
  },
  {
    id: 'nia',
    x: 52,
    z: 40,
    w: 6,
    d: 5,
    h: 3.4,
    door: 'nx',
    title: 'Grove',
    subtitle: 'the grove',
    spotTitle: 'Grove house',
    body: 'Seedlings in the window. A pledge is a note that you showed up. This city does not retire a tonne.',
    enter: 'Knock',
    seed: 39,
  },
  {
    id: 'vacant',
    x: 36,
    z: 46,
    w: 6,
    d: 5,
    h: 3.2,
    door: 'nz',
    title: 'Vacant',
    subtitle: 'key on the hook',
    spotTitle: 'Vacant house',
    body: 'A made bed and no one home. The row still has a room for the next person.',
    enter: 'Look in',
    seed: 43,
  },
]

const IDS = new Set<string>(HOUSES.map((house) => house.id))

export function isHouseId(value: string): value is HouseId {
  return IDS.has(value)
}
