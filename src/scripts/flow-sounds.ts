/**
 * Paper-and-ink sound for the system diagrams, synthesized with the Web Audio API: there are no audio files.
 * A pen scratches while each message travels, a drop of ink taps as it lands, and each part makes the small
 * sound of its own action. Audio starts only after the visitor interacts, and follows pause, mute and hidden tabs.
 */
export type Voice = 'blot' | 'gulp' | 'stamp' | 'scribble' | 'layer' | 'chart' | 'tilt' | 'toggle' | 'spin' | 'mist' | 'glow' | 'tick' | 'flash' | 'stack' | 'film' | 'click';
/** The kind of message a pen carries changes its stroke a little, as it changes the drop's shape. */
export type Ink = 'reading' | 'command' | 'photo';
/** Where a sound happens: pan follows the drawing left to right, pitch dips a little further down a phone drawing. */
export type Place = { pan?: number; pitch?: number; level?: number };

type Kit = { context: BaseAudioContext; white: AudioBuffer; grain: AudioBuffer };
type Synth = (kit: Kit, out: AudioNode, when: number, pitch: number) => void;
type Pen = { source: AudioBufferSourceNode; tone: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode };

function random(seed: number) { return () => (seed = seed * 16807 % 2147483647) / 2147483647; }
function buffer(context: BaseAudioContext, seconds: number, channels = 1) { return context.createBuffer(channels, Math.round(context.sampleRate * seconds), context.sampleRate); }
function whiteNoise(context: BaseAudioContext) {
  const rand = random(7), noise = buffer(context, 2), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
  return noise;
}
// Paper tooth for the pen: soft noise whose roughness wanders, with sparse grains where the nib catches a fibre.
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

