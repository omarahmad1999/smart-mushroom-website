/**
 * Sound for the connected-system models, synthesized with the Web Audio API: there are no audio files.
 * Light rushes softly through the glass while each message travels, a small glass tink marks where it lands, and
 * each part makes the sound of its own action: a case filling, the gate powering up, the fan, the mist, a camera's
 * shutter. Audio starts only after the visitor interacts, and follows pause, mute and hidden tabs.
 */
export type Voice = 'tap' | 'gulp' | 'gate' | 'fill' | 'chime' | 'scribble' | 'tilt' | 'toggle' | 'screen' | 'spin' | 'mist' | 'glow' | 'tick' | 'shutter' | 'stack' | 'film' | 'click';
/** What travels: light through a glass tube. */
export type Ink = 'light';
/** Where a sound happens: pan follows the model left to right, pitch dips a little further down a phone. */
export type Place = { pan?: number; pitch?: number; level?: number };

type Kit = { context: BaseAudioContext; white: AudioBuffer; pink: AudioBuffer; grain: AudioBuffer };
type Synth = (kit: Kit, out: AudioNode, when: number, pitch: number) => void;
type Pen = { source: AudioBufferSourceNode; tone: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode };

function random(seed: number) { return () => (seed = seed * 16807 % 2147483647) / 2147483647; }
function buffer(context: BaseAudioContext, seconds: number, channels = 1) { return context.createBuffer(channels, Math.round(context.sampleRate * seconds), context.sampleRate); }
function whiteNoise(context: BaseAudioContext) {
  const rand = random(7), noise = buffer(context, 2), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
  return noise;
}
// Softer, rounder noise for air and light (pink: equal energy per octave).
function pinkNoise(context: BaseAudioContext) {
  const rand = random(5), noise = buffer(context, 2), data = noise.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, peak = 0;
  for (let i = 0; i < data.length; i++) {
    const white = rand() * 2 - 1;
    b0 = .99886 * b0 + white * .0555179; b1 = .99332 * b1 + white * .0750759; b2 = .969 * b2 + white * .153852;
    b3 = .8665 * b3 + white * .3104856; b4 = .55 * b4 + white * .5329522; b5 = -.7616 * b5 - white * .016898;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362; b6 = white * .115926;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < data.length; i++) data[i] /= peak;
  return noise;
}
// Paper tooth for the writer's pencil: soft noise whose roughness wanders, with sparse grains where the nib catches a fibre.
function paperNoise(context: BaseAudioContext) {
  const rand = random(11), noise = buffer(context, 2), data = noise.getChannelData(0), step = Math.round(context.sampleRate / 90);
  let rough = .6, target = .6, grain = 0, peak = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % step === 0) target = .25 + rand() * .75;
    rough += (target - rough) * .004;
    if (rand() < 180 / context.sampleRate) grain = (.3 + rand() * .7) * (rand() < .5 ? -1 : 1);
    data[i] = (rand() * 2 - 1) * .45 * rough + grain; grain *= .6;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < data.length; i++) data[i] /= peak;
  return noise;
}
// A small, soft room: stereo noise that fades and darkens over half a second.
function roomTone(context: BaseAudioContext) {
  const rand = random(3), room = buffer(context, .45, 2);
  for (let channel = 0; channel < 2; channel++) {
    const data = room.getChannelData(channel); let low = 0;
    for (let i = 0; i < data.length; i++) { const t = i / data.length; low += (rand() * 2 - 1 - low) * (.55 - .45 * t); data[i] = low * (1 - t) ** 3; }
  }
  return room;
}

