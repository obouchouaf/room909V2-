/**
 * Custom cursor — a small ember "focus reticle" in the site's language: a
 * ring with four corner ticks and a centre dot, trailing the pointer with a
 * little lerp, rotating slowly, pulsing on the 128 BPM beat, and locking
 * onto interactive elements. Disabled on touch / coarse pointers, where the
 * native behaviour is fine.
 */
export function initCursor() {
  if (matchMedia('(pointer: coarse)').matches) return;

  const root = document.documentElement;
  root.classList.add('has-cursor');

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  // a TR-808 knob: charcoal body, ember collar, a pointer indicator
  el.innerHTML =
    '<span class="cursor-scale">' +
    '<span class="knob"></span>' +
    '<span class="knob-pointer"></span>' +
    '</span>';
  document.body.appendChild(el);
  el.classList.add('show'); // always present (incl. fullscreen)

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let cx = tx;
  let cy = ty;

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      tx = e.clientX;
      ty = e.clientY;
      el.classList.add('show');
    },
    { passive: true }
  );
  window.addEventListener('pointerdown', () => el.classList.add('down'));
  window.addEventListener('pointerup', () => el.classList.remove('down'));
  // keep working through fullscreen transitions — re-host in the fullscreen
  // element so the knob is never orphaned outside the fullscreen layer
  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement;
    (fs || document.body).appendChild(el);
  });

  // lock onto interactive targets
  const interactive = 'a, button, .bar-item, .lineup-name, .cta, .tickets, .stage-arrow, .rc-link, .meta-row';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest && e.target.closest(interactive)) el.classList.add('lock');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest && e.target.closest(interactive)) el.classList.remove('lock');
  });

  const scale = el.querySelector('.cursor-scale');
  let kick = 0;

  const loop = (now) => {
    cx += (tx - cx) * 0.28;
    cy += (ty - cy) * 0.28;
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    // gentle idle breathing + a punch on each detected kick (driven by the App)
    const idle = 0.95 + 0.04 * Math.sin(now * 0.004);
    scale.style.transform = `scale(${(idle + kick * 0.24).toFixed(3)})`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // the App feeds the real detected kick here so the knob pulses on the beat
  return {
    pulse: (k) => {
      kick = k || 0;
    }
  };
}
