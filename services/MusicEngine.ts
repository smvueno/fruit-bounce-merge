
type NoteEvent = { freq: number; duration: number; type?: 'kick' | 'snare' | 'hihat' | 'crash' };
type TrackData = NoteEvent[];

// Frequency Map (Equal Temperament)
const N = {
    R: 0,
    G1: 49.00,
    C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, GS3: 207.65, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, GS4: 415.30, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50
};

// Durations
const D16 = 0.25;
const D8 = 0.5;
const D4 = 1.0;
const D2 = 2.0;

export class MusicEngine {
  ctx: AudioContext | null = null;
  isPlaying: boolean = false;
  
  musicEnabled: boolean = true;
  sfxEnabled: boolean = true;
  
  // Config
  bpm = 135; 
  beatDur = 60 / 135;
  lookahead = 0.1;
  
  noiseBuffer: AudioBuffer | null = null;
  nextNoteTime = 0;
  
  // Track Cursors
  cursors = { lead: 0, bass: 0, harmony: 0, drum: 0 };
  trackTimes = { lead: 0, bass: 0, harmony: 0, drum: 0 };
  
  // Song Structure
  intro: { lead: TrackData, bass: TrackData, harmony: TrackData, drum: TrackData };
  loop: { lead: TrackData, bass: TrackData, harmony: TrackData, drum: TrackData };
  frenzy: { lead: TrackData, bass: TrackData, harmony: TrackData, drum: TrackData };
  
  currentSection: 'intro' | 'loop' | 'frenzy' = 'intro';
  targetSection: 'loop' | 'frenzy' = 'loop'; // For transitions

  constructor(musicEnabled: boolean, sfxEnabled: boolean) {
    this.musicEnabled = musicEnabled;
    this.sfxEnabled = sfxEnabled;
    this.intro = { lead: [], bass: [], harmony: [], drum: [] };
    this.loop = { lead: [], bass: [], harmony: [], drum: [] };
    this.frenzy = { lead: [], bass: [], harmony: [], drum: [] };
    this.composeSong();
    
    // Always init context if possible, just don't play if disabled
    this.init();
  }

