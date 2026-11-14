# City sound — recorded layers and licences

The street and room ambience has two parts:

1. **Procedural bed** (`src/ambient-audio.ts`): synthesised with Web Audio, so it starts at once with no download.
2. **Recorded layers** (`src/soundscape.ts` and `public/audio/*.mp3`): these load lazily, one file at a time, only after
   the city is open and City sound is on. They are skipped when the browser's Data Saver is on. Everything goes through
   the same buses, so the City sound switch and volume slider control both parts.

All the recordings are **CC0 1.0 (public domain dedication)** by Joseph Sardin / BigSoundBank (LaSonothèque) unless noted.
Licence page: https://bigsoundbank.com/droit.html. No attribution is required; we credit them anyway.
Each file was cut to a short excerpt, converted to mono at 22.05 kHz and 32 kbps MP3, loudness-normalised, and
crossfaded into a seamless loop where it is a bed.

| File | What it is in game | Source recording | Excerpt |
|---|---|---|---|
| `traffic.mp3` | Distant traffic bed (quieter at night) | [Street and Roads #608](https://bigsoundbank.com/street-and-roads-s0608.html) | 0:30–0:52 |
| `chatter.mp3` | Plaza / market murmur, louder near the plaza | [Pedestrian Place #526](https://bigsoundbank.com/pedestrian-place-s0526.html) | 0:12–0:34 |
| `birds.mp3` | Daytime birds (fade at night and in rain) | [Birds Waking #2 #935](https://bigsoundbank.com/wake-birds-2-s0935.html) | 0:18–0:40 |
| `leaves.mp3` | Wind in the trees | [Wind in a Tree #659](https://bigsoundbank.com/wind-in-a-tree-s0659.html) | 0:40–0:58 |
| `crickets.mp3` | Night insects | [Campaign at Night #4 #1880](https://bigsoundbank.com/campaign-at-night-4-s1880.html) | 0:00–0:18 |
| `rain.mp3` | Rain, follows the in-game shower | [Rain on Concrete #1289](https://bigsoundbank.com/rain-on-concrete-s1289.html) | 0:02–0:16 |
| `interior.mp3` | Quiet café / room tone indoors | [Coffee Shop at the Capucins #2561](https://bigsoundbank.com/coffee-shop-at-the-capucins-s2561.html) | 0:17–0:35 |
| `hum.mp3` | AC hum indoors; faint generator outside at night | [Air-conditioner #1471](https://bigsoundbank.com/air-conditioner-s1471.html) | 0:10–0:16 |
| `steps.mp3` | Passers-by footsteps | [Fast Steps on Concrete #1318](https://bigsoundbank.com/fast-steps-on-concrete-s1318.html) | 0:00–0:10 |
| `horn1.mp3` | Random car horn (positional) | [Recent Car Horn #2 #258](https://bigsoundbank.com/recent-car-horn-2-s0258.html) | whole |
| `horn2.mp3` | Random car horn (positional) | [Recent Car Horn #7 #969](https://bigsoundbank.com/recent-car-horn-7-s0969.html) | 0:00–0:02.2 |
| `horn3.mp3` | Random truck horn (positional) | [Truck Horn #2721](https://bigsoundbank.com/truck-horn-s2721.html) | whole |
| `dog.mp3` | Rare distant dog (positional) | [Old Dog Barking #2 #2353](https://bigsoundbank.com/old-dog-barking-2-s2353.html) | 0:00–0:05.5 |
| `siren.mp3` | Rare far-off siren passing (positional) | [Gendarmerie Siren, Passage #2029](https://bigsoundbank.com/gendarmerie-siren-passage-s2029.html) | 0:02–0:19 |

Total size: about 720 KB for 14 files. Nothing loads before the city is open.

## How it behaves

- **Day/night**: birds, chatter and footsteps by day; crickets, less traffic and a faint generator hum at night.
- **Rain**: the rain layer follows `weather.rain()`, and birds, chatter and steps duck under it.
- **Indoors**: café room tone and AC hum, with the street heard faintly through the walls (low-passed).
- **Positional one-shots**: horns, the dog and the siren come from a point in the world around the player. They are
  quieter and duller with distance and panned left or right from the camera's facing. The siren drifts across.
- **Mute/volume**: the City sound switch suspends the whole audio graph, and the volume slider sets the master gain.

To add a sound, use only CC0 or similarly licensed audio, keep it mono, short and small, and add a row above.
