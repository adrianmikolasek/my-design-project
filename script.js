/* ═══════════════════════════════════════════════════════════════
   MPSPED — interakciós motor
   ─ Preloader függöny
   ─ Nav állapot + olvasási progress
   ─ Hero média parallax
   ─ Scroll reveal (IntersectionObserver)
   ─ Történet út-idővonal: kamion-jelölő + mérföldkő aktiválás
   ─ Térkép útvonal-rajzolás (scrub)
   ─ Idézet szavankénti reveal · számlálók · mágneses gombok
   ─ Fotó-betöltő (assets/truck.*) + böngészős feltöltő fallback
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const lerp    = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIO  = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ───────────────── Preloader ───────────────── */
  const loader = $('.loader');
  if (loader) {
    if (reduced) loader.remove();
    else {
      const hide = () => loader.classList.add('done');
      // betűk + sáv lefutása után gördül fel; max 1.6s
      window.addEventListener('load', () => setTimeout(hide, 350));
      setTimeout(hide, 1600); // biztosíték lassú hálózatra
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }
  }

  /* ───────────────── Scroll reveal ───────────────── */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const sibs = $$('.reveal', e.target.parentElement);
        const idx = Math.max(0, sibs.indexOf(e.target));
        setTimeout(() => e.target.classList.add('in'), idx * 80);
        io.unobserve(e.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ───────────────── Idézet — szavankénti reveal ───────────────── */
  $$('[data-reveal-words]').forEach(el => {
    const txt = el.textContent.trim();
    el.innerHTML = txt.split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    const words = $$('.w', el);
    if (reduced) { words.forEach(w => w.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        words.forEach((w, i) => setTimeout(() => w.classList.add('in'), i * 70));
        io.unobserve(e.target);
      });
    }, { threshold: .4 });
    io.observe(el);
  });

  /* ───────────────── Számlálók ───────────────── */
  $$('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    if (!isFinite(target) || reduced) { el.textContent = target + suffix; return; }
    el.textContent = '0' + suffix;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const t0 = performance.now();
        const dur = 1500;
        const tick = now => {
          const t = clamp01((now - t0) / dur);
          el.textContent = Math.round(lerp(0, target, easeOut(t))) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(e.target);
      });
    }, { threshold: .6 });
    io.observe(el);
  });

  /* ───────────────── Mágneses gombok ───────────────── */
  if (finePointer && !reduced) {
    $$('.magnetic').forEach(el => {
      const strength = 0.28;
      el.addEventListener('pointermove', ev => {
        const r = el.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2);
        const dy = ev.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .45s cubic-bezier(.22,.61,.36,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 460);
      });
    });
  }

  /* ───────────────── Scroll motor (rAF scrub) ───────────────── */
  const nav        = $('#nav');
  const navBar     = $('.nav-progress i');
  const heroMedia  = $('.hero-media');
  const hero       = $('.hero');
  const story      = $('.story');
  const storyGrid  = $('.story-grid');
  const roadFill   = $('.road-fill');
  const roadMarker = $('#roadMarker');
  const milestones = $$('[data-milestone]');
  const mapSection = $('.section--map');
  const routes     = $$('.map-routes path');

  let ticking = false;
  const update = () => {
    ticking = false;
    const sy = window.scrollY;
    const vh = window.innerHeight;
    const docMax = Math.max(1, document.documentElement.scrollHeight - vh);

    if (navBar) navBar.style.width = (clamp01(sy / docMax) * 100).toFixed(2) + '%';
    if (nav) nav.classList.toggle('scrolled', sy > 40);

    // Hero média parallax — lassabban úszik felfelé, finoman nagyít
    if (heroMedia && hero) {
      const hr = hero.getBoundingClientRect();
      const p = clamp01(-hr.top / Math.max(1, hr.height - vh * .4));
      heroMedia.style.transform = `translate3d(0, ${lerp(0, -44, p)}px, 0)`;
    }

    // Történet: út-kitöltés + kamion-jelölő + mérföldkövek
    if (storyGrid && roadMarker) {
      const gr = storyGrid.getBoundingClientRect();
      // a szakasz közepe vezérli: 0 amikor a grid teteje a viewport 75%-án, 1 amikor az alja a 35%-án
      const start = vh * .75;
      const end   = vh * .35;
      const total = gr.height - (start - end);
      const p = clamp01((start - gr.top) / Math.max(1, total));
      const eased = p; // lineáris követés — a jelölő "vezet"
      if (roadFill) roadFill.style.height = (eased * 100).toFixed(2) + '%';
      roadMarker.style.top = (eased * 100).toFixed(2) + '%';

      // mérföldkövek aktiválása, amikor a jelölő elérte őket
      milestones.forEach(ms => {
        const mr = ms.getBoundingClientRect();
        const msCenterInGrid = (mr.top + mr.height * .35 - gr.top) / Math.max(1, gr.height);
        ms.classList.toggle('active', eased >= msCenterInGrid - .02);
      });
    }

    // Térkép útvonalak rajzolása
    if (routes.length && mapSection) {
      const r = mapSection.getBoundingClientRect();
      const p = clamp01((vh * .85 - r.top) / (vh * .5));
      routes.forEach((path, i) => {
        const s = (i / routes.length) * .55;
        const pp = clamp01((p - s) / .45);
        path.style.strokeDashoffset = (1 - easeIO(pp)).toFixed(3);
        path.style.opacity = (.45 + .55 * pp).toFixed(2);
      });
    }
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };

  if (!reduced) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    requestAnimationFrame(update);
  } else {
    routes.forEach(p => { p.style.strokeDashoffset = '0'; p.style.opacity = '1'; });
    milestones.forEach(ms => ms.classList.add('active'));
    if (roadFill) roadFill.style.height = '100%';
  }

  /* ───────────────── Fotó-betöltő ───────────────── */
  const frame = $('#heroFrame');
  const photo = $('.hero-photo');
  if (frame && photo) {
    const candidates = [
      'assets/truck.png', 'assets/truck.jpg', 'assets/truck.jpeg', 'assets/truck.webp',
      'assets/Truck.png', 'assets/Truck.jpg',
      'truck.png', 'truck.jpg', 'truck.jpeg', 'truck.webp',
    ];
    const tryNext = i => {
      if (i >= candidates.length) { showUpload(); return; }
      const probe = new Image();
      probe.onload  = () => { photo.src = candidates[i]; frame.classList.add('has-photo'); };
      probe.onerror = () => tryNext(i + 1);
      probe.src = candidates[i];
    };
    tryNext(0);
  }

  function showUpload() {
    const wrap = document.createElement('div');
    wrap.className = 'photo-upload';
    wrap.innerHTML = `
      <label>
        <span>📷 Saját fotó feltöltése</span>
        <input type="file" accept="image/*" />
      </label>
      <p>vagy mentsd ide: <code>assets/truck.png</code></p>`;
    document.body.appendChild(wrap);
    $('input', wrap).addEventListener('change', ev => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { photo.src = r.result; frame.classList.add('has-photo'); wrap.remove(); };
      r.readAsDataURL(f);
    });
  }
})();