  // --- COMPOSITION ---
  composeSong() {
    // --- INTRO ---
    // Simple build up
    this.intro.bass = [...this.createBassRun(N.C3, 4), ...this.createBassRun(N.G2, 4), ...this.createBassRun(N.A2, 4), ...this.createBassRun(N.G2, 4)];
    this.intro.lead = [
        {freq: N.C4, duration: D4}, {freq: N.E4, duration: D4}, {freq: N.G4, duration: D4}, {freq: N.C5, duration: D4},
        {freq: N.D5, duration: D4}, {freq: N.B4, duration: D4}, {freq: N.G4, duration: D4}, {freq: N.D4, duration: D4},
        {freq: N.C4, duration: D4}, {freq: N.E4, duration: D4}, {freq: N.A4, duration: D4}, {freq: N.C5, duration: D4},
        {freq: N.B4, duration: D8}, {freq: N.A4, duration: D8}, {freq: N.G4, duration: D8}, {freq: N.F4, duration: D8}, {freq: N.E4, duration: D8}, {freq: N.D4, duration: D8}, {freq: N.C4, duration: D4}
    ];
    this.intro.drum = this.createDrumBeat(16, 'build');
    this.intro.harmony = this.createRestTrack(16);

    // --- MAIN LOOP (Bouncy Pop) ---
    // Progression: C (I) - G (V) - Am (vi) - F (IV) ... ending on G (V) for loop
    const progBass = [
        ...this.createBassRun(N.C3, 4), ...this.createBassRun(N.G2, 4),
        ...this.createBassRun(N.A2, 4), ...this.createBassRun(N.F2, 4)
    ]; 
    // Fix: Modify last 4 bars of bass to turnaround on G
    const loopBass = [...progBass, ...progBass, ...progBass];
    // Last 4 bars: C - G - Am - G (Turnaround)
    loopBass.push(...this.createBassRun(N.C3, 4), ...this.createBassRun(N.G2, 4), ...this.createBassRun(N.A2, 4), ...this.createBassRun(N.G2, 4));
    
    this.loop.bass = loopBass;

    // Melody
    const motifA = [
        {freq: N.E5, duration: D8+D16}, {freq: N.R, duration: D16}, {freq: N.C5, duration: D4}, {freq: N.G4, duration: D8}, {freq: N.E4, duration: D8}, // C
        {freq: N.D4, duration: D8}, {freq: N.E4, duration: D8}, {freq: N.D4, duration: D4}, {freq: N.G3, duration: D2}, // G
    ];
    const motifB = [
        {freq: N.C5, duration: D8}, {freq: N.B4, duration: D8}, {freq: N.A4, duration: D4}, {freq: N.G4, duration: D4}, {freq: N.E4, duration: D4}, // Am
        {freq: N.F4, duration: D8}, {freq: N.G4, duration: D8}, {freq: N.A4, duration: D4}, {freq: N.C5, duration: D4}, {freq: N.D5, duration: D4}  // F
    ];
    const verse = [...motifA, ...motifB];
    
    const chorus = [
        {freq: N.E5, duration: D4}, {freq: N.G5, duration: D4}, {freq: N.E5, duration: D4}, {freq: N.C5, duration: D4}, // C
        {freq: N.D5, duration: D8}, {freq: N.C5, duration: D8}, {freq: N.B4, duration: D4}, {freq: N.A4, duration: D4}, {freq: N.G4, duration: D4}, // G
        {freq: N.A4, duration: D4}, {freq: N.C5, duration: D4}, {freq: N.E5, duration: D4}, {freq: N.A5, duration: D4}, // Am
        {freq: N.G5, duration: D4}, {freq: N.F5, duration: D8}, {freq: N.E5, duration: D8}, {freq: N.D5, duration: D4}, {freq: N.G4, duration: D4}  // G (Turnaround)
    ];

    this.loop.lead = [...verse, ...verse, ...chorus, ...chorus];
    this.loop.drum = [...this.createDrumBeat(32, 'verse'), ...this.createDrumBeat(32, 'chorus')];
    this.loop.harmony = this.loop.lead.map(n => ({ freq: n.freq > 0 ? n.freq * 0.75 : 0, duration: n.duration })); // Simple harmony

    // --- FRENZY (High Tempo / Bonus Level) ---
    // Double time feel. 
    // Pattern: Arpeggios C E G C
    const arp = [
        {freq: N.C4, duration: D16}, {freq: N.E4, duration: D16}, {freq: N.G4, duration: D16}, {freq: N.C5, duration: D16},
        {freq: N.E5, duration: D16}, {freq: N.G5, duration: D16}, {freq: N.E5, duration: D16}, {freq: N.C5, duration: D16},
    ]; // 2 Beats
    const arpG = arp.map(n => ({...n, freq: n.freq * 1.5})); // G chord

    const frenzyLead: TrackData = [];
    // 4 Bars of C, 4 Bars of G
    for(let i=0; i<8; i++) frenzyLead.push(...arp);
    for(let i=0; i<8; i++) frenzyLead.push(...arpG);
    
    const frenzyBass: TrackData = [];
    // Driving octaves
    for(let i=0; i<16; i++) { frenzyBass.push({freq: N.C3, duration: D8}, {freq: N.C2, duration: D8}); }
    for(let i=0; i<16; i++) { frenzyBass.push({freq: N.G2, duration: D8}, {freq: N.G1, duration: D8}); }

    this.frenzy.lead = [...frenzyLead, ...frenzyLead]; // 32 bars worth
    this.frenzy.bass = [...frenzyBass, ...frenzyBass];
    this.frenzy.harmony = this.frenzy.lead.map(n => ({freq: n.freq * 0.5, duration: n.duration})); // Sub harmony
    this.frenzy.drum = this.createDrumBeat(this.calculateTotalBeats(this.frenzy.lead), 'frenzy');
  }

