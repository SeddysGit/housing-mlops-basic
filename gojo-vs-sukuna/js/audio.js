/* ============================================================
   AUDIO — all SFX/BGM synthesized with WebAudio (no assets)
   ============================================================ */
(function () {
  const AudioSys = {
    ctx: null,
    master: null,
    sfxGain: null,
    bgmGain: null,
    muted: false,
    bgmTimer: null,
    started: false,
  };

  AudioSys.init = function () {
    if (AudioSys.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    AudioSys.ctx = new AC();
    AudioSys.master = AudioSys.ctx.createGain();
    AudioSys.master.gain.value = 0.55;
    AudioSys.master.connect(AudioSys.ctx.destination);
    AudioSys.sfxGain = AudioSys.ctx.createGain();
    AudioSys.sfxGain.gain.value = 1.0;
    AudioSys.sfxGain.connect(AudioSys.master);
    AudioSys.bgmGain = AudioSys.ctx.createGain();
    AudioSys.bgmGain.gain.value = 0.16;
    AudioSys.bgmGain.connect(AudioSys.master);
  };

  AudioSys.unlock = function () {
    AudioSys.init();
    if (!AudioSys.ctx) return;
    if (AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
    if (!AudioSys.started) {
      AudioSys.started = true;
      AudioSys.startBGM();
    }
  };

  AudioSys.toggleMute = function () {
    AudioSys.muted = !AudioSys.muted;
    if (AudioSys.master) {
      AudioSys.master.gain.value = AudioSys.muted ? 0 : 0.55;
    }
    return AudioSys.muted;
  };

  function now() { return AudioSys.ctx ? AudioSys.ctx.currentTime : 0; }

  function env(gainNode, t0, attack, peak, decay, sustainLevel, release) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack);
    if (release > 0) {
      g.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.0001), t0 + attack + decay);
      g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + release);
    } else {
      g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    }
  }

  function osc(type, freq, dest) {
    const o = AudioSys.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = AudioSys.ctx.createGain();
    o.connect(g);
    g.connect(dest || AudioSys.sfxGain);
    return { o, g };
  }

  function noiseBuffer(seconds) {
    const sr = AudioSys.ctx.sampleRate;
    const buf = AudioSys.ctx.createBuffer(1, Math.max(1, Math.floor(sr * seconds)), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noise(seconds, filterType, filterFreq, dest) {
    const src = AudioSys.ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds);
    const f = AudioSys.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    const g = AudioSys.ctx.createGain();
    src.connect(f); f.connect(g); g.connect(dest || AudioSys.sfxGain);
    return { src, f, g };
  }

  /* ---------- SFX ---------- */

  AudioSys.swoosh = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const n = noise(0.22, 'bandpass', 900);
    n.f.frequency.setValueAtTime(500, t0);
    n.f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.18);
    env(n.g, t0, 0.01, 0.25, 0.06, 0.08, 0.14);
    n.src.start(t0); n.src.stop(t0 + 0.25);
  };

  AudioSys.hit = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const { o, g } = osc('square', 160);
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.1);
    env(g, t0, 0.005, 0.5, 0.1, 0.05, 0.05);
    o.start(t0); o.stop(t0 + 0.2);
    const n = noise(0.1, 'lowpass', 1200);
    env(n.g, t0, 0.002, 0.4, 0.08, 0.02, 0.02);
    n.src.start(t0); n.src.stop(t0 + 0.12);
  };

  AudioSys.heavyHit = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const { o, g } = osc('sawtooth', 110);
    o.frequency.exponentialRampToValueAtTime(35, t0 + 0.22);
    env(g, t0, 0.004, 0.7, 0.2, 0.06, 0.1);
    o.start(t0); o.stop(t0 + 0.36);
    const n = noise(0.25, 'lowpass', 700);
    env(n.g, t0, 0.002, 0.6, 0.18, 0.03, 0.06);
    n.src.start(t0); n.src.stop(t0 + 0.3);
  };

  AudioSys.block = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const { o, g } = osc('triangle', 800);
    o.frequency.exponentialRampToValueAtTime(300, t0 + 0.08);
    env(g, t0, 0.003, 0.3, 0.07, 0.02, 0.03);
    o.start(t0); o.stop(t0 + 0.15);
  };

  AudioSys.dash = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const n = noise(0.18, 'highpass', 1500);
    env(n.g, t0, 0.005, 0.18, 0.05, 0.05, 0.1);
    n.src.start(t0); n.src.stop(t0 + 0.2);
  };

  AudioSys.charge = function (durSec) {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const d = durSec || 0.8;
    const { o, g } = osc('sawtooth', 80);
    o.frequency.exponentialRampToValueAtTime(700, t0 + d);
    env(g, t0, 0.05, 0.22, d - 0.1, 0.15, 0.1);
    o.start(t0); o.stop(t0 + d + 0.15);
  };

  AudioSys.blast = function (baseFreq) {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const f = baseFreq || 220;
    const { o, g } = osc('sawtooth', f);
    o.frequency.exponentialRampToValueAtTime(f * 0.3, t0 + 0.3);
    env(g, t0, 0.005, 0.5, 0.25, 0.05, 0.1);
    o.start(t0); o.stop(t0 + 0.4);
    const n = noise(0.3, 'bandpass', f * 4);
    env(n.g, t0, 0.004, 0.35, 0.22, 0.03, 0.08);
    n.src.start(t0); n.src.stop(t0 + 0.35);
  };

  AudioSys.explosion = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const n = noise(0.9, 'lowpass', 3000);
    n.f.frequency.setValueAtTime(3000, t0);
    n.f.frequency.exponentialRampToValueAtTime(120, t0 + 0.7);
    env(n.g, t0, 0.004, 0.9, 0.5, 0.08, 0.35);
    n.src.start(t0); n.src.stop(t0 + 0.95);
    const { o, g } = osc('sine', 70);
    o.frequency.exponentialRampToValueAtTime(28, t0 + 0.6);
    env(g, t0, 0.005, 0.8, 0.5, 0.05, 0.3);
    o.start(t0); o.stop(t0 + 0.9);
  };

  AudioSys.slash = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const n = noise(0.16, 'highpass', 2500);
    env(n.g, t0, 0.002, 0.3, 0.04, 0.06, 0.09);
    n.src.start(t0); n.src.stop(t0 + 0.18);
    const { o, g } = osc('sawtooth', 1800);
    o.frequency.exponentialRampToValueAtTime(500, t0 + 0.1);
    env(g, t0, 0.002, 0.12, 0.08, 0.02, 0.04);
    o.start(t0); o.stop(t0 + 0.16);
  };

  AudioSys.blackFlash = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const { o, g } = osc('square', 55);
    o.frequency.exponentialRampToValueAtTime(20, t0 + 0.35);
    env(g, t0, 0.002, 0.9, 0.3, 0.05, 0.15);
    o.start(t0); o.stop(t0 + 0.5);
    const z = osc('sawtooth', 2200);
    z.o.frequency.exponentialRampToValueAtTime(150, t0 + 0.25);
    env(z.g, t0, 0.002, 0.35, 0.2, 0.02, 0.08);
    z.o.start(t0); z.o.stop(t0 + 0.32);
  };

  AudioSys.domain = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    // deep rising drone + shimmering bell
    const a = osc('sawtooth', 40);
    a.o.frequency.exponentialRampToValueAtTime(90, t0 + 1.2);
    env(a.g, t0, 0.2, 0.6, 1.0, 0.2, 0.8);
    a.o.start(t0); a.o.stop(t0 + 2.2);
    const b = osc('sine', 880);
    b.o.frequency.exponentialRampToValueAtTime(1760, t0 + 1.4);
    env(b.g, t0, 0.4, 0.18, 1.0, 0.05, 0.6);
    b.o.start(t0); b.o.stop(t0 + 2.2);
    const n = noise(2.0, 'bandpass', 500);
    n.f.frequency.exponentialRampToValueAtTime(4000, t0 + 1.8);
    env(n.g, t0, 0.3, 0.25, 1.4, 0.04, 0.3);
    n.src.start(t0); n.src.stop(t0 + 2.05);
  };

  AudioSys.announce = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const { o, g } = osc('triangle', 440);
    o.frequency.setValueAtTime(440, t0);
    o.frequency.setValueAtTime(660, t0 + 0.09);
    env(g, t0, 0.01, 0.3, 0.15, 0.05, 0.1);
    o.start(t0); o.stop(t0 + 0.3);
  };

  AudioSys.ko = function () {
    if (!AudioSys.ctx) return;
    const t0 = now();
    const { o, g } = osc('sawtooth', 300);
    o.frequency.exponentialRampToValueAtTime(50, t0 + 0.9);
    env(g, t0, 0.005, 0.8, 0.7, 0.06, 0.3);
    o.start(t0); o.stop(t0 + 1.1);
    AudioSys.explosion();
  };

  /* ---------- BGM: minimal dark loop ---------- */
  AudioSys.startBGM = function () {
    if (!AudioSys.ctx || AudioSys.bgmTimer) return;
    const bassLine = [55, 55, 65.4, 55, 49, 49, 55, 43.65]; // A1 A1 C2 A1 G1 G1 A1 F1
    let step = 0;
    const stepDur = 0.42;
    function schedule() {
      if (!AudioSys.ctx) return;
      const t0 = now() + 0.05;
      const f = bassLine[step % bassLine.length];
      const { o, g } = osc('triangle', f, AudioSys.bgmGain);
      env(g, t0, 0.01, 0.5, stepDur * 0.5, 0.1, stepDur * 0.4);
      o.start(t0); o.stop(t0 + stepDur);
      // hat every other step
      if (step % 2 === 0) {
        const n = noise(0.05, 'highpass', 7000, AudioSys.bgmGain);
        env(n.g, t0, 0.001, 0.12, 0.03, 0.02, 0.02);
        n.src.start(t0); n.src.stop(t0 + 0.06);
      }
      step++;
    }
    AudioSys.bgmTimer = setInterval(schedule, 420);
  };

  window.AudioSys = AudioSys;
})();
