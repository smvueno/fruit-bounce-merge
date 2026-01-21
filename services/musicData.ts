
export type NoteEvent = { freq: number; duration: number; type?: 'kick' | 'snare' | 'hihat' | 'crash' };
export type TrackData = NoteEvent[];

// Frequency Map (Equal Temperament)
export const N = {
    R: 0,
    G1: 49.00,
    C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, GS3: 207.65, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, GS4: 415.30, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50
};

// Durations
export const D16 = 0.25;
export const D8 = 0.5;
export const D4 = 1.0;
export const D2 = 2.0;

// --- HELPERS (Moved here to use in composition) ---
export const createBassRun = (freq: number, bars: number): TrackData => {
    const pat: TrackData = [];
    for (let i = 0; i < bars; i++) {
        pat.push({ freq: freq, duration: D8 });
        pat.push({ freq: freq, duration: D8 });
    }
    return pat;
};

export const createDrumBeat = (beats: number, style: 'verse' | 'chorus' | 'build' | 'frenzy'): TrackData => {
    const track: TrackData = [];
    const k = { freq: 0, duration: 0.25, type: 'kick' as const };
    const s = { freq: 0, duration: 0.25, type: 'snare' as const };
    const h = { freq: 0, duration: 0.25, type: 'hihat' as const };
    const r = { freq: 0, duration: 0.25 };

    let remaining = beats;
    while (remaining > 0) {
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
};

export const createRestTrack = (beats: number): TrackData => {
    return [{ freq: 0, duration: beats }];
};

export const calculateTotalBeats = (track: TrackData): number => {
    return track.reduce((sum, n) => sum + n.duration, 0);
};

// --- COMPOSITION DATA ---
// We can construct the song parts here and export them

// --- INTRO ---
const introBass = [...createBassRun(N.C3, 4), ...createBassRun(N.G2, 4), ...createBassRun(N.A2, 4), ...createBassRun(N.G2, 4)];
const introLead = [
    { freq: N.C4, duration: D4 }, { freq: N.E4, duration: D4 }, { freq: N.G4, duration: D4 }, { freq: N.C5, duration: D4 },
    { freq: N.D5, duration: D4 }, { freq: N.B4, duration: D4 }, { freq: N.G4, duration: D4 }, { freq: N.D4, duration: D4 },
    { freq: N.C4, duration: D4 }, { freq: N.E4, duration: D4 }, { freq: N.A4, duration: D4 }, { freq: N.C5, duration: D4 },
    { freq: N.B4, duration: D8 }, { freq: N.A4, duration: D8 }, { freq: N.G4, duration: D8 }, { freq: N.F4, duration: D8 }, { freq: N.E4, duration: D8 }, { freq: N.D4, duration: D8 }, { freq: N.C4, duration: D4 }
];
const introDrum = createDrumBeat(16, 'build');
const introHarmony = createRestTrack(16);

export const INTRO_TRACK = { lead: introLead, bass: introBass, harmony: introHarmony, drum: introDrum };

// --- LOOP ---
const progBass = [
    ...createBassRun(N.C3, 4), ...createBassRun(N.G2, 4),
    ...createBassRun(N.A2, 4), ...createBassRun(N.F2, 4)
];
const loopBassBase = [...progBass, ...progBass, ...progBass];
// Last 4 bars: C - G - Am - G (Turnaround)
loopBassBase.push(...createBassRun(N.C3, 4), ...createBassRun(N.G2, 4), ...createBassRun(N.A2, 4), ...createBassRun(N.G2, 4));

const motifA = [
    { freq: N.E5, duration: D8 + D16 }, { freq: N.R, duration: D16 }, { freq: N.C5, duration: D4 }, { freq: N.G4, duration: D8 }, { freq: N.E4, duration: D8 }, // C
    { freq: N.D4, duration: D8 }, { freq: N.E4, duration: D8 }, { freq: N.D4, duration: D4 }, { freq: N.G3, duration: D2 }, // G
];
const motifB = [
    { freq: N.C5, duration: D8 }, { freq: N.B4, duration: D8 }, { freq: N.A4, duration: D4 }, { freq: N.G4, duration: D4 }, { freq: N.E4, duration: D4 }, // Am
    { freq: N.F4, duration: D8 }, { freq: N.G4, duration: D8 }, { freq: N.A4, duration: D4 }, { freq: N.C5, duration: D4 }, { freq: N.D5, duration: D4 }  // F
];
const verse = [...motifA, ...motifB];
const chorus = [
    { freq: N.E5, duration: D4 }, { freq: N.G5, duration: D4 }, { freq: N.E5, duration: D4 }, { freq: N.C5, duration: D4 }, // C
    { freq: N.D5, duration: D8 }, { freq: N.C5, duration: D8 }, { freq: N.B4, duration: D4 }, { freq: N.A4, duration: D4 }, { freq: N.G4, duration: D4 }, // G
    { freq: N.A4, duration: D4 }, { freq: N.C5, duration: D4 }, { freq: N.E5, duration: D4 }, { freq: N.A5, duration: D4 }, // Am
    { freq: N.G5, duration: D4 }, { freq: N.F5, duration: D8 }, { freq: N.E5, duration: D8 }, { freq: N.D5, duration: D4 }, { freq: N.G4, duration: D4 }  // G (Turnaround)
];
const loopLead = [...verse, ...verse, ...chorus, ...chorus];
const loopDrum = [...createDrumBeat(32, 'verse'), ...createDrumBeat(32, 'chorus')];
const loopHarmony = loopLead.map(n => ({ freq: n.freq > 0 ? n.freq * 0.75 : 0, duration: n.duration }));

export const LOOP_TRACK = { lead: loopLead, bass: loopBassBase, harmony: loopHarmony, drum: loopDrum };

// --- FRENZY ---
const arp = [
    { freq: N.C4, duration: D16 }, { freq: N.E4, duration: D16 }, { freq: N.G4, duration: D16 }, { freq: N.C5, duration: D16 },
    { freq: N.E5, duration: D16 }, { freq: N.G5, duration: D16 }, { freq: N.E5, duration: D16 }, { freq: N.C5, duration: D16 },
];
const arpG = arp.map(n => ({ ...n, freq: n.freq * 1.5 }));
const frenzyLead: TrackData = [];
for (let i = 0; i < 8; i++) frenzyLead.push(...arp);
for (let i = 0; i < 8; i++) frenzyLead.push(...arpG);

const frenzyBass: TrackData = [];
for (let i = 0; i < 16; i++) { frenzyBass.push({ freq: N.C3, duration: D8 }, { freq: N.C2, duration: D8 }); }
for (let i = 0; i < 16; i++) { frenzyBass.push({ freq: N.G2, duration: D8 }, { freq: N.G1, duration: D8 }); }

const frenzyFinalLead = [...frenzyLead, ...frenzyLead];
const frenzyFinalBass = [...frenzyBass, ...frenzyBass];
const frenzyHarmony = frenzyFinalLead.map(n => ({ freq: n.freq * 0.5, duration: n.duration }));
const frenzyDrum = createDrumBeat(calculateTotalBeats(frenzyFinalLead), 'frenzy');

export const FRENZY_TRACK = { lead: frenzyFinalLead, bass: frenzyFinalBass, harmony: frenzyHarmony, drum: frenzyDrum };
