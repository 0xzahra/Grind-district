// The Grind Metro's line and stations, shared by the train (metro.ts, loaded late) and the skyline (which keeps
// its towers clear of the viaduct). Plain numbers only, so importing this costs nothing.
export type StationId = 'beach' | 'marina' | 'raceway' | 'park' | 'skytower' | 'airport'
export const STATIONS: Array<{ id: StationId; title: string; at: [number, number]; street: [number, number] }> = [
  { id: 'beach', title: 'Beach', at: [-8, -70], street: [-8, -59.5] },
  { id: 'marina', title: 'Marina', at: [72, 8], street: [59, 8] },
  { id: 'airport', title: 'Airport', at: [150, 26], street: [141, 16] },
  { id: 'raceway', title: 'Raceway', at: [6, 74], street: [6, 59.5] },
  { id: 'park', title: 'Grind Park', at: [-122, 120], street: [-118, 123] },
  { id: 'skytower', title: 'Sky Tower', at: [-70, 10], street: [-59, 10] },
]
/** Stations reached only by train: arriving there opens the place itself (no street entrance). */
export const AWAY: StationId[] = ['park', 'airport']
// A closed loop round the city, with a branch out east to Grind International Airport and one south-west to
// Grind Park (each a narrow loop: out on one viaduct, back on the other).
export const CTRL: Array<[number, number]> = [
  [-55, -70], [-8, -70], [40, -70], [66, -62], [72, -30], [72, 8], [80, 22], [120, 26], [168, 26], [190, 33], [168, 40], [120, 40], [84, 46], [64, 66], [40, 74], [6, 74], [-30, 74],
  [-58, 82], [-92, 106], [-122, 120], [-128, 96], [-100, 74], [-74, 50], [-70, 10], [-68, -30], [-64, -60],
]
