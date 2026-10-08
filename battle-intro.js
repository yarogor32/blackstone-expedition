(() => {
  'use strict';
  // Battle_Start-377333b7: retained source frames 1–73; loop bridge omitted.
  const image = new Image();
  image.src = 'sprites/battle-start-v1.png';
  const ready = image.decode();
  ready.catch(() => {});
  const frames = 73, fps = 24, duration = frames / fps * 1000;
  window.BattleIntro = {
    warm: () => ready,
    play(parent) {
      let stopped = false, request = 0, canvas;
      const stop = () => { stopped = true; cancelAnimationFrame(request); canvas?.remove(); };
      ready.then(() => {
        if (stopped || !parent?.isConnected) return;
        canvas = document.createElement('canvas');
        canvas.className = 'battle-start-sequence';
        canvas.width = canvas.height = 256;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Combat begins');
        parent.append(canvas);
        const ctx = canvas.getContext('2d'), start = performance.now();
        let previous = -1;
        function draw(now) {
          const elapsed = now - start;
          if (stopped || !canvas.isConnected || elapsed >= duration) { stop(); return; }
          const frame = Math.min(frames - 1, Math.floor(elapsed * fps / 1000));
          if (frame !== previous) {
            ctx.clearRect(0, 0, 256, 256);
            ctx.drawImage(image, 2 + frame % 8 * 260, 2 + Math.floor(frame / 8) * 260, 256, 256, 0, 0, 256, 256);
            previous = frame;
          }
          canvas.style.opacity = String(Math.min(1, (duration - elapsed) / 300));
          request = requestAnimationFrame(draw);
        }
        request = requestAnimationFrame(draw);
      }).catch(stop);
      return stop;
    }
  };
})();
