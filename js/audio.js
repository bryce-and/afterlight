// Tiny WebAudio synth: every sound is generated, no asset files.
let ctx = null, master = null, noiseBuf = null;
let volume = 0.6;
const last = {};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { console.warn('WebAudio not supported; sound disabled.'); return; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume * 0.5;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

/** The shared AudioContext (null until the first user gesture starts audio). */
export const audioCtx = () => ctx;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v * 0.5;
}

function throttled(key, ms) {
  const n = performance.now();
  if (last[key] && n - last[key] < ms) return true;
  last[key] = n;
  return false;
}

function noise({ dur = 0.15, freq = 1500, freqEnd, q = 0.8, type = 'lowpass', gain = 0.5, attack = 0.002, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone({ freq = 440, freqEnd, dur = 0.1, type = 'sine', gain = 0.2, attack = 0.005, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  shot(arch) {
    if (!ctx) return;
    switch (arch) {
      case 'auto': noise({ dur: 0.09, freq: 2400, freqEnd: 600, gain: 0.32 }); tone({ freq: 180, freqEnd: 60, dur: 0.07, type: 'square', gain: 0.1 }); break;
      case 'hand': noise({ dur: 0.22, freq: 1800, freqEnd: 300, gain: 0.6 }); tone({ freq: 120, freqEnd: 40, dur: 0.18, type: 'square', gain: 0.22 }); break;
      case 'pulse': noise({ dur: 0.07, freq: 3000, freqEnd: 900, gain: 0.28 }); tone({ freq: 420, freqEnd: 200, dur: 0.06, type: 'sawtooth', gain: 0.07 }); break;
      case 'scout': noise({ dur: 0.15, freq: 2600, freqEnd: 500, gain: 0.45 }); tone({ freq: 260, freqEnd: 90, dur: 0.1, type: 'square', gain: 0.14 }); break;
      case 'smg': noise({ dur: 0.06, freq: 3200, freqEnd: 1200, gain: 0.24 }); break;
      case 'shotgun': noise({ dur: 0.35, freq: 1400, freqEnd: 200, gain: 0.8 }); tone({ freq: 90, freqEnd: 35, dur: 0.25, type: 'square', gain: 0.28 }); break;
      case 'sniper': noise({ dur: 0.5, freq: 2200, freqEnd: 150, gain: 0.8 }); tone({ freq: 70, freqEnd: 30, dur: 0.4, gain: 0.5 }); break;
      case 'fusion': tone({ freq: 900, freqEnd: 200, dur: 0.25, type: 'sawtooth', gain: 0.18 }); noise({ dur: 0.25, freq: 4000, freqEnd: 500, type: 'bandpass', gain: 0.5 }); break;
      case 'linear': tone({ freq: 1600, freqEnd: 120, dur: 0.45, type: 'sawtooth', gain: 0.22 }); noise({ dur: 0.4, freq: 5000, freqEnd: 300, type: 'bandpass', gain: 0.6 }); break;
      case 'rocket': noise({ dur: 0.6, freq: 800, freqEnd: 200, gain: 0.5 }); tone({ freq: 200, freqEnd: 80, dur: 0.4, type: 'sawtooth', gain: 0.1 }); break;
      case 'mg': noise({ dur: 0.1, freq: 2000, freqEnd: 400, gain: 0.38 }); tone({ freq: 110, freqEnd: 50, dur: 0.08, type: 'square', gain: 0.12 }); break;
      case 'glauncher': tone({ freq: 300, freqEnd: 120, dur: 0.12, type: 'square', gain: 0.16 }); noise({ dur: 0.12, freq: 900, gain: 0.3 }); break;
      case 'sidearm': noise({ dur: 0.08, freq: 2800, freqEnd: 800, gain: 0.3 }); tone({ freq: 220, freqEnd: 90, dur: 0.06, type: 'square', gain: 0.09 }); break;
      case 'glaive': tone({ freq: 1100, freqEnd: 400, dur: 0.09, type: 'triangle', gain: 0.14 }); noise({ dur: 0.06, freq: 4200, freqEnd: 1500, type: 'bandpass', gain: 0.18 }); break;
      case 'trace': tone({ freq: 520, freqEnd: 480, dur: 0.14, type: 'sawtooth', gain: 0.05 }); noise({ dur: 0.1, freq: 5200, freqEnd: 3500, type: 'bandpass', gain: 0.12 }); break;
      case 'revolver': noise({ dur: 0.6, freq: 3000, freqEnd: 200, gain: 0.8 }); tone({ freq: 1400, freqEnd: 300, dur: 0.4, type: 'sawtooth', gain: 0.18 }); break;
      case 'hammer': noise({ dur: 0.25, freq: 600, freqEnd: 1800, type: 'bandpass', gain: 0.5 }); break;
      default: noise({ dur: 0.1, freq: 2000, gain: 0.3 });
    }
  },
  charge() { tone({ freq: 200, freqEnd: 1200, dur: 0.6, type: 'sawtooth', gain: 0.06 }); },
  enemyShot() { if (throttled('es', 45)) return; tone({ freq: 700, freqEnd: 300, dur: 0.1, type: 'triangle', gain: 0.05 }); },
  explosion(r = 4) {
    if (throttled('ex', 40)) return;
    noise({ dur: 0.5 + r * 0.06, freq: 900, freqEnd: 60, gain: Math.min(0.9, 0.35 + r * 0.06) });
    tone({ freq: 90, freqEnd: 30, dur: 0.5, gain: 0.35 });
  },
  hit(crit) {
    if (throttled('hit', 30)) return;
    if (crit) tone({ freq: 1800, freqEnd: 1500, dur: 0.06, type: 'triangle', gain: 0.12 });
    else tone({ freq: 1100, dur: 0.04, type: 'triangle', gain: 0.07 });
  },
  kill() { if (throttled('kill', 40)) return; tone({ freq: 500, freqEnd: 1200, dur: 0.1, type: 'triangle', gain: 0.1 }); },
  shieldBreak() { noise({ dur: 0.3, freq: 5000, freqEnd: 1500, type: 'highpass', gain: 0.35 }); tone({ freq: 1500, freqEnd: 500, dur: 0.25, type: 'triangle', gain: 0.12 }); },
  playerShieldBreak() { tone({ freq: 600, freqEnd: 150, dur: 0.35, type: 'sawtooth', gain: 0.15 }); },
  block() { if (throttled('block', 90)) return; tone({ freq: 240, freqEnd: 110, dur: 0.12, type: 'square', gain: 0.1 }); noise({ dur: 0.1, freq: 1600, type: 'bandpass', gain: 0.25 }); },
  shieldRecharge() { tone({ freq: 300, freqEnd: 900, dur: 0.5, type: 'sine', gain: 0.08 }); },
  hurt() { if (throttled('hurt', 90)) return; noise({ dur: 0.12, freq: 500, gain: 0.35 }); },
  death() { tone({ freq: 300, freqEnd: 60, dur: 1.2, type: 'sawtooth', gain: 0.2 }); },
  reload() { noise({ dur: 0.05, freq: 3000, type: 'bandpass', gain: 0.25 }); noise({ dur: 0.05, freq: 2200, type: 'bandpass', gain: 0.25, delay: 0.25 }); },
  reloadDone() { noise({ dur: 0.06, freq: 1800, type: 'bandpass', q: 3, gain: 0.35 }); },
  swap() { noise({ dur: 0.05, freq: 2500, type: 'bandpass', gain: 0.2 }); },
  empty() { if (throttled('empty', 150)) return; tone({ freq: 1200, dur: 0.03, type: 'square', gain: 0.05 }); },
  jump() { noise({ dur: 0.1, freq: 600, gain: 0.08 }); },
  land() { noise({ dur: 0.12, freq: 300, gain: 0.2 }); },
  airMove() { tone({ freq: 250, freqEnd: 600, dur: 0.2, type: 'triangle', gain: 0.08 }); },
  throw() { noise({ dur: 0.15, freq: 800, freqEnd: 2500, type: 'bandpass', gain: 0.2 }); },
  melee() { noise({ dur: 0.12, freq: 400, gain: 0.5 }); tone({ freq: 140, freqEnd: 60, dur: 0.12, type: 'square', gain: 0.18 }); },
  ability() { tone({ freq: 300, freqEnd: 900, dur: 0.25, type: 'triangle', gain: 0.14 }); noise({ dur: 0.25, freq: 2000, type: 'bandpass', gain: 0.15 }); },
  zap() { if (throttled('zap', 50)) return; noise({ dur: 0.15, freq: 5000, freqEnd: 2000, type: 'bandpass', q: 4, gain: 0.3 }); },
  heal() { tone({ freq: 500, freqEnd: 800, dur: 0.4, gain: 0.08 }); },
  superStart() { tone({ freq: 120, freqEnd: 500, dur: 0.8, type: 'sawtooth', gain: 0.18 }); noise({ dur: 0.8, freq: 300, freqEnd: 3000, type: 'bandpass', gain: 0.35 }); },
  superReady() { tone({ freq: 660, dur: 0.12, gain: 0.1 }); tone({ freq: 990, dur: 0.2, gain: 0.1, delay: 0.1 }); },
  denied() { if (throttled('deny', 200)) return; tone({ freq: 160, dur: 0.08, type: 'square', gain: 0.06 }); },
  pickupAmmo() { tone({ freq: 700, freqEnd: 1000, dur: 0.08, type: 'triangle', gain: 0.1 }); },
  engram(rIdx = 0) {
    const base = 440 + rIdx * 80;
    [0, 4, 7, 12].slice(0, 2 + Math.min(2, rIdx)).forEach((st, i) => tone({ freq: base * Math.pow(2, st / 12), dur: 0.25, gain: 0.09, delay: i * 0.07 }));
  },
  alert() { tone({ freq: 440, dur: 0.12, type: 'square', gain: 0.05 }); tone({ freq: 330, dur: 0.18, type: 'square', gain: 0.05, delay: 0.14 }); },
  areaClear() { [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.3, gain: 0.08, delay: i * 0.1 })); },
  bossIntro() { tone({ freq: 55, dur: 1.6, type: 'sawtooth', gain: 0.22 }); noise({ dur: 1.4, freq: 200, gain: 0.3 }); },
  missionComplete() { [392, 523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.09, delay: i * 0.12 })); },
  chest() { noise({ dur: 0.4, freq: 500, freqEnd: 3000, type: 'bandpass', gain: 0.3 }); sfx.engram(3); },
  ui() { tone({ freq: 900, dur: 0.04, type: 'triangle', gain: 0.05 }); },
};