// Small building blocks: a gliding tone, a noise source, a filter, a level, and envelopes.
function osc(kit: Kit, type: OscillatorType, from: number, to: number, when: number, glide: number, length: number) {
  const node = kit.context.createOscillator(); node.type = type;
  node.frequency.setValueAtTime(from, when); node.frequency.exponentialRampToValueAtTime(to, when + glide);
  node.start(when); node.stop(when + length); return node;
}
function hiss(kit: Kit, noise: AudioBuffer, when: number, length: number, rate = 1) {
  const node = kit.context.createBufferSource(); node.buffer = noise; node.loop = true; node.playbackRate.value = rate;
  node.start(when, Math.random() * (noise.duration - .1)); node.stop(when + length); return node;
}
function band(kit: Kit, type: BiquadFilterType, frequency: number, q = .7) {
  const node = kit.context.createBiquadFilter(); node.type = type; node.frequency.value = frequency; node.Q.value = q; return node;
}
function amp(kit: Kit, value: number) { const node = kit.context.createGain(); node.gain.value = value; return node; }
// A struck envelope: a quick rise to its peak, then an exponential fall.
function hit(kit: Kit, when: number, peak: number, attack: number, decay: number) {
  const node = amp(kit, 0);
  node.gain.setValueAtTime(0, when); node.gain.linearRampToValueAtTime(peak, when + attack); node.gain.exponentialRampToValueAtTime(.0001, when + attack + decay);
  return node;
}
// An envelope drawn as a curve across a length of time.
function shape(kit: Kit, when: number, length: number, values: number[], peak: number) {
  const node = amp(kit, 0); node.gain.setValueCurveAtTime(values.map(value => value * peak), when, length); return node;
}
function chain(...nodes: AudioNode[]) { nodes.reduce((from, to) => from.connect(to)); }
// A pen stroke with a rhythm: grainy paper noise whose loudness and brightness follow curves.
function stroke(kit: Kit, out: AudioNode, when: number, length: number, loudness: number[], tone: number[], peak: number, pitch: number) {
  const bright = band(kit, 'bandpass', tone[0] * pitch, .9);
  bright.frequency.setValueCurveAtTime(tone.map(value => value * pitch), when, length);
  chain(hiss(kit, kit.grain, when, length + .05), band(kit, 'highpass', 800), bright, shape(kit, when, length, loudness, peak), out);
}

/** A struck glass or metal body: a few inharmonic partials, each ringing for its own time. */
function bell(kit: Kit, out: AudioNode, when: number, base: number, partials: [number, number, number][], peak: number) {
  for (const [ratio, share, decay] of partials) chain(osc(kit, 'sine', base * ratio, base * ratio, when, .01, decay + .06), hit(kit, when, peak * share, .002, decay), out);
}
const glass: [number, number, number][] = [[1, 1, .5], [2.76, .36, .2], [5.4, .12, .09]];
/** A short burst of noise through a band: clicks, taps and the slap of paper. */
function burst(kit: Kit, out: AudioNode, when: number, tone: number, q: number, peak: number, decay: number) {
  chain(hiss(kit, kit.white, when, decay + .03), band(kit, 'bandpass', tone, q), hit(kit, when, peak, .001, decay), out);
}
/** An envelope of several soft puffs, as a curve over `length` seconds. */
function puffs(starts: number[], life: number, length: number, steps = 64) {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1) * length;
    return Math.min(1, starts.reduce((sum, start) => { const k = (t - start) / life; return sum + (k > 0 && k < 1 ? Math.sin(Math.PI * k) ** 1.4 : 0); }, 0));
  });
}

