/* ═══════════════════════════════════════════════════════════════
   UrRoll — scroll engine
   ─ Top progress bar
   ─ HERO: scroll-driven redőny felhúzás (clip-path + bottom rail)
   ─ Nav scrolled state
   ─ Counters, reveal-on-scroll, pull-quote word reveal
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // year stamp
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ── utils ──────────────────────────────────────────────────── */
  const clamp01   = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const lerp      = (a, b, t) => a + (b - a) * t;
  const easeOut   = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ── element refs ───────────────────────────────────────────── */
  const nav        = document.querySelector('.nav');
  const bar        = document.querySelector('.scroll-progress > span');
  const hero       = document.querySelector('.hero');
  const blind      = document.querySelector('.blind');
  const blindRail  = document.querySelector('.blind-rail');
  const heroCopy   = document.querySelector('.hero-copy');
  const scrollHint = document.querySelector('.hero-scroll-hint');

  /* ─────────────────────────────────────────────────────────────
     Reveal-on-scroll
     ───────────────────────────────────────────────────────────── */
  if (!reduced && 'IntersectionObserver' in window) {
    const reveals = document.querySelectorAll(
      '.section-head, .product, .process-step, .why-text, .badge, .gal-item, .cta-text, .cta-card'
    );
    reveals.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
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
     Pull-quote word reveal
     ───────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-reveal-words]').forEach(el => {
    const txt = el.textContent.trim();
    el.innerHTML = txt.split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    if (reduced) { el.querySelectorAll('.w').forEach(w => w.classList.add('in')); return; }
    const words = el.querySelectorAll('.w');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          words.forEach((w, i) => setTimeout(() => w.classList.add('in'), i * 80));
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
  });

  /* ─────────────────────────────────────────────────────────────
     Counters
     ───────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
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
     Scroll engine — rAF, scrub
     - progress bar
     - blind roll-up (clip-path + rail translate)
     - hero copy fade-in (only after blind starts opening)
     - nav scrolled state
     ───────────────────────────────────────────────────────────── */
  let ticking = false;
  const update = () => {
    ticking = false;
    const sy   = window.scrollY;
    const vh   = window.innerHeight;
    const docMax = Math.max(1, document.documentElement.scrollHeight - vh);

    // Progress bar
    if (bar) bar.style.width = (clamp01(sy / docMax) * 100).toFixed(2) + '%';

    // Nav scrolled state
    if (nav) nav.classList.toggle('scrolled', sy > 40);

    // Hero: progress through hero section (0 → 1)
    if (hero) {
      const heroRect = hero.getBoundingClientRect();
      const heroTotal = hero.offsetHeight - vh;  // scrollable length of hero
      const heroScrolled = -heroRect.top;
      const p = clamp01(heroScrolled / heroTotal);

      // Redőny felhúzás (0→1 maps clip-path inset 0% → 100%)
      if (blind) {
        const eased = easeInOut(p);
        blind.style.setProperty('--roll', (eased * 100).toFixed(2) + '%');
      }

      // Alsó léc követi a clip felső szélét (felfelé csúszik)
      if (blindRail) {
        const eased = easeInOut(p);
        // -28px = rail magassága; végén kicsivel a viewport fölött
        // Translate from "bottom of viewport - rail height" (1 - 28/100% ish) to "above viewport"
        // We position by --rail-y CSS variable, expressed as percent of the blind container height.
        // start: 100% - 28px → final: -100% (above)
        const startPct = 100;          // bottom edge (- rail height handled in CSS)
        const endPct   = -10;          // a bit above viewport
        const yPct = lerp(startPct, endPct, eased);
        // We use translateY in % of itself if endpoint was set via CSS calc; easier:
        // set transform directly via JS using vh units for full-height tracking.
        blindRail.style.transform = `translateY(calc(${yPct}vh - 28px))`;
      }

      // Hero copy: subtle "rises into view" once blind starts opening
      if (heroCopy) {
        // 0.0 → 0.25: copy hidden behind blind, slight upward offset
        // 0.25 → 0.55: copy fades in and lifts
        // > 0.55: full opacity, holds
        const cp = clamp01((p - 0.18) / 0.4);
        const op = easeOut(cp);
        const ty = lerp(40, 0, easeOut(cp));
        heroCopy.style.opacity = op.toFixed(3);
        heroCopy.style.transform = `translateY(${ty}px)`;
      }

      // Scroll hint fade out as blind opens
      if (scrollHint) {
        scrollHint.style.opacity = (1 - clamp01(p * 2.5)).toFixed(2);
      }
    }
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };

  if (!reduced) {
    // initial state: hero copy hidden
    if (heroCopy) { heroCopy.style.opacity = '0'; heroCopy.style.transform = 'translateY(40px)'; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    requestAnimationFrame(update);
  } else {
    // reduced motion: open the blind statically
    if (blind) blind.style.setProperty('--roll', '100%');
    if (blindRail) blindRail.style.transform = 'translateY(-10vh)';
    if (heroCopy) { heroCopy.style.opacity = '1'; heroCopy.style.transform = 'none'; }
  }

  /* ─────────────────────────────────────────────────────────────
     Optional gallery photo loader
     If assets/gal-1..4.jpg exist, swap CSS-art placeholders for them
     ───────────────────────────────────────────────────────────── */
  document.querySelectorAll('.gal-photo').forEach((el, i) => {
    const tryExt = (exts) => {
      if (!exts.length) return;
      const src = `assets/gal-${i+1}.${exts[0]}`;
      const probe = new Image();
      probe.onload  = () => { el.style.backgroundImage = `url("${src}")`; };
      probe.onerror = () => tryExt(exts.slice(1));
      probe.src = src;
    };
    tryExt(['jpg','png','jpeg','webp']);
  });
})();
