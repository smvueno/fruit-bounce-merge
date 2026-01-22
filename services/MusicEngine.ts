
import { INTRO_TRACK, LOOP_TRACK, FRENZY_TRACK, TrackData, NoteEvent } from './musicData';

// Pentatonic C Major ish frequencies for pleasant progression
const TIER_FREQUENCIES = [
    1046.50, // Tier 0: C6 (High, cute)
    987.77,  // Tier 1: B5
    880.00,  // Tier 2: A5
    783.99,  // Tier 3: G5
    698.46,  // Tier 4: F5
    659.25,  // Tier 5: E5
    587.33,  // Tier 6: D5
    523.25,  // Tier 7: C5
    392.00,  // Tier 8: G4 (Low start)
    261.63,  // Tier 9: C4
    196.00,  // Tier 10: G3 (Bass)
];

export class MusicEngine {
    ctx: AudioContext | null = null;
    compressor: DynamicsCompressorNode | null = null;
    masterGain: GainNode | null = null;

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

    // Sound Queue System
    soundQueue: number[] = []; // Stores Tier IDs to play
    nextSfxTime: number = 0;
    readonly MIN_SFX_GAP = 0.06; // 60ms gap for "machine gun" feel without overlapping mess

    constructor(musicEnabled: boolean, sfxEnabled: boolean) {
        this.musicEnabled = musicEnabled;
        this.sfxEnabled = sfxEnabled;

        // Assign imported tracks
        this.intro = INTRO_TRACK;
        this.loop = LOOP_TRACK;
        this.frenzy = FRENZY_TRACK;

        // Always init context if possible, just don't play if disabled
        this.init();
    }

    // --- ENGINE CORE ---

