/* ═══════════════════════════════════════════════════════════════
   MPSPED · scroll choreography (vanilla, no GSAP)
   Each .scene-wrap is taller than the viewport. Its .stage is
   position: sticky inside, so it "pins" while we scroll through
   the wrap's extra height. We compute a 0→1 progress per scene
   and drive transforms / opacity via CSS variables + direct
   element style writes (transform/opacity only — GPU friendly).
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // ── easings ────────────────────────────────────────────────
  const easeOut    = t => 1 - Math.pow(1 - t, 3);
  const easeIn     = t => t * t * t;
  const easeInOut  = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp       = (a, b, t) => a + (b - a) * t;
  const clamp01    = t => t < 0 ? 0 : t > 1 ? 1 : t;

  // ── progress bar (whole doc) ───────────────────────────────
  const bar = document.querySelector('.progress-bar');

  // ── compute per-wrap progress ──────────────────────────────
  const wraps = Array.from(document.querySelectorAll('.scene-wrap'));
  const progressFor = (wrap) => {
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight;
    // wrap.height equals var(--length). pin starts when top hits 0,
    // ends when bottom passes through 100vh of scrolling.
    const total = rect.height - vh;
    if (total <= 0) return rect.top < 0 ? 1 : 0;
    const scrolled = -rect.top; // pixels scrolled past wrap top
    return clamp01(scrolled / total);
  };

  // ── scene-specific updaters ────────────────────────────────
  const scenes = {

    /* ───────── DEPOT ───────── */
    depot(wrap, p) {
      // 0.00 → 0.45  : door rises, spill grows, headlights ignite
      // 0.30 → 0.85  : truck dollies forward (scale + slight y)
      // 0.55 → 1.00  : copy fades + drifts up; floor brightens
      const doorP   = clamp01(p / 0.45);
      const spillP  = clamp01((p - 0.05) / 0.40);
      const lightP  = clamp01((p - 0.10) / 0.35);
      const dollyP  = clamp01((p - 0.25) / 0.65);
      const copyP   = clamp01((p - 0.55) / 0.40);

      const door = wrap.querySelector('.door-panels');
      if (door) door.setAttribute('style', `transform: translateY(${-100 * easeInOut(doorP)}%)`);

      const spill = wrap.querySelector('.layer--spill');
      if (spill) spill.style.opacity = (easeOut(spillP)).toFixed(3);

      wrap.querySelectorAll('.headlight').forEach(h => {
        h.style.opacity = (easeOut(lightP) * 0.9).toFixed(3);
      });

      const truck = wrap.querySelector('.truck-wrap');
      if (truck) {
        const s = lerp(1, 1.22, easeInOut(dollyP));
        const ty = lerp(0, 30, easeInOut(dollyP));
        truck.style.transform = `translateY(${ty}px) scale(${s})`;
      }

      const copy = wrap.querySelector('.copy--depot');
      if (copy) {
        copy.style.opacity = (1 - copyP).toFixed(3);
        copy.style.transform = `translate(-50%, ${-30 * copyP}px)`;
      }

      const floor = wrap.querySelector('.layer--floor');
      if (floor) floor.style.opacity = (1 + easeOut(lightP) * 0.4).toString();
    },

    /* ───────── ROAD ───────── */
    road(wrap, p) {
      // Parallax layers move at different rates; truck zooms in;
      // copy/stats stagger in around mid-scroll.
      const set = (sel, fn) => { const el = wrap.querySelector(sel); if (el) fn(el); };

      // Sun rises through the scene
      set('.layer--sun', el => {
        const t = easeOut(p);
        el.style.transform = `translateY(${lerp(35, -10, t)}%)`;
      });

      // Far hills (slow)
      set('.layer--hills-far', el => {
        el.style.transform = `translateY(${lerp(40, -8, p)}%) scale(${lerp(1.08, 1, p)})`;
      });
      // Mid hills
      set('.layer--hills-mid', el => {
        el.style.transform = `translateY(${lerp(60, -14, p)}%) scale(${lerp(1.1, 1, p)})`;
      });
      // Near hills (fast)
      set('.layer--hills-near', el => {
        el.style.transform = `translateY(${lerp(80, -22, p)}%) scale(${lerp(1.14, 1, p)})`;
      });
      // Road perspective
      set('.layer--road', el => {
        el.style.transform = `translateY(${lerp(90, -10, p)}%) scale(${lerp(1.25, 1, p)})`;
      });

      // Truck: starts small/distant, grows large/near
      const truckP = clamp01((p - 0.05) / 0.85);
      set('.truck--road', el => {
        const s = lerp(.45, 1.1, easeOut(truckP));
        const ty = lerp(20, 0, easeOut(truckP));
        el.style.transform = `translateY(${ty}%) scale(${s})`;
      });
      set('.truck-shadow--road', el => {
        const s = lerp(.3, 1, easeOut(truckP));
        el.style.transform = `translateX(-50%) scaleX(${s})`;
        el.style.opacity = easeOut(truckP).toFixed(3);
      });
      set('.dust', el => {
        const t = clamp01((p - 0.25) / 0.6);
        el.style.opacity = easeOut(t).toFixed(3);
      });

      // Copy + stats
      const copyP = clamp01((p - 0.35) / 0.5);
      set('.copy--left', el => {
        el.style.opacity = easeOut(copyP).toFixed(3);
        el.style.transform = `translateX(${lerp(-40, 0, easeOut(copyP))}px)`;
      });
      const stats = wrap.querySelectorAll('.stat-row li');
      stats.forEach((li, i) => {
        const sp = clamp01((p - 0.5 - i * 0.04) / 0.4);
        li.style.opacity = easeOut(sp).toFixed(3);
        li.style.transform = `translateY(${lerp(20, 0, easeOut(sp))}px)`;
      });
    },

    /* ───────── HIGHWAY ───────── */
    highway(wrap, p) {
      // Truck flies from left to right while motion streaks accelerate.
      const set = (sel, fn) => { const el = wrap.querySelector(sel); if (el) fn(el); };

      set('.truck--hwy', el => {
        const x = lerp(-90, 90, easeInOut(p));
        const rot = lerp(-1.2, 1.2, p);
        el.style.transform = `translateX(${x}%) rotate(${rot}deg)`;
      });
      set('.motion-blur', el => {
        const t = clamp01(Math.sin(p * Math.PI));
        el.style.opacity = (0.85 * t).toFixed(3);
      });
      set('.layer--streaks', el => {
        el.style.transform = `translateX(${lerp(20, -40, p)}%)`;
      });

      const rush = wrap.querySelectorAll('.rush-lines i');
      rush.forEach((el, i) => {
        const delay = i * 0.07;
        const lp = clamp01((p - delay) / (1 - delay));
        const x = lerp(-110, 130, easeIn(lp));
        const op = easeOut(clamp01(lp * 2)) * (1 - clamp01((lp - 0.7) / 0.3));
        el.style.transform = `translateX(${x}%)`;
        el.style.opacity = op.toFixed(3);
      });

      const copyP = clamp01((p - 0.15) / 0.45);
      set('.copy--right', el => {
        el.style.opacity = easeOut(copyP).toFixed(3);
        el.style.transform = `translateX(${lerp(40, 0, easeOut(copyP))}px)`;
      });
    },

    /* ───────── MAP ───────── */
    map(wrap, p) {
      const set = (sel, fn) => { const el = wrap.querySelector(sel); if (el) fn(el); };

      // Pull back from very zoomed in to natural
      set('.europe', el => {
        const s = lerp(1.8, 1, easeOut(clamp01(p / 0.5)));
        const ty = lerp(8, 0, easeOut(clamp01(p / 0.5)));
        el.style.transform = `scale(${s}) translateY(${ty}%)`;
        el.style.opacity = lerp(0.2, 1, easeOut(clamp01(p / 0.4))).toFixed(3);
      });

      // Routes draw in (each path staggered)
      const routes = wrap.querySelectorAll('.routes path');
      routes.forEach((path, i) => {
        const start = 0.35 + (i / routes.length) * 0.35;
        const rp = clamp01((p - start) / 0.25);
        path.style.strokeDashoffset = (600 * (1 - easeOut(rp))).toFixed(1);
      });

      // Nodes pop
      const nodes = wrap.querySelectorAll('.nodes circle');
      nodes.forEach((c, i) => {
        const start = 0.45 + (i / nodes.length) * 0.35;
        const np = clamp01((p - start) / 0.18);
        const s = lerp(0, 1.15, easeOut(np)) * (1 - 0.15 * (1 - np));
        c.style.opacity = easeOut(np).toFixed(3);
        c.style.transformOrigin = `${c.getAttribute('cx')}px ${c.getAttribute('cy')}px`;
        c.style.transform = `scale(${Math.max(0, s)})`;
      });

      // Copy fade-in near end
      const copyP = clamp01((p - 0.55) / 0.4);
      set('.copy--center', el => {
        el.style.opacity = easeOut(copyP).toFixed(3);
        el.style.transform = `translate(-50%, ${lerp(30, 0, easeOut(copyP))}px)`;
      });
    },

    /* ───────── ARRIVAL ───────── */
    arrival(wrap, p) {
      const set = (sel, fn) => { const el = wrap.querySelector(sel); if (el) fn(el); };

      set('.sun--dusk', el => {
        const t = easeOut(p);
        el.style.transform = `translateY(${lerp(40, 0, t)}%) scale(${lerp(.85, 1, t)})`;
        el.style.opacity = lerp(.4, 1, t).toFixed(3);
      });
      set('.layer--dusk-hills', el => {
        el.style.transform = `translateY(${lerp(30, 0, p)}%) scale(${lerp(1.06, 1, p)})`;
      });
      set('.truck--arrival', el => {
        const t = easeOut(clamp01(p / 0.7));
        el.style.transform = `translateX(${lerp(-80, 0, t)}%) scale(${lerp(.85, 1, t)})`;
      });
      const copyP = clamp01((p - 0.35) / 0.5);
      set('.contact-copy', el => {
        el.style.opacity = easeOut(copyP).toFixed(3);
        el.style.transform = `translateX(-50%) translateY(${lerp(30, 0, easeOut(copyP))}px)`;
      });
    },
  };

  // ── reveal grid items (services) via IntersectionObserver ──
  const svc = document.querySelectorAll('.svc');
  if (svc.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          // stagger using element index
          const idx = Array.from(svc).indexOf(e.target);
          setTimeout(() => e.target.classList.add('in'), idx * 70);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    svc.forEach(el => io.observe(el));
  } else {
    svc.forEach(el => el.classList.add('in'));
  }

  // ── master rAF loop ────────────────────────────────────────
  let ticking = false;
  const update = () => {
    ticking = false;
    if (bar) {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const sp = docH > 0 ? window.scrollY / docH : 0;
      bar.style.width = (clamp01(sp) * 100).toFixed(2) + '%';
    }
    wraps.forEach(w => {
      const name = w.dataset.scene;
      const fn = scenes[name];
      if (!fn) return;
      const p = progressFor(w);
      // Only update scenes near the viewport for perf
      const rect = w.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < -vh || rect.top > vh * 2) return;
      fn(w, p);
    });
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  if (reduced) {
    // Skip scroll-driven choreo; reveal final state.
    document.querySelectorAll('.routes path').forEach(p => p.style.strokeDashoffset = '0');
    document.querySelectorAll('.nodes circle').forEach(c => { c.style.opacity = '1'; c.style.transform = 'scale(1)'; });
    document.querySelectorAll('.svc').forEach(el => el.classList.add('in'));
    return;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // initial paint
  requestAnimationFrame(update);
})();
