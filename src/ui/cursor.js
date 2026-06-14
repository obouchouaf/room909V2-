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
  el.innerHTML =
    '<span class="cursor-scale">' +
    '<span class="cursor-ring"></span>' +
    '<span class="cursor-tick t"></span><span class="cursor-tick r"></span>' +
    '<span class="cursor-tick b"></span><span class="cursor-tick l"></span>' +
    '<span class="cursor-dot"></span>' +
    '</span>';
  document.body.appendChild(el);

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let cx = tx;
  let cy = ty;
  let shown = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX;
    ty = e.clientY;
    if (!shown) {
      shown = true;
      el.classList.add('show');
    }
  });
  window.addEventListener('pointerdown', () => el.classList.add('down'));
  window.addEventListener('pointerup', () => el.classList.remove('down'));
  document.addEventListener('mouseleave', () => el.classList.remove('show'));

  // lock onto interactive targets
  const interactive = 'a, button, .bar-item, .lineup-name, .cta, .tickets, .stage-arrow, .rc-link, .meta-row';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest && e.target.closest(interactive)) el.classList.add('lock');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest && e.target.closest(interactive)) el.classList.remove('lock');
  });

  const loop = () => {
    cx += (tx - cx) * 0.28;
    cy += (ty - cy) * 0.28;
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