  // --- INTERFACE ---
  
  setFrenzy(isFrenzy: boolean) {
      if (isFrenzy) {
          if (this.currentSection !== 'frenzy') {
              this.targetSection = 'frenzy';
          }
      } else {
          if (this.currentSection === 'frenzy') {
              this.targetSection = 'loop';
          }
      }
  }

  playMergeSound(tier: number) {
     if (!this.sfxEnabled || !this.ctx) return;
     // Tier 0 (Cherry) -> High pitch (800Hz)
     // Tier 10 (Watermelon) -> Low pitch (200Hz)
     const normalized = Math.min(10, tier) / 10; // 0 to 1
     const startFreq = 800 - (normalized * 600); // 800 -> 200
     const endFreq = startFreq + 100; // Slight chirp up
     
     const osc = this.ctx.createOscillator();
     const gain = this.ctx.createGain();
     
     osc.type = 'sine';
     
     const now = this.ctx.currentTime;
     osc.frequency.setValueAtTime(startFreq, now);
     osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.1);
     
     osc.connect(gain);
     gain.connect(this.ctx.destination);
     
     // Pop Envelope - High volume (0.5) to cut through music
     gain.gain.setValueAtTime(0, now);
     gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
     gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
     
     osc.start(now);
     osc.stop(now + 0.15);
  }

  // --- HELPERS ---
  
  createBassRun(freq: number, bars: number): TrackData {
      const pat: TrackData = [];
      for(let i=0; i<bars; i++) { 
          pat.push({freq: freq, duration: D8});
          pat.push({freq: freq, duration: D8}); 
      }
      return pat;
  }

  createDrumBeat(beats: number, style: 'verse'|'chorus'|'build'|'frenzy'): TrackData {
      const track: TrackData = [];
      const k = {freq:0, duration: 0.25, type: 'kick' as const};
      const s = {freq:0, duration: 0.25, type: 'snare' as const};
      const h = {freq:0, duration: 0.25, type: 'hihat' as const};
      const r = {freq:0, duration: 0.25};

      let remaining = beats;
      while(remaining > 0) {
          if (style === 'build') {
              track.push(k, r, k, r); 
          } else if (style === 'frenzy') {
              track.push(k, h, s, h); 
          } else if (style === 'verse') {
              track.push(k, r, r, r);
              track.push(s, r, r, r);
              track.push(k, r, k, r);
              track.push(s, r, r, r);
          } else {
              track.push(k, r, k, h); 
              track.push(s, r, r, h); 
              track.push(k, r, k, h); 
              track.push(s, r, k, h); 
          }
          remaining -= 4;
      }
      return track;
  }

  createRestTrack(beats: number): TrackData {
      return [{freq: 0, duration: beats}];
  }
  
  calculateTotalBeats(track: TrackData): number {
      return track.reduce((sum, n) => sum + n.duration, 0);
  }

  // --- ENGINE CORE ---

  setMusicEnabled(enabled: boolean) {
      this.musicEnabled = enabled;
      // Note: We don't stop the scheduler, we just silence the output
      // in processTrack to keep rhythm sync.
      if (enabled && this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
      }
  }

  setSfxEnabled(enabled: boolean) {
      this.sfxEnabled = enabled;
  }

  init() {
    try {
        const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new CtxClass();
        if (this.ctx) {
            // White Noise Buffer
            const bufferSize = this.ctx.sampleRate * 1;
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
    } catch(e) {
        console.warn("AudioContext not supported");
    }
  }

  resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
      }
      this.isPlaying = true;
      if (this.ctx) {
          this.nextNoteTime = this.ctx.currentTime + 0.1;
      }
  }

  stop() {
      this.isPlaying = false;
  }

  update() {
      if (!this.ctx || !this.isPlaying) return;
      
      const now = this.ctx.currentTime;
      while (this.nextNoteTime < now + this.lookahead) {
          this.scheduleStep(this.nextNoteTime);
          this.nextNoteTime += (this.beatDur / 4); // 16th note scheduling
      }
  }

  scheduleStep(time: number) {
      let src = this.currentSection === 'intro' ? this.intro : (this.currentSection === 'frenzy' ? this.frenzy : this.loop);
      
      if (this.targetSection !== 'loop' && this.currentSection === 'loop' && this.cursors.lead % 16 === 0) { 
           this.currentSection = 'frenzy';
           this.resetCursors();
           src = this.frenzy;
      } else if (this.targetSection === 'loop' && this.currentSection === 'frenzy' && this.cursors.lead % 16 === 0) {
           this.currentSection = 'loop';
           this.resetCursors();
           src = this.loop;
      }

      // SIGNIFICANTLY REDUCED VOLUMES FOR BALANCE
      this.processTrack(src.lead, 'lead', 'square', 0.04, time); // was 0.10
      this.processTrack(src.bass, 'bass', 'triangle', 0.15, time); // was 0.25
      this.processTrack(src.harmony, 'harmony', 'square', 0.02, time); // was 0.05
      this.processTrack(src.drum, 'drum', 'noise', 0.08, time); // was 0.15

      // Loop Logic
      if (this.cursors.lead >= src.lead.length) {
          if (this.currentSection === 'intro') {
              this.currentSection = 'loop';
              this.resetCursors();
          } else {
              this.resetCursors();
          }
      }
  }
  
  resetCursors() {
      this.cursors = { lead: 0, bass: 0, harmony: 0, drum: 0 };
      this.trackTimes = { lead: 0, bass: 0, harmony: 0, drum: 0 };
  }

  processTrack(track: TrackData, name: keyof typeof this.cursors, wave: OscillatorType | 'noise', vol: number, time: number) {
      // Logic runs even if muted to keep cursor sync
      const cursor = this.cursors[name];
      if (cursor >= track.length) return;

      if (this.trackTimes[name] <= 0.01) {
          const note = track[cursor];
          if (note) {
              // Only actually make sound if enabled
              if (this.musicEnabled) {
                  if (wave === 'noise' && note.type) {
                      this.playNoise(note.type, time, vol);
                  } else if (wave !== 'noise' && note.freq > 0) {
                      this.playTone(note.freq, wave, note.duration * this.beatDur, time, vol);
                  }
              }
              this.trackTimes[name] = note.duration;
              this.cursors[name]++;
          } else {
              this.trackTimes[name] = 0.25; 
          }
      }
      this.trackTimes[name] -= 0.25;
  }

  playTone(freq: number, type: OscillatorType, duration: number, time: number, vol: number) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      const attack = 0.01;
      const release = 0.02;
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol, time + attack);
      gain.gain.setValueAtTime(vol, time + duration - release);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      
      osc.start(time);
      osc.stop(time + duration);
  }

  playNoise(type: 'kick' | 'snare' | 'hihat' | 'crash', time: number, vol: number) {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const gain = this.ctx.createGain();
      
      if (type === 'kick') {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(150, time);
          filter.frequency.exponentialRampToValueAtTime(50, time + 0.1);
          src.connect(filter);
          filter.connect(gain);
          vol *= 1.5;
      } else if (type === 'hihat') {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(3000, time);
          src.connect(filter);
          filter.connect(gain);
          vol *= 0.6;
      } else {
          src.connect(gain);
      }
      
      gain.connect(this.ctx.destination);
      const dur = type === 'kick' ? 0.15 : (type === 'hihat' ? 0.05 : 0.1);
      
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
      
      src.start(time);
      src.stop(time + dur);
  }
}
