(() => {
  'use strict';
  // Independent transparent tiers painted from the supplied Blender renders.
  window.MenuDepth = {render: () => `<div class="menu-depth" aria-hidden="true"><img class="menu-depth-space" src="backgrounds/main-menu-nebula-v2.png" alt="" draggable="false"><img class="menu-depth-debris" src="backgrounds/main-menu-debris-v2.png" alt="" draggable="false"><div class="menu-depth-fortress">${['lower','middle','upper'].map(tier => `<img class="menu-depth-layer menu-depth-${tier}" src="backgrounds/menu-fortress-${tier}-v4.png" alt="" draggable="false">`).join('')}</div></div>`};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, x = 0, y = 0, currentX = 0, currentY = 0, lastTime = 0;
  function update(time) {
    frame = 0;
    const scene = document.querySelector('.main-menu');
    if (!scene) return;
    const dt = Math.min((time - lastTime) / 1000 || 1 / 60, .05);
    lastTime = time;
    const blend = 1 - Math.exp(-dt * 3.5);
    currentX = reduced.matches ? 0 : currentX + (x - currentX) * blend;
    currentY = reduced.matches ? 0 : currentY + (y - currentY) * blend;
    scene.style.setProperty('--menu-mouse-x', currentX);
    scene.style.setProperty('--menu-mouse-y', currentY);
    if (!reduced.matches && (Math.abs(x - currentX) > .001 || Math.abs(y - currentY) > .001)) schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !document.querySelector('.main-menu') || reduced.matches) return;
    x = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1));
    y = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1));
    schedule();
  }, {passive:true});
  function reset() { x = y = 0; schedule(); }
  document.documentElement.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  reduced.addEventListener('change', reset);
})();
