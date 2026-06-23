# GAIA — Live Earth Sonification

A real-time ambient music system driven by live NASA EONET geophysical events.
Each event category plays one instrument in a continuous D minor jazz ensemble.
Rotate the globe and the instruments shift in 3D space around you.

## Setup

You need Node.js installed (https://nodejs.org — any version 18+).

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

## How it works

| Event category   | Instrument     | Sound character                        |
|-----------------|----------------|----------------------------------------|
| Wildfire         | Saxophone      | Hot melodic phrases, vibrato           |
| Volcano          | Double bass    | Deep walking bassline, low rumble      |
| Severe storm     | Drums          | Kick, snare, hi-hat swing kit          |
| Earthquake       | Piano          | Chord comping, occasional melodic fill |
| Flood            | Muted trumpet  | Lyrical counter-melody                 |
| Sea ice / Snow   | Vibraphone     | Sparse ringing sustained tones         |
| Dust / Haze      | Guitar         | Dry staccato chords                    |
| Temp extremes    | Clarinet       | Warm lyrical counter-line              |

## Controls

- **Drag** to rotate the globe
- **Scroll** to zoom
- **Click a marker** to see event details and source link
- **Enable sound** button — uses your geolocation so nearby events are louder

## Architecture notes (for portfolio / interviews)

**Data pipeline**: Polls NASA EONET `/api/v3/events` via a Vite dev proxy
(avoids CORS). Each event carries category, GeoJSON coordinates, timestamp.

**Globe**: TopoJSON world-atlas (Natural Earth 110m) projected onto a
THREE.js SphereGeometry via Canvas 2D. Every country on Earth, public domain data.

**Audio engine** (`src/audio.js`):
- Web Audio API, no external audio libraries
- Lookahead scheduler: schedules 1.5 bars ahead, ticks every 200ms — robust
  against browser throttling (same technique as Tone.js uses internally)
- Each instrument voice: oscillator → filter → ADSR gain envelope → instrument
  gain (proximity) → HRTF PannerNode → master → [dry + reverb]
- Drum kit: individual synthesis per hit — kick is sine sweep, snare is noise
  burst, hi-hat is high-passed noise
- Reverb: synthesised impulse response (exponential noise decay)
- Jazz harmony: ii-V-i-IV in D minor cycling at 76 BPM with swing offset

**Spatial audio**: Each instrument's 3D position is the centroid of all events
of that type, rotated to match current globe orientation. Uses Web Audio HRTF
panning — full sphere, not just stereo. Proximity (Haversine distance from
listener's geolocation) controls per-instrument gain.
