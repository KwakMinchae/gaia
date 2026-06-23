// Audio engine — plays Suno jazz track with spatial positioning + crossfade loop

export class JazzEngine {
  constructor() {
    this.ac = null
    this.master = null
    this.panner = null
    this.sourceA = null
    this.sourceB = null
    this.gainA = null
    this.gainB = null
    this.buffer = null
    this.active = false
    this.crossfadeDuration = 4.0   // seconds to crossfade at loop point
    this.crossfadeTimer = null
    this.currentSource = 'A'
    this.instGains = {}            // kept for compatibility with main.js
    this.instPanners = {}
    this.activeInsts = new Set()
  }

  async start() {
    this.ac = new (window.AudioContext || window.webkitAudioContext)()
    if (this.ac.state === 'suspended') await this.ac.resume()

    // Master chain
    this.master = this.ac.createGain()
    this.master.gain.value = 0.9

    // Warm reverb — small jazz club
    const reverb = this.ac.createConvolver()
    const len = this.ac.sampleRate * 1.8
    const buf = this.ac.createBuffer(2, len, this.ac.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2)
    }
    reverb.buffer = buf

    const dry = this.ac.createGain(); dry.gain.value = 0.7
    const wet = this.ac.createGain(); wet.gain.value = 0.3
    this.master.connect(dry); dry.connect(this.ac.destination)
    this.master.connect(wet); wet.connect(reverb); reverb.connect(this.ac.destination)

    // Single HRTF panner for the whole track
    // Position shifts as user rotates globe
    this.panner = this.ac.createPanner()
    this.panner.panningModel = 'HRTF'
    this.panner.distanceModel = 'linear'
    this.panner.refDistance = 1
    this.panner.maxDistance = 20
    this.panner.rolloffFactor = 0.5
    if (this.panner.positionX) {
      this.panner.positionX.value = 0
      this.panner.positionY.value = 0
      this.panner.positionZ.value = 5
    } else {
      this.panner.setPosition(0, 0, 5)
    }
    this.panner.connect(this.master)

    // Listener faces -Z
    if (this.ac.listener.positionX) {
      this.ac.listener.positionX.value = 0
      this.ac.listener.positionY.value = 0
      this.ac.listener.positionZ.value = 0
      this.ac.listener.forwardX.value = 0
      this.ac.listener.forwardY.value = 0
      this.ac.listener.forwardZ.value = -1
      this.ac.listener.upX.value = 0
      this.ac.listener.upY.value = 1
      this.ac.listener.upZ.value = 0
    } else {
      this.ac.listener.setPosition(0, 0, 0)
      this.ac.listener.setOrientation(0, 0, -1, 0, 1, 0)
    }

    // Two gain nodes for crossfading between loops
    this.gainA = this.ac.createGain(); this.gainA.gain.value = 1
    this.gainB = this.ac.createGain(); this.gainB.gain.value = 0
    this.gainA.connect(this.panner)
    this.gainB.connect(this.panner)