const synths: Record<Voice, Synth> = {
  // A drop of ink landing on paper: a soft, low tap.
  blot: (kit, out, t, p) => {
    chain(osc(kit, 'sine', 300 * p, 120 * p, t, .07, .25), hit(kit, t, .17, .004, .18), out);
    chain(hiss(kit, kit.white, t, .05), band(kit, 'lowpass', 2000 * p, .6), hit(kit, t, .05, .001, .025), out);
  },
  // Two drops merging into one: a small liquid bloop.
  gulp: (kit, out, t, p) => chain(osc(kit, 'sine', 380 * p, 900 * p, t, .045, .14), hit(kit, t, .15, .004, .09), out),
  // Mosquitto's rubber stamp: a felt thump, a slap of paper, a faint lift.
  stamp: (kit, out, t, p) => {
    chain(osc(kit, 'sine', 150 * p, 55 * p, t, .12, .4), hit(kit, t, .32, .003, .3), out);
    chain(osc(kit, 'triangle', 340 * p, 190 * p, t, .06, .2), hit(kit, t, .12, .002, .12), out);
    chain(hiss(kit, kit.white, t, .1), band(kit, 'bandpass', 1300 * p, .8), hit(kit, t, .2, .001, .06), out);
    chain(hiss(kit, kit.white, t + .16, .04), band(kit, 'highpass', 2500), hit(kit, t + .16, .035, .001, .012), out);
  },
  // The database writer's quick pencil scribble, back and forth.
  scribble: (kit, out, t, p) => stroke(kit, out, t, .7, [0, .8, .3, 1, .35, .9, .3, .7, 0], [2600, 3400, 2500, 3500, 2600, 3300, 2500, 3100], .38, p),
  // TimescaleDB: sheets of paper settling into a layer.
  layer: (kit, out, t, p) => {
    for (const [delay, peak, tone] of [[0, .2, 1500], [.13, .125, 1100]]) chain(hiss(kit, kit.white, t + delay, .26), band(kit, 'bandpass', tone * p, .6), band(kit, 'lowpass', 3200), hit(kit, t + delay, peak, .03, .16), out);
  },
  // Grafana: a pen zigzag that climbs, like the chart it draws.
  chart: (kit, out, t, p) => stroke(kit, out, t, .65, [0, .9, .4, .9, .4, .95, .4, 1, .4, 1, 0], [2200, 2400, 2500, 2800, 2900, 3200, 3300, 3600, 3700, 4100, 4100], .3, p),
  // The controllers' scales: the pans ring lightly as they swing, then settle.
  tilt: (kit, out, t, p) => {
    for (const [delay, peak] of [[0, .072], [.26, .036]]) {
      for (const [ratio, share, decay] of [[1, 1, .22], [1.58, .6, .15], [2.25, .35, .09]]) chain(osc(kit, 'sine', 2350 * ratio * p, 2350 * ratio * p, t + delay, .01, decay + .05), hit(kit, t + delay, peak * share, .002, decay), out);
      chain(hiss(kit, kit.white, t + delay, .02), band(kit, 'highpass', 3000), hit(kit, t + delay, peak * .5, .001, .01), out);
    }
  },
  // The actuator services: a switch clicking over, then settling.
  toggle: (kit, out, t, p) => {
    for (const [delay, peak] of [[0, .43], [.045, .27]]) {
      chain(hiss(kit, kit.white, t + delay, .02), band(kit, 'bandpass', 3200 * p, 1.2), hit(kit, t + delay, peak, .001, .012), out);
      chain(osc(kit, 'triangle', 900 * p, 480 * p, t + delay, .015, .04), hit(kit, t + delay, peak * .4, .001, .02), out);
    }
  },
  // The fan: air pushed by the blades as they speed up and slow down, with the blades' soft beat.
  spin: (kit, out, t, p) => {
    const blades = kit.context.createOscillator(), depth = amp(kit, .3), beat = amp(kit, .7), air = band(kit, 'bandpass', 350 * p, 1.1);
    blades.frequency.setValueCurveAtTime([1, 5.5, 1], t, 1.1); chain(blades, depth); depth.connect(beat.gain); blades.start(t); blades.stop(t + 1.2);
    air.frequency.setValueCurveAtTime([350, 800, 1300, 800, 450].map(value => value * p), t, 1.1);
    chain(hiss(kit, kit.white, t, 1.15), air, beat, shape(kit, t, 1.1, [0, .4, 1, .4, 0], .18), out);
  },
  // The humidifier: three soft puffs of mist.
  mist: (kit, out, t, p) => {
    [0, .16, .32].forEach((delay, i) => chain(hiss(kit, kit.white, t + delay, .3), band(kit, 'highpass', (2600 + i * 400) * p), band(kit, 'lowpass', 7500), hit(kit, t + delay, .08, .015, .22), out));
  },
  // The LEDs: the filament catches, then a warm hum swells with the light and settles as it does.
  glow: (kit, out, t, p) => {
    chain(hiss(kit, kit.white, t, .02), band(kit, 'highpass', 4000), hit(kit, t, .04, .001, .01), out);
    const warm = band(kit, 'lowpass', 1400);
    for (const [frequency, share] of [[220, 1], [221.6, .35], [440, .3], [660, .1]]) chain(osc(kit, 'sine', frequency * p, frequency * p, t, .01, 2.05), amp(kit, share), warm);
    const swell = Array.from({ length: 40 }, (_, i) => { const s = i / 39 * 2; return s < .35 ? Math.sin(s / .35 * Math.PI / 2) : s < 1.1 ? 1 - .5 * (s - .35) / .75 : .5 * Math.max(0, 1 - (s - 1.1) / .9); });
    chain(warm, shape(kit, t, 2, swell, .033), out);
  },
  // The capture schedule: the timer ticks over, then tocks as it settles.
  tick: (kit, out, t, p) => {
    for (const [delay, peak, tone] of [[0, .25, 1900], [.2, .11, 1500]]) {
      chain(osc(kit, 'sine', tone * p, tone * .9 * p, t + delay, .03, .06), hit(kit, t + delay, peak, .001, .03), out);
      chain(hiss(kit, kit.white, t + delay, .02), band(kit, 'bandpass', 3500, 1), hit(kit, t + delay, peak * .5, .001, .008), out);
    }
  },
  // The cameras: a shutter opening and closing.
  flash: (kit, out, t, p) => {
    for (const [delay, peak, tone] of [[0, .4, 4200], [.055, .29, 3000]]) {
      chain(hiss(kit, kit.white, t + delay, .03), band(kit, 'bandpass', tone * p, 1.3), hit(kit, t + delay, peak, .001, .014), out);
      chain(osc(kit, 'triangle', 700 * p, 300 * p, t + delay, .02, .05), hit(kit, t + delay, peak * .35, .001, .025), out);
    }
  },
  // Image storage: photographs landing on the pile.
  stack: (kit, out, t, p) => {
    for (const [delay, peak] of [[0, .32], [.08, .24], [.16, .19]]) chain(hiss(kit, kit.white, t + delay, .12), band(kit, 'bandpass', 2300 * p, 1.1), band(kit, 'highpass', 900), hit(kit, t + delay, peak, .004, .07), out);
  },
  // Media preparation: a projector's flutter, 24 frames a second.
  film: (kit, out, t, p) => {
    const gate = kit.context.createOscillator(), depth = amp(kit, .5), shutter = amp(kit, .5);
    gate.type = 'square'; gate.frequency.value = 24; chain(gate, depth); depth.connect(shutter.gain); gate.start(t); gate.stop(t + .75);
    chain(hiss(kit, kit.white, t, .75), band(kit, 'bandpass', 1900 * p, 1.4), shutter, hit(kit, t, .21, .08, .6), out);
  },
  // Pause, play, replay and tabs: a light tap.
  click: (kit, out, t) => {
    chain(hiss(kit, kit.white, t, .02), band(kit, 'bandpass', 2600, 1.1), hit(kit, t, .49, .001, .01), out);
    chain(osc(kit, 'triangle', 1200, 800, t, .01, .03), hit(kit, t, .14, .001, .012), out);
  },
};

