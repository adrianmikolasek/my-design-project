/* ═══════════════════════════════════════════════════════════════
   MPSPED — editorial scroll engine
   ─ Reveal-on-scroll cards/text via IntersectionObserver
   ─ Top progress bar (rAF, scrub)
   ─ Hero photo parallax (rAF, scrub)
   ─ Stats counters (1989, 30) animate when in view
   ─ Map routes draw-on-scroll (scrub through the map section)
   ─ Pull-quote word-by-word reveal
   ─ Photo loader (assets/truck.{png,jpg,jpeg,webp}) + upload fallback
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ── small utils ────────────────────────────────────────────── */
  const clamp01   = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const lerp      = (a, b, t) => a + (b - a) * t;
  const easeOut   = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ─────────────────────────────────────────────────────────────
     Reveal-on-scroll for cards & sections
     ───────────────────────────────────────────────────────────── */
  if (!reduced && 'IntersectionObserver' in window) {
    const reveals = document.querySelectorAll(
      '.hero-text, .hero-visual, .section-head, .service, .process-step, .story-text, .story-aside, .map-wrap, .cta-text, .cta-card'
    );
    reveals.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const sibs = Array.from(e.target.parentElement.children).filter(c => c.classList.contains('reveal'));
          const idx = Math.max(0, sibs.indexOf(e.target));
          setTimeout(() => e.target.classList.add('in'), idx * 70);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  }

  /* ─────────────────────────────────────────────────────────────
     1) Pull-quote word-by-word reveal
        Split text into <span class="w"> for each word at load.
     ───────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-reveal-words]').forEach(el => {
    const txt = el.textContent.trim();
    el.innerHTML = txt.split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    if (reduced) { el.querySelectorAll('.w').forEach(w => w.classList.add('in')); return; }
    const words = el.querySelectorAll('.w');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          words.forEach((w, i) => setTimeout(() => w.classList.add('in'), i * 90));
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
  });

  /* ─────────────────────────────────────────────────────────────
     2) Stats counters — animate when in view
     ───────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    if (!isFinite(target) || reduced) { el.textContent = target + suffix; return; }
    el.textContent = '0' + suffix;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const dur = 1400;
          const t0 = performance.now();
          const tick = (now) => {
            const t = clamp01((now - t0) / dur);
            const v = Math.round(lerp(0, target, easeOut(t)));
            el.textContent = v + suffix;
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ─────────────────────────────────────────────────────────────
     3 + 4 + 5) Scroll-driven scrub:
        ─ Progress bar       (whole document)
        ─ Hero photo parallax (within hero section)
        ─ Map routes drawing  (within map section)
     ───────────────────────────────────────────────────────────── */
  const bar  = document.querySelector('.scroll-progress > span');
  const heroFrame = document.querySelector('.hero-photo-frame');
  const heroSection = document.querySelector('.hero');
  const mapSection = document.querySelector('.section--coverage');
  const routes = document.querySelectorAll('.map-routes path');

  let ticking = false;
  const update = () => {
    ticking = false;
    const sy = window.scrollY;
    const vh = window.innerHeight;
    const docMax = Math.max(1, document.documentElement.scrollHeight - vh);

    // Progress bar
    if (bar) {
      const p = clamp01(sy / docMax);
      bar.style.width = (p * 100).toFixed(2) + '%';
    }

    // Hero photo parallax (subtle: lift + scale as user scrolls past hero)
    if (heroFrame && heroSection) {
      const r = heroSection.getBoundingClientRect();
      // p = 0 at top of viewport, → 1 when hero fully scrolled away
      const p = clamp01(-r.top / (r.height + vh * 0.4));
      // translateY -3vh, scale 1.0 → 1.04
      const ty = lerp(0, -36, p);
      const sc = lerp(1, 1.04, p);
      heroFrame.style.transform = `translate3d(0, ${ty}px, 0) scale(${sc})`;
    }

    // Map routes draw-in
    if (routes.length && mapSection) {
      const r = mapSection.getBoundingClientRect();
      // start drawing when section top reaches 80% of viewport,
      // finish by the time it reaches 30% of viewport
      const startY = vh * 0.8;
      const endY   = vh * 0.3;
      const p = clamp01((startY - r.top) / (startY - endY));
      // stagger across the routes
      routes.forEach((path, i) => {
        const start = i / routes.length * 0.6; // staggered start within p
        const end   = start + 0.4;
        const pp = clamp01((p - start) / (end - start));
        // stroke-dasharray=1, dashoffset goes from 1 → 0
        path.style.strokeDashoffset = (1 - easeInOut(pp)).toFixed(3);
        path.style.opacity = (0.5 + 0.5 * pp).toFixed(2);
      });
    }
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };

  if (!reduced) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    requestAnimationFrame(update); // initial paint
  } else {
    // Reduced motion: paint final state of routes
    routes.forEach(p => { p.style.strokeDashoffset = '0'; p.style.opacity = '1'; });
  }

  /* ─────────────────────────────────────────────────────────────
     Photo loader (hero)
     ───────────────────────────────────────────────────────────── */
  const frame  = document.querySelector('.hero-photo-frame');
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
      probe.onload  = () => { console.log('[MPSPED] Fotó betöltve:', candidates[i]); heroImg.src = candidates[i]; frame.classList.add('has-photo'); };
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
      r.onload = () => { heroImg.src = r.result; frame.classList.add('has-photo'); wrap.remove(); };
      r.readAsDataURL(f);
    });
  }
})();