const synths: Record<Voice, Synth> = {
  // A message of light arriving at a part: a small glass tink where the tube meets it.
  tap: (kit, out, t, p) => {
    bell(kit, out, t, 1480 * p, [[1, 1, .2], [2.76, .4, .09], [5.4, .15, .045]], .075);
    burst(kit, out, t, 6000, 1, .03, .006);
  },
  // Two readings merging in the valve: a small liquid bloop.
  gulp: (kit, out, t, p) => chain(osc(kit, 'sine', 380 * p, 900 * p, t, .045, .14), hit(kit, t, .15, .004, .09), out),
  // Mosquitto's gate powering up as the message passes: a soft thump, a rising hum, a ring.
  gate: (kit, out, t, p) => {
    chain(osc(kit, 'sine', 120 * p, 70 * p, t, .15, .3), hit(kit, t, .22, .003, .22), out);
    const sweep = band(kit, 'lowpass', 300, 1.4);
    sweep.frequency.setValueCurveAtTime([300, 1800, 900].map(value => value * p), t, .5);
    chain(osc(kit, 'sawtooth', 110 * p, 220 * p, t, .35, .55), sweep, shape(kit, t, .5, [0, 1, .6, 0], .06), out);
    bell(kit, out, t + .08, 660 * p, [[1, 1, .6], [2, .3, .3], [3.01, .14, .15]], .05);
  },
  // A glass case filling with colour: liquid poured into a bottle, its note rising as it fills, and a few bubbles.
  fill: (kit, out, t, p) => {
    const length = 1.1, rise = band(kit, 'bandpass', 380 * p, 9);
    rise.frequency.setValueCurveAtTime([380, 520, 760, 1100, 1550].map(value => value * p), t, length);
    chain(hiss(kit, kit.white, t, length + .05), rise, shape(kit, t, length, [0, .7, 1, .9, .8, 0], .55), out);
    [[.12, 420], [.33, 520], [.52, 640], [.74, 760], [.93, 900]].forEach(([delay, tone]) =>
      chain(osc(kit, 'sine', tone * p, tone * 1.6 * p, t + delay, .04, .08), hit(kit, t + delay, .045, .002, .05), out));
  },
  // TimescaleDB's seams lighting from the bottom up: three rising glass notes.
  chime: (kit, out, t, p) => {
    [784, 988, 1175].forEach((tone, i) => bell(kit, out, t + i * .18, tone * p, glass, .055));
  },
  // The database writer's quick pencil scribble, back and forth.
  scribble: (kit, out, t, p) => stroke(kit, out, t, .7, [0, .8, .3, 1, .35, .9, .3, .7, 0], [2600, 3400, 2500, 3500, 2600, 3300, 2500, 3100], .38, p),
  // The controllers' scales: the pans ring lightly as they swing, then settle.
  tilt: (kit, out, t, p) => {
    for (const [delay, peak] of [[0, .072], [.26, .036]]) {
      for (const [ratio, share, decay] of [[1, 1, .22], [1.58, .6, .15], [2.25, .35, .09]]) chain(osc(kit, 'sine', 2350 * ratio * p, 2350 * ratio * p, t + delay, .01, decay + .05), hit(kit, t + delay, peak * share, .002, decay), out);
      chain(hiss(kit, kit.white, t + delay, .02), band(kit, 'highpass', 3000), hit(kit, t + delay, peak * .5, .001, .01), out);
    }
  },
  // The actuator services: a relay clicking over, then settling.
  toggle: (kit, out, t, p) => {
    for (const [delay, peak] of [[0, .43], [.045, .27]]) {
      burst(kit, out, t + delay, 3200 * p, 1.2, peak, .012);
      chain(osc(kit, 'triangle', 900 * p, 480 * p, t + delay, .015, .04), hit(kit, t + delay, peak * .4, .001, .02), out);
    }
  },
  // Grafana's screen waking, then the data appearing: a soft pop and a short rising arpeggio, and a last note as
  // the chart is complete.
  screen: (kit, out, t, p) => {
    burst(kit, out, t, 900, .7, .06, .03);
    chain(osc(kit, 'sine', 90 * p, 140 * p, t, .12, .2), hit(kit, t, .08, .004, .15), out);
    [[.25, 1047], [.37, 1319], [.49, 1568], [1.45, 2093]].forEach(([delay, tone], i) => bell(kit, out, t + delay, tone * p, [[1, 1, .35], [2, .25, .15]], i < 3 ? .045 : .03));
  },
  // The fan: its motor whirs up, the blades beat the air faster, and it coasts back down.
  spin: (kit, out, t, p) => {
    const length = 2.8, speed = [0, .45, .85, 1, .85, .45, 0];
    const motor = kit.context.createOscillator(); motor.type = 'triangle';
    motor.frequency.setValueCurveAtTime(speed.map(value => (40 + 95 * value) * p), t, length); motor.start(t); motor.stop(t + length + .05);
    chain(motor, band(kit, 'lowpass', 700), shape(kit, t, length, speed, .1), out);
    const blades = kit.context.createOscillator(), depth = amp(kit, .35), beat = amp(kit, .65), air = band(kit, 'bandpass', 250 * p, 1.2);
    blades.frequency.setValueCurveAtTime(speed.map(value => 2 + 13 * value), t, length); chain(blades, depth); depth.connect(beat.gain); blades.start(t); blades.stop(t + length + .05);
    air.frequency.setValueCurveAtTime(speed.map(value => (250 + 650 * value) * p), t, length);
    chain(hiss(kit, kit.pink, t, length + .05), air, beat, shape(kit, t, length, speed, .27), out);
  },
  // The humidifier: a soft spray with each puff of mist, and the odd bubble in its tank.
  mist: (kit, out, t, p) => {
    const length = 3.2, starts = Array.from({ length: 9 }, (_, i) => i * .2);
    chain(hiss(kit, kit.white, t, length + .05), band(kit, 'highpass', 2400 * p), band(kit, 'lowpass', 8000), shape(kit, t, length, puffs(starts, 1.5, length), .06), out);
    [.3, 1, 1.7, 2.4].forEach(delay => chain(osc(kit, 'sine', 260 * p, 420 * p, t + delay, .05, .1), hit(kit, t + delay, .05, .003, .06), out));
  },
  // The LEDs: a relay catches, then a warm hum swells with the light and settles as it does.
  glow: (kit, out, t, p) => {
    chain(hiss(kit, kit.white, t, .02), band(kit, 'highpass', 4000), hit(kit, t, .04, .001, .01), out);
    const warm = band(kit, 'lowpass', 1400);
    for (const [frequency, share] of [[220, 1], [221.6, .35], [440, .3], [660, .1]]) chain(osc(kit, 'sine', frequency * p, frequency * p, t, .01, 2.05), amp(kit, share), warm);
    const swell = Array.from({ length: 40 }, (_, i) => { const s = i / 39 * 2; return s < .35 ? Math.sin(s / .35 * Math.PI / 2) : s < 1.1 ? 1 - .5 * (s - .35) / .75 : .5 * Math.max(0, 1 - (s - 1.1) / .9); });
    chain(warm, shape(kit, t, 2, swell, .033), out);
  },
  // The capture schedule: the timer ratchets round as its dial fills, then a small bell rings.
  tick: (kit, out, t, p) => {
    for (let i = 0; i < 8; i++) {
      const tone = (i % 2 ? 2200 : 2600) * p, peak = i % 2 ? .1 : .16;
      burst(kit, out, t + i * .13, tone, 3, peak, .012);
      chain(osc(kit, 'sine', tone, tone, t + i * .13, .01, .02), hit(kit, t + i * .13, peak * .25, .001, .008), out);
    }
    bell(kit, out, t + 1.12, 2093 * p, [[1, 1, .6], [2.76, .3, .2]], .06);
  },
  // A camera capturing: the shutter's two curtains, with a body thump, then the lens servo settling.
  shutter: (kit, out, t, p) => {
    burst(kit, out, t, 1900 * p, 1.6, .6, .03);
    chain(osc(kit, 'sine', 150 * p, 80 * p, t, .05, .1), hit(kit, t, .22, .001, .06), out);
    chain(osc(kit, 'sine', 5200 * p, 3000 * p, t, .01, .03), hit(kit, t, .05, .001, .015), out);
    burst(kit, out, t + .075, 3400 * p, 2, .46, .022);
    chain(osc(kit, 'sine', 190 * p, 110 * p, t + .075, .04, .08), hit(kit, t + .075, .12, .001, .04), out);
    chain(osc(kit, 'sawtooth', 400 * p, 360 * p, t + .11, .19, .2), band(kit, 'bandpass', 1300 * p, 2.5), shape(kit, t + .11, .19, [0, 1, .85, .6, 0], .06), out);
  },
  // A photograph landing on the pile: the slap of paper and a soft thump.
  stack: (kit, out, t, p) => {
    burst(kit, out, t, 1500 * p, .8, .42, .07);
    chain(osc(kit, 'sine', 200 * p, 130 * p, t, .05, .1), hit(kit, t, .09, .003, .05), out);
  },
  // Media preparation: a projector's motor hums while each frame of the timelapse clicks past.
  film: (kit, out, t, p) => {
    const length = 1.85, motor = band(kit, 'lowpass', 400);
    for (const [frequency, share] of [[50, 1], [100, .5]]) chain(osc(kit, 'triangle', frequency * p, frequency * p, t, .01, length + .05), amp(kit, share), motor);
    chain(motor, shape(kit, t, length, [0, 1, 1, 1, 1, 0], .08), out);
    for (let i = 0; i < 12; i++) {
      burst(kit, out, t + i * .15, 2400 * p, 1.5, .25, .012);
      chain(osc(kit, 'sine', 900 * p, 500 * p, t + i * .15, .01, .02), hit(kit, t + i * .15, .05, .001, .01), out);
    }
  },
  // Pause, play, replay and tabs: a light tap.
  click: (kit, out, t) => {
    chain(hiss(kit, kit.white, t, .02), band(kit, 'bandpass', 2600, 1.1), hit(kit, t, .6, .001, .012), out);
    chain(osc(kit, 'triangle', 1200, 800, t, .01, .03), hit(kit, t, .17, .001, .014), out);
  },
};

