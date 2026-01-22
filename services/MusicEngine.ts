
import { INTRO_TRACK, LOOP_TRACK, FRENZY_TRACK, TrackData, NoteEvent } from './musicData';

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