    setMusicEnabled(enabled: boolean) {
        this.musicEnabled = enabled;
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
                // Master Bus with Compressor
                this.compressor = this.ctx.createDynamicsCompressor();
                this.compressor.threshold.value = -12;
                this.compressor.knee.value = 30;
                this.compressor.ratio.value = 12;
                this.compressor.attack.value = 0.003;
                this.compressor.release.value = 0.25;

                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.8; // Headroom

                // Chain: MasterGain -> Compressor -> Destination
                this.masterGain.connect(this.compressor);
                this.compressor.connect(this.ctx.destination);

                // White Noise Buffer
                const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
                this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
            }
        } catch (e) {
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
            this.nextSfxTime = this.ctx.currentTime;
        }
    }

    stop() {
        this.isPlaying = false;
    }

    update() {
        if (!this.ctx || !this.isPlaying) return;

        const now = this.ctx.currentTime;

        // 1. Process Music Scheduler
        while (this.nextNoteTime < now + this.lookahead) {
            this.scheduleStep(this.nextNoteTime);
            this.nextNoteTime += (this.beatDur / 4); // 16th note scheduling
        }

        // 2. Process SFX Queue
        // If we have sounds to play and it's time to play them
        if (this.soundQueue.length > 0) {
            // Catch up if falling behind (game lag), but maintain gap
            if (this.nextSfxTime < now) {
                this.nextSfxTime = now;
            }

            while (this.soundQueue.length > 0 && this.nextSfxTime < now + this.lookahead) {
                const tier = this.soundQueue.shift();
                if (tier !== undefined) {
                    this._triggerMergeSound(tier, this.nextSfxTime);

                    // Dynamic Gap: If queue is huge, play faster
                    let gap = this.MIN_SFX_GAP;
                    if (this.soundQueue.length > 5) gap = 0.04;
                    if (this.soundQueue.length > 10) gap = 0.03;

                    this.nextSfxTime += gap;
                }
            }
        }
    }

    scheduleStep(time: number) {
        let src = this.currentSection === 'intro' ? this.intro : (this.currentSection === 'frenzy' ? this.frenzy : this.loop);

        // Previous Logic: Timed transitions
        // Now: Handled by setFrenzy mostly.
        // We only handle Intro -> Loop auto-transition here.

        // Loop Logic
        if (this.cursors.lead >= src.lead.length) {
            if (this.currentSection === 'intro') {
                this.currentSection = 'loop';
                this.resetCursors();
            } else {
                this.resetCursors();
            }
        }

        // Re-check src in case section changed above
        src = this.currentSection === 'intro' ? this.intro : (this.currentSection === 'frenzy' ? this.frenzy : this.loop);

        // Volumes
        // Fixed weird tone by ensuring we check bounds before processing
        // If cursor is 0 and we just looped, ensure we don't play a ghost note from previous state

        this.processTrack(src.lead, 'lead', 'square', 0.04, time);
        this.processTrack(src.bass, 'bass', 'triangle', 0.15, time);
        this.processTrack(src.harmony, 'harmony', 'square', 0.02, time);
        this.processTrack(src.drum, 'drum', 'noise', 0.08, time);
    }

    resetCursors() {
        this.cursors = { lead: 0, bass: 0, harmony: 0, drum: 0 };
        this.trackTimes = { lead: 0, bass: 0, harmony: 0, drum: 0 };
    }

    // --- INTERFACE ---

    setFrenzy(isFrenzy: boolean) {
        if (isFrenzy) {
            if (this.currentSection !== 'frenzy') {
                // Immediate Transition
                this.currentSection = 'frenzy';
                this.resetCursors();
                // We should ensure nextNoteTime is aligned?
                // Actually, if we just swap the track data pointer, the next scheduleStep call
                // will pick up from the new track at cursor 0.
                // This is effectively an instant "Hard Cut" or crossfade.
                // To prevent glitching if we are mid-measure, resetting cursors is key.
            }
        } else {
            if (this.currentSection === 'frenzy') {
                // Immediate Transition Back
                this.currentSection = 'loop';
                this.resetCursors();
            }
        }
    }

    // --- SFX QUEUE INTERFACE ---

    playMergeSound(tier: number) {
        if (!this.sfxEnabled) return;
        this.soundQueue.push(tier);
    }

    // Internal trigger method (executed by queue)
    _triggerMergeSound(tier: number, time: number) {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        // Default
        let volume = 0.5;
        let duration = 0.12;

        // --- SPECIALS ---
        if (tier >= 90) {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, time);
            osc.frequency.exponentialRampToValueAtTime(1200, time + 0.1);
            osc.frequency.exponentialRampToValueAtTime(800, time + 0.3);
            duration = 0.4;
            volume = 0.6;

            // Sub-Bass Oomph for Bomb/Special
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(50, time);
            sub.frequency.exponentialRampToValueAtTime(30, time + 0.4);
            sub.connect(subGain);
            subGain.connect(this.masterGain);
            subGain.gain.setValueAtTime(0.5, time);
            subGain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
            sub.start(time);
            sub.stop(time + 0.4);

            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 20;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 50;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(time);
            lfo.stop(time + duration);
        }
        // --- LARGE (8, 9, 10) ---
        else if (tier >= 8) {
             osc.type = 'sawtooth'; // Richer tone
             // Filter for Thud
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'lowpass';
             filter.frequency.setValueAtTime(600, time); // Higher start than before for audibility
             filter.frequency.exponentialRampToValueAtTime(150, time + 0.2);

             osc.disconnect();
             osc.connect(filter);
             filter.connect(gain);

             // Pitch Drop
             const baseFreq = TIER_FREQUENCIES[tier];
             osc.frequency.setValueAtTime(baseFreq, time);
             osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, time + 0.25);

             duration = 0.3;
             volume = 0.85; // Boosted volume

             // Add Sub-Bass for Large Fruits too (Watermelon etc)
             if (tier === 10) {
                 const sub = this.ctx.createOscillator();
                 const subGain = this.ctx.createGain();
                 sub.type = 'sine';
                 sub.frequency.setValueAtTime(60, time);
                 sub.frequency.exponentialRampToValueAtTime(40, time + 0.3);
                 sub.connect(subGain);
                 subGain.connect(this.masterGain);
                 subGain.gain.setValueAtTime(0.4, time);
                 subGain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
                 sub.start(time);
                 sub.stop(time + 0.3);
             }
        }
        // --- MEDIUM (4, 5, 6, 7) ---
        else if (tier >= 4) {
            osc.type = 'triangle';
            const baseFreq = TIER_FREQUENCIES[tier];
            osc.frequency.setValueAtTime(baseFreq, time);
            osc.frequency.linearRampToValueAtTime(baseFreq - 50, time + 0.1);

            duration = 0.15;
            volume = 0.5;
        }
        // --- SMALL (0, 1, 2, 3) ---
        else {
            osc.type = 'sine';
            const baseFreq = TIER_FREQUENCIES[tier];
            osc.frequency.setValueAtTime(baseFreq, time);
            osc.frequency.exponentialRampToValueAtTime(baseFreq + 150, time + 0.08); // More distinct chirp

            duration = 0.1;
            volume = 0.45;
        }

        // Instant Attack
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.start(time);
        osc.stop(time + duration);
    }

    // --- NEW SFX METHODS ---

    playBombTick(rate: number) {
        // Rate: 0.0 (slow) to 1.0 (fast)
        if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        // Woodblock-ish sound
        osc.type = 'sine';
        // Pitch goes up as rate increases
        const pitch = 800 + (rate * 400);
        osc.frequency.setValueAtTime(pitch, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    playTomatoSuck(intensity: number) {
        // intensity 0.0 to 1.0
        if (!this.sfxEnabled || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'bandpass';
        // Higher intensity = higher frequency sweep
        const startFreq = 200 + (intensity * 400);
        const endFreq = 1500 + (intensity * 1000);

        filter.frequency.setValueAtTime(startFreq, now);
        filter.frequency.exponentialRampToValueAtTime(endFreq, now + 0.5); // Faster swoosh for loop
        filter.Q.value = 2;

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        // Louder with intensity
        const vol = 0.2 + (intensity * 0.3);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);

        src.start(now);
        src.stop(now + 0.5);
    }

    playBombShrapnel() {
        if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        // Machine gun bubbles
        const count = 5;
        const gap = 0.04;

        for (let i = 0; i < count; i++) {
            const t = now + (i * gap);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.type = 'sine';
            const pitch = 1200 + (Math.random() * 400);
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch - 300, t + 0.05);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

            osc.start(t);
            osc.stop(t + 0.05);
        }
    }

    // --- FRENZY SFX ---

    playFrenzyStart() {
        if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        // Positive Chime (Major Triad)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
        notes.forEach((freq, i) => {
            const t = now + (i * 0.05);
            this.playTone(freq, 'sine', 0.4, t, 0.3);
        });
    }

    playFrenzyTick(progress: number) {
        // Ticking clock sound
        // progress 0.0 (start) to 1.0 (end)
        // Tick gets higher pitch and sharper as it ends
        if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'square'; // Tick tock style
        const freq = 800 + (progress * 400);
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.start(now);
        osc.stop(now + 0.03);
    }

    playFrenzyEnd() {
        if (!this.sfxEnabled || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        // Negative Slide
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.start(now);
        osc.stop(now + 0.5);
    }

    // --- MUSIC PROCESSING ---

    processTrack(track: TrackData, name: keyof typeof this.cursors, wave: OscillatorType | 'noise', vol: number, time: number) {
        const cursor = this.cursors[name];
        if (cursor >= track.length) return;

        if (this.trackTimes[name] <= 0.01) {
            const note = track[cursor];
            if (note) {
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
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        osc.connect(gain);
        gain.connect(this.masterGain);

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
        if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
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

        gain.connect(this.masterGain);
        const dur = type === 'kick' ? 0.15 : (type === 'hihat' ? 0.05 : 0.1);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

        src.start(time);
        src.stop(time + dur);
    }
}