const RUSH = .3, rushTone = 1150;
// The rush follows the light's speed (1 is a typical message at full pace): faster is louder and brighter.
function penAt(speed: number, pitch: number, _ink: Ink, level: number) {
  const pace = Math.min(1.6, Math.max(0, speed));
  return { gain: RUSH * level * Math.min(1, pace / 1.3) ** 1.4, frequency: rushTone * pitch * (.75 + .3 * pace), rate: .8 + .35 * pace };
}
function penOn(kit: Kit, out: AudioNode, _ink: Ink): Pen {
  const context = kit.context, source = context.createBufferSource(), tone = band(kit, 'bandpass', rushTone, .7), gain = amp(kit, 0), pan = context.createStereoPanner();
  // Light rushes through the glass: round, airy noise, softened at the top.
  source.buffer = kit.pink; source.loop = true; source.start(context.currentTime, Math.random() * 1.5);
  chain(source, band(kit, 'highpass', 250), tone, band(kit, 'lowpass', 3500), gain, pan, out);
  return { source, tone, gain, pan };
}
// Everything passes through one gentle chain: a small room for warmth, and a limiter so stacked sounds never clip.
function mix(context: BaseAudioContext) {
  const master = context.createGain(), room = context.createConvolver(), wet = context.createGain(), limiter = context.createDynamicsCompressor();
  room.buffer = roomTone(context); wet.gain.value = .14; master.gain.value = .9;
  limiter.threshold.value = -14; limiter.knee.value = 8; limiter.ratio.value = 5; limiter.attack.value = .003; limiter.release.value = .2;
  master.connect(limiter); chain(master, room, wet, limiter); limiter.connect(context.destination);
  return master;
}
const kit = (context: BaseAudioContext): Kit => ({ context, white: whiteNoise(context), pink: pinkNoise(context), grain: paperNoise(context) });
const clampPan = (place?: Place) => Math.max(-1, Math.min(1, place?.pan ?? 0));