const PEN = .45, penTone: Record<Ink, number> = { reading: 2300, command: 3100, photo: 1800 };
// The pen follows its speed (1 is a typical stroke at full pace): faster is louder, brighter and grittier.
function penAt(speed: number, pitch: number, ink: Ink, level: number) {
  const pace = Math.min(1.6, Math.max(0, speed));
  return { gain: PEN * level * Math.min(1, pace / 1.3) ** 1.4, frequency: penTone[ink] * pitch * (.75 + .3 * pace), rate: .8 + .35 * pace };
}
function penOn(kit: Kit, out: AudioNode, ink: Ink): Pen {
  const context = kit.context, source = context.createBufferSource(), tone = band(kit, 'bandpass', penTone[ink], ink === 'photo' ? .6 : .9), gain = amp(kit, 0), pan = context.createStereoPanner();
  source.buffer = kit.grain; source.loop = true; source.start(context.currentTime, Math.random() * 1.5);
  chain(source, band(kit, 'highpass', 700), tone, gain, pan, out);
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
const kit = (context: BaseAudioContext): Kit => ({ context, white: whiteNoise(context), grain: paperNoise(context) });
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
    // A pen scratches for as long as a message travels; each frame reports how fast it moves.
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
export async function renderSound(voice: Voice | 'pen', seconds = 2.4, sampleRate = 44100) {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate), tools = kit(context), out = context.createGain();
  out.connect(mix(context));
  if (voice !== 'pen') synths[voice](tools, out, .05, 1);
  else {
    // A typical stroke: the pen speeds up to mid-route and slows to a stop over a second.
    const pen = penOn(tools, out, 'reading'), steps = Array.from({ length: 61 }, (_, i) => penAt(Math.PI / 2 * Math.sin(Math.PI * i / 60), 1, 'reading', 1));
    pen.gain.gain.setValueCurveAtTime(steps.map(step => step.gain), .05, 1);
    pen.tone.frequency.setValueCurveAtTime(steps.map(step => step.frequency), .05, 1);
    pen.source.playbackRate.setValueCurveAtTime(steps.map(step => step.rate), .05, 1);
    pen.source.stop(1.2);
  }
  return context.startRendering();
}