    // Load the track
    await this._loadTrack()
    this.active = true
    this._playSource('A')
  }

  async _loadTrack() {
    const response = await fetch('/Midnight_Swing.mp3')
    const arrayBuffer = await response.arrayBuffer()
    this.buffer = await this.ac.decodeAudioData(arrayBuffer)
  }

  _playSource(which) {
    if (!this.buffer || !this.active) return
    const duration = this.buffer.duration
    const fadeStart = duration - this.crossfadeDuration

    if (which === 'A') {
      if (this.sourceA) { try { this.sourceA.stop() } catch(e) {} }
      this.sourceA = this.ac.createBufferSource()
      this.sourceA.buffer = this.buffer
      this.sourceA.connect(this.gainA)
      this.sourceA.start(this.ac.currentTime)
      this.gainA.gain.setValueAtTime(1, this.ac.currentTime)
      this.currentSource = 'A'

      // Schedule crossfade to B
      const timeToFade = (fadeStart * 1000) - 50
      if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer)
      this.crossfadeTimer = setTimeout(() => this._crossfadeTo('B'), timeToFade)

    } else {
      if (this.sourceB) { try { this.sourceB.stop() } catch(e) {} }
      this.sourceB = this.ac.createBufferSource()
      this.sourceB.buffer = this.buffer
      this.sourceB.connect(this.gainB)
      this.sourceB.start(this.ac.currentTime)
      this.gainB.gain.setValueAtTime(1, this.ac.currentTime)
      this.currentSource = 'B'

      const timeToFade = (fadeStart * 1000) - 50
      if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer)
      this.crossfadeTimer = setTimeout(() => this._crossfadeTo('A'), timeToFade)
    }
  }

  _crossfadeTo(next) {
    if (!this.active || !this.ac) return
    const now = this.ac.currentTime
    const dur = this.crossfadeDuration

    if (next === 'B') {
      // Fade out A, start and fade in B
      this.gainA.gain.setValueAtTime(1, now)
      this.gainA.gain.linearRampToValueAtTime(0, now + dur)

      if (this.sourceB) { try { this.sourceB.stop() } catch(e) {} }
      this.sourceB = this.ac.createBufferSource()
      this.sourceB.buffer = this.buffer
      this.sourceB.connect(this.gainB)
      this.gainB.gain.setValueAtTime(0, now)
      this.gainB.gain.linearRampToValueAtTime(1, now + dur)
      this.sourceB.start(now)
      this.currentSource = 'B'

      const timeToFade = (this.buffer.duration - this.crossfadeDuration) * 1000 - 50
      if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer)
      this.crossfadeTimer = setTimeout(() => this._crossfadeTo('A'), timeToFade)

    } else {
      // Fade out B, start and fade in A
      this.gainB.gain.setValueAtTime(1, now)
      this.gainB.gain.linearRampToValueAtTime(0, now + dur)

      if (this.sourceA) { try { this.sourceA.stop() } catch(e) {} }
      this.sourceA = this.ac.createBufferSource()
      this.sourceA.buffer = this.buffer
      this.sourceA.connect(this.gainA)
      this.gainA.gain.setValueAtTime(0, now)
      this.gainA.gain.linearRampToValueAtTime(1, now + dur)
      this.sourceA.start(now)
      this.currentSource = 'A'

      const timeToFade = (this.buffer.duration - this.crossfadeDuration) * 1000 - 50
      if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer)
      this.crossfadeTimer = setTimeout(() => this._crossfadeTo('B'), timeToFade)
    }
  }

  stop() {
    this.active = false
    if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer)
    this.crossfadeTimer = null
    try { this.sourceA && this.sourceA.stop() } catch(e) {}
    try { this.sourceB && this.sourceB.stop() } catch(e) {}
    if (this.master) { try { this.master.disconnect() } catch(e) {} }
    this.master = null
    this.panner = null
    this.gainA = null
    this.gainB = null
    this.instGains = {}
    this.instPanners = {}
    this.activeInsts = new Set()
  }

  // Spatial positioning — called as globe rotates
  // x, y, z are the averaged world-space position of active events
  setGlobalPosition(x, y, z) {
    if (!this.panner || !this.ac) return
    const s = 8
    const t = this.ac.currentTime
    const T = 0.1
    if (this.panner.positionX) {
      this.panner.positionX.setTargetAtTime(x * s, t, T)
      this.panner.positionY.setTargetAtTime(y * s, t, T)
      this.panner.positionZ.setTargetAtTime(z * s + 3, t, T)
    } else {
      this.panner.setPosition(x * s, y * s, z * s + 3)
    }
  }

  // Master volume tied to how many events are facing the listener
  setProximity(proximity) {
    if (!this.master || !this.ac) return
    // Range: 0.3 (far side of globe) to 1.0 (events right in front)
    const vol = 0.3 + proximity * 0.7
    this.master.gain.setTargetAtTime(vol, this.ac.currentTime, 0.15)
  }

  // Compatibility stubs — main.js calls these
  setInstruments(instSet) {
    instSet.forEach(inst => this.activeInsts.add(inst))
  }

  setInstPosition(inst, x, y, z, proximityGain) {
    // Aggregate all instrument positions into one global position
    // This gets called per-instrument; we average and forward to setGlobalPosition
    if (!this._posAccum) this._posAccum = { x: 0, y: 0, z: 0, n: 0, maxProx: 0 }
    this._posAccum.x += x / 8
    this._posAccum.y += y / 8
    this._posAccum.z += z / 8
    this._posAccum.n++
    if (proximityGain > this._posAccum.maxProx) this._posAccum.maxProx = proximityGain

    // Flush after all instruments have reported (max 8)
    clearTimeout(this._posFlushTimer)
    this._posFlushTimer = setTimeout(() => {
      if (!this._posAccum) return
      this.setGlobalPosition(
        this._posAccum.x,
        this._posAccum.y,
        this._posAccum.z
      )
      this.setProximity(this._posAccum.maxProx)
      this._posAccum = null
    }, 0)
  }
}