export function createFlowSounds() {
  let context: AudioContext | undefined, tools: Kit | undefined, master: GainNode | undefined;
  let enabled = true, disposed = false, parked = 0;
  const buses = new Map<string, GainNode>(), pens = new Map<string, Pen>();
  const running = () => !disposed && context?.state === 'running';
  const audible = () => enabled && running() && !document.hidden;
  // Each sound is announced, so the page's tests can follow what plays without speakers.
  const announce = (type: string, detail: Record<string, string>) => document.dispatchEvent(new CustomEvent(type, { detail }));
  function bus(owner: string) {
    let node = buses.get(owner);
    if (!node) { node = amp(tools!, 1); node.connect(master!); buses.set(owner, node); }
    return node;
  }
  // Each sound gets its own level and place in the stereo field.
  function spot(owner: string, place?: Place) {
    const level = amp(tools!, place?.level ?? 1), pan = context!.createStereoPanner();
    pan.pan.value = clampPan(place); chain(level, pan, bus(owner)); return level;
  }
  function stop(owner?: string) {
    if (!context) return;
    const now = context.currentTime;
    // Fade rather than cut, so nothing clicks; later sounds start on a fresh bus.
    for (const [name, node] of buses) if (!owner || name === owner) { node.gain.setTargetAtTime(0, now, .02); setTimeout(() => node.disconnect(), 300); buses.delete(name); }
    for (const [key, pen] of pens) if (!owner || key.startsWith(`${owner}:`)) { pen.source.stop(now + .25); pens.delete(key); }
    announce('flow-sound-stop', { owner: owner ?? 'all' });
  }
  // Once everything has faded, stop the audio thread altogether until sound is wanted again.
  function rest() {
    clearTimeout(parked);
    parked = window.setTimeout(() => { if (context && (!enabled || document.hidden)) void context.suspend().catch(() => {}); }, 160);
  }
  const visibility = () => { if (!context) return; if (document.hidden) { stop(); rest(); } else if (enabled) void context.resume().catch(() => {}); };
  document.addEventListener('visibilitychange', visibility);
  return {
    get enabled() { return enabled; },
    get ready() { return enabled && running(); },
    // Call from a visitor's gesture: browsers only start audio then.
    async enable() {
      if (disposed) return false;
      enabled = true;
      if (!context) {
        const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) { enabled = false; return false; }
        if (navigator.userActivation && !navigator.userActivation.isActive) return false;
        // On iPhones, mix with the visitor's own music instead of pausing it, and respect the silent switch.
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) session.type = 'ambient';
        context = new Context({ latencyHint: 'interactive' });
        master = mix(context); tools = kit(context);
      }
      clearTimeout(parked);
      if (context.state !== 'running') await context.resume().catch(() => {});
      return running();
    },
    disable() { enabled = false; stop(); rest(); },
    play(voice: Voice, owner: string, place?: Place) {
      if (!audible()) return;
      synths[voice](tools!, spot(owner, place), context!.currentTime + .005, place?.pitch ?? 1);
      announce('flow-sound', { voice, owner });
    },
    // Light rushes for as long as a message travels; each frame reports how fast it moves.
    pen(owner: string, key: string, speed: number, ink: Ink, place?: Place) {
      if (!audible()) return;
      const id = `${owner}:${key}`; let pen = pens.get(id);
      if (!pen) { if (speed < .05) return; pen = penOn(tools!, bus(owner), ink); pens.set(id, pen); announce('flow-sound', { voice: 'pen', owner }); }
      const now = context!.currentTime, target = penAt(speed, place?.pitch ?? 1, ink, place?.level ?? 1);
      pen.gain.gain.setTargetAtTime(target.gain, now, .03);
      pen.tone.frequency.setTargetAtTime(target.frequency, now, .04);
      pen.source.playbackRate.setTargetAtTime(target.rate, now, .05);
      pen.pan.pan.setTargetAtTime(clampPan(place), now, .05);
    },
    lift(owner: string, key: string) {
      const id = `${owner}:${key}`, pen = pens.get(id); if (!pen || !context) return;
      const now = context.currentTime; pen.gain.gain.setTargetAtTime(0, now, .03); pen.source.stop(now + .3); pens.delete(id);
    },
    stop,
    dispose() {
      disposed = true; enabled = false; stop(); clearTimeout(parked);
      document.removeEventListener('visibilitychange', visibility);
      void context?.close().catch(() => {}); context = undefined;
    },
  };
}
export type FlowSounds = ReturnType<typeof createFlowSounds>;

/** Renders one sound offline through the same chain, so its level can be checked without speakers. */
export async function renderSound(voice: Voice | 'rush', seconds = 3.6, sampleRate = 44100) {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate), tools = kit(context), out = context.createGain();
  out.connect(mix(context));
  if (voice !== 'rush') synths[voice](tools, out, .05, 1);
  else {
    // A typical message: the light speeds up to mid-tube and slows to a stop over a second.
    const ink: Ink = 'light';
    const pen = penOn(tools, out, ink), steps = Array.from({ length: 61 }, (_, i) => penAt(Math.PI / 2 * Math.sin(Math.PI * i / 60), 1, ink, 1));
    pen.gain.gain.setValueCurveAtTime(steps.map(step => step.gain), .05, 1);
    pen.tone.frequency.setValueCurveAtTime(steps.map(step => step.frequency), .05, 1);
    pen.source.playbackRate.setValueCurveAtTime(steps.map(step => step.rate), .05, 1);
    pen.source.stop(1.2);
  }
  return context.startRendering();
}
