// Синтезированные звуки (без файлов): шелест карт, щелчок, фанфары.
const Sound = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('durak-muted') === '1'; } catch (e) { /* хранилище недоступно */ }

  function audio() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(duration, freq, gain) {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * duration);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(a.destination);
    src.start();
  }

  function tone(freq, start, dur, type = 'triangle', gain = 0.12) {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = a.currentTime + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  let lastCard = 0;
  return {
    card() {
      const now = performance.now();
      if (now - lastCard < 45) return;
      lastCard = now;
      noise(0.12, 2400 + Math.random() * 1200, 0.35);
    },
    click() { noise(0.04, 1800, 0.25); },
    error() { tone(180, 0, 0.18, 'square', 0.05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.45, 'sine', 0.1)); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('durak-muted', muted ? '1' : '0'); } catch (e) { /* ничего */ }
      return muted;
    },
  };
})();
