/* ═══════════════════════════════════════════════════════════════
   MPSPED — minimal vanilla JS
   - Reveal-on-scroll mikroanimációk (IntersectionObserver)
   - Fotó betöltő (assets/truck.{png,jpg,jpeg,webp}) + feltöltő fallback
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // year stamp
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ── Reveal-on-scroll ───────────────────────────────────────── */
  if (!reduced && 'IntersectionObserver' in window) {
    const reveals = document.querySelectorAll(
      '.hero-text, .hero-visual, .section-head, .service, .process-step, .story-text, .story-aside, .map-wrap, .cta-text, .cta-card'
    );
    reveals.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          // soft stagger using index among siblings
          const siblings = Array.from(e.target.parentElement.children).filter(c => c.classList.contains('reveal'));
          const idx = Math.max(0, siblings.indexOf(e.target));
          setTimeout(() => e.target.classList.add('in'), idx * 70);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  }

  /* ── Photo loader (hero) ───────────────────────────────────── */
  const frame = document.querySelector('.hero-photo-frame');
  const heroImg = document.querySelector('.hero-photo');
  if (frame && heroImg) {
    const candidates = [
      'assets/truck.png',  'assets/truck.jpg',  'assets/truck.jpeg', 'assets/truck.webp',
      'assets/Truck.png',  'assets/Truck.jpg',
      'truck.png', 'truck.jpg', 'truck.jpeg', 'truck.webp',
    ];
    const tryNext = (i) => {
      if (i >= candidates.length) {
        console.log('[MPSPED] Nincs fotó az assets/ mappában. Kattints a jobb alsó "📷 Fotó feltöltése" gombra, vagy mentsd a képet ide: assets/truck.png');
        showUploadFallback();
        return;
      }
      const probe = new Image();
      probe.onload  = () => {
        console.log('[MPSPED] Fotó betöltve:', candidates[i]);
        heroImg.src = candidates[i];
        frame.classList.add('has-photo');
      };
      probe.onerror = () => tryNext(i + 1);
      probe.src = candidates[i];
    };
    tryNext(0);
  }

  function showUploadFallback() {
    const wrap = document.createElement('div');
    wrap.className = 'photo-upload';
    wrap.innerHTML = `
      <label>
        <span>📷 Saját fotó feltöltése</span>
        <input type="file" accept="image/*" />
      </label>
      <p>vagy mentsd ide: <code>assets/truck.png</code></p>
    `;
    document.body.appendChild(wrap);
    const input = wrap.querySelector('input');
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        heroImg.src = r.result;
        frame.classList.add('has-photo');
        wrap.remove();
      };
      r.readAsDataURL(f);
    });
  }
})();
