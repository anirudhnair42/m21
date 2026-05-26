/**
 * Mail notification chime — synthesized via Web Audio so we don't need
 * a sound asset. Two-tone bell with a soft decay.
 */
export function playMailChime(): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.18, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    const tone = (freq: number, when: number, dur: number, vol = 1) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g).connect(master);
      o.start(when);
      o.stop(when + dur + 0.05);
    };

    tone(1175, now, 1.15, 0.55); // D6
    tone(1568, now + 0.08, 0.95, 0.4); // G6
    tone(2349, now + 0.02, 0.3, 0.18); // D7 sparkle
  } catch {
    // chime is non-critical; swallow failures
  }
}
