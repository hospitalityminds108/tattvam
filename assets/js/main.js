// Tat:vm — interactions (reveals, counters, carousels, tattva system, video hero)
// NOTE: no custom cursor / dot follower (per client request)

const MOJIBAKE_MAP = {
  'â€”': '—', 'â€“': '–', 'â€™': '’', 'â€˜': '‘', 'â€œ': '“', 'â€': '”', 'â€': '“',
  'Â·': '·', 'â‚¹': '₹', 'Â': ' ', 'Â©': '©', 'Â®': '®', 'Â»': '»', 'â†’': '→',
  'Ã§': 'ç', 'Ã¼': 'ü', 'Ã©': 'é', 'Ã¡': 'á', 'Ã³': 'ó', 'Ã±': 'ñ', 'Ã¤': 'ä', 'Ã¶': 'ö',
  'Ã‰': 'É', 'Ã€': 'À', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'ÃŸ': 'ß', 'Ã¨': 'è', 'Ãª': 'ê', 'Ã¢': 'â',
  'Ã´': 'ô', 'Ã®': 'î', 'Ã¯': 'ï', 'Ã£': 'ã', 'Ã¹': 'ù', 'Ãº': 'ú', 'Ã¿': 'ÿ', 'Ã½': 'ý',
  'Ãµ': 'õ', 'Â,': ',', 'Â ': ' ', 'Ã ': ' ' 
};

const normalizeMojibake = (value = '') => {
  let out = String(value);
  Object.entries(MOJIBAKE_MAP).forEach(([bad, good]) => {
    out = out.split(bad).join(good);
  });
  return out.replace(/\u00A0/g, ' ');
};

document.addEventListener('DOMContentLoaded', () => {
  const T = window.TATVM;

  const fixMojibakeRuntime = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue && /â|Â|Ã/.test(node.nodeValue)) nodes.push(node);
    }
    nodes.forEach(node => {
      const fixed = normalizeMojibake(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    });

    const title = document.querySelector('title');
    if (title) title.textContent = normalizeMojibake(title.textContent || '');

    document.querySelectorAll('meta[content], [aria-label], [alt], [placeholder], [data-label]').forEach(el => {
      const attrs = ['content', 'aria-label', 'alt', 'placeholder', 'data-label'];
      attrs.forEach(attr => {
        if (el.hasAttribute(attr)) {
          const raw = el.getAttribute(attr);
          const fixed = normalizeMojibake(raw || '');
          if (fixed !== raw) el.setAttribute(attr, fixed);
        }
      });
    });
  };

  fixMojibakeRuntime();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: .14, rootMargin: '0px 0px -8% 0px' });
  const bindReveals = () => document.querySelectorAll('.reveal:not(.in),.reveal-img:not(.in)').forEach(el => io.observe(el));
  bindReveals();

  /* ---------- counters ---------- */
  const cio = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      cio.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const dur = 1600;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: .6 });
  const bindCounters = () => document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));
  bindCounters();

  /* ---------- poem lines stagger ---------- */
  const pio = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const spans = en.target.querySelectorAll('span');
      spans.forEach((s, i) => { s.style.transitionDelay = `${i * .22}s`; });
      en.target.classList.add('in');
      pio.unobserve(en.target);
    });
  }, { threshold: .3 });
  document.querySelectorAll('.poem .stanza').forEach(s => pio.observe(s));

  /* ---------- tattva system (all five together) ---------- */
  /* ---------- inject tattva pentagon where requested ---------- */
  document.querySelectorAll('[data-pentagon]').forEach(el => { el.innerHTML = T.tattvaPentagon(); });
  document.querySelectorAll('.tattva-stage').forEach(stage => {
    const nodes = stage.querySelectorAll('.pnode');
    const panel = stage.querySelector('.tattva-panel');
    if (!nodes.length || !panel) return;

    const DATA = {
      space:    { name:'Space',    sub:'Room to grow', color:'#E8B23A', icon:'tSpace', copy:'Space is not square footage — it is room for the life that happens inside it. We plan generous, flexible layouts so homes adapt as families grow, work shifts and evenings stretch long.' },
      light:    { name:'Light',    sub:'Every home\'s first right', color:'#E97F31', icon:'tLight', copy:'Natural light is not a premium feature; it is a basic right of every home. Orientation, windows and balconies are placed before saleable area is ever calculated.' },
      air:      { name:'Air',      sub:'A home that breathes', color:'#3FA8B5', icon:'tAir', copy:'Cross-ventilation is designed in from the first sketch, so air moves through every room. A home that breathes feels alive — and costs less to keep comfortable.' },
      vastu:    { name:'Vastu',    sub:'Harmony by design', color:'#8B6BB1', icon:'tVastu', copy:'Vastu is applied as design wisdom, not superstition — orientation, proportion and flow working together so a home simply feels right the moment you walk in.' },
      sustain:  { name:'Sustainability', sub:'Lighter to live in', color:'#7C922B', icon:'tSustain', copy:'Water harvesting, solar-ready roofs, native shading and low-waste materials. A lighter building is cheaper to live in and kinder to the city around it.' },
    };

    let current = null;
    const setTattva = (key) => {
      const d = DATA[key]; if (!d || key === current) return;
      current = key;
      nodes.forEach(n => n.classList.toggle('active', n.dataset.tattva === key));
      stage.querySelectorAll('.tattva-nav button').forEach(b => b.classList.toggle('active', b.dataset.tattva === key));
      const detail = panel.querySelector('.tattva-detail');
      detail.classList.add('out');
      setTimeout(() => {
        panel.style.setProperty('--tpc', d.color);
        detail.innerHTML = `
          <div class="tico">${T.icon(d.icon)}</div>
          <div class="tname">${d.name}</div>
          <div class="tsub">${d.sub}</div>
          <p>${d.copy}</p>`;
        detail.classList.remove('out');
      }, 240);
    };

    nodes.forEach(n => {
      n.addEventListener('click', () => setTattva(n.dataset.tattva));
      n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTattva(n.dataset.tattva); } });
    });
    stage.querySelectorAll('.tattva-nav button').forEach(b => b.addEventListener('click', () => setTattva(b.dataset.tattva)));

    // default = light
    setTattva('light');
  });

  /* ---------- carousels ---------- */
  document.querySelectorAll('.car-wrap').forEach(wrap => {
    const track = wrap.querySelector('.car-track');
    if (!track) return;
    const prev = wrap.querySelector('[data-car-prev]');
    const next = wrap.querySelector('[data-car-next]');
    const step = () => Math.min(track.clientWidth * .9, 480);
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    /* hide controls when there is nothing to scroll (keeps UI honest) */
    const syncBtns = () => {
      const scrollable = track.scrollWidth - track.clientWidth > 4;
      const btns = wrap.querySelector('.car-btns');
      if (btns) btns.style.display = scrollable ? '' : 'none';
    };
    syncBtns();
    window.addEventListener('resize', syncBtns, { passive: true });
  });

  /* ---------- hero video ---------- */
  document.querySelectorAll('video[data-hero]').forEach(v => {
    v.play?.().catch(() => {});
    v.addEventListener('loadeddata', () => v.play?.().catch(() => {}));
    document.addEventListener('visibilitychange', () => {
      document.hidden ? v.pause() : v.play?.().catch(() => {});
    });
  });

  /* ---------- loader ---------- */
  const loaderEl = document.getElementById('loader');
  if (loaderEl) {
    const kill = () => setTimeout(() => loaderEl.classList.add('done'), 250);
    if (document.readyState === 'complete') kill();
    else window.addEventListener('load', kill);
    setTimeout(() => loaderEl.classList.add('done'), 3800); // safety
  }

  /* ---------- forms ---------- */
  document.querySelectorAll('form[data-tatvm-form]').forEach(f => {
    f.addEventListener('submit', e => {
      e.preventDefault();
      if (!f.checkValidity()) {
        f.reportValidity();
        return;
      }

      const formData = new FormData(f);
      const subject = `Website enquiry from ${formData.get('name')}`;
      const body = [
        `Name: ${formData.get('name')}`,
        `Phone: ${formData.get('phone')}`,
        `Email: ${formData.get('email')}`,
        `Interested in: ${formData.get('interest')}`,
        `Message: ${formData.get('message') || '(No message provided)'}`
      ].join('\n');
      window.location.href = `mailto:info@tatvmgroup.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      const ok = f.querySelector('.form-ok') || f.parentElement.querySelector('.form-ok');
      if (ok) ok.classList.add('show');
      f.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
    });
  });

  /* ---------- article category badges auto color ---------- */
  // (news cards use .acat.news — handled in markup)

  /* ---------- re-bind for late injections ---------- */
  window.addEventListener('load', () => { bindReveals(); bindCounters(); });
});

/* ==========================================================================
   FIVE TATTVAS — interactive wheel (homepage)
   ========================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('five-tattvas');
  if (!section || !section.classList.contains('tattvas')) return;

  /* ============================================================
     CONFIG
     ============================================================ */
  var AUTO_INTERVAL   = 1.5;   // seconds between Tattva changes
  var TRANSITION_TIME = 0.8;   // seconds of the roll animation
  var FOCAL           = -90;   // top of the circle
  var IDLE_RESUME     = 4000;  // ms pause after a click (not hover)

  /* ============================================================
     1. DATA
     ============================================================ */
  var SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                 'stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" ' +
                 'aria-hidden="true">';

  var TATTVAS = [
    {
      id: 'space', num: '01', sub: 'Principle',
      name: 'Space', tagline: 'Room to breathe',
      description: 'Volume, proportion and quiet. We plan the emptiness first, so every room keeps air around it.',
      accent:     '#C8A24A', accentSoft: 'rgba(200,162,74,.16)', accentLine: 'rgba(200,162,74,.40)',
      auraA: '#EEDCA9', auraB: '#F9F2E2', wash: '#FCF9F1',
      icon: SVG_OPEN +
        '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.2" opacity=".5"/>' +
        '<circle cx="18.5" cy="6.9" r=".9" fill="currentColor" stroke="none"/></svg>'
    },
    {
      id: 'light', num: '02', sub: 'Principle',
      name: 'Light', tagline: 'Sun before switches',
      description: 'Orientation, aperture and shadow. Natural light is drawn in from the first line, never added at the end.',
      accent:     '#D98A45', accentSoft: 'rgba(217,138,69,.16)', accentLine: 'rgba(217,138,69,.40)',
      auraA: '#F2D2AB', auraB: '#FBEEE0', wash: '#FDF5EA',
      icon: SVG_OPEN +
        '<circle cx="12" cy="12" r="3.9"/>' +
        '<path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>'
    },
    {
      id: 'air', num: '03', sub: 'Principle',
      name: 'Air', tagline: 'Cross-ventilation by design',
      description: 'Openings, courtyards and stack effect. Fresh air moves through the home without machines doing the work.',
      accent:     '#4E9E9C', accentSoft: 'rgba(78,158,156,.15)', accentLine: 'rgba(78,158,156,.40)',
      auraA: '#BEE0DF', auraB: '#EAF5F4', wash: '#F4FAF9',
      icon: SVG_OPEN +
        '<path d="M3.4 9.1h11a2.9 2.9 0 1 0-2.9-2.9"/>' +
        '<path d="M3.4 14.9h13.1a2.9 2.9 0 1 1-2.9 2.9"/>' +
        '<path d="M3.4 12h6.4"/></svg>'
    },
    {
      id: 'vastu', num: '04', sub: 'Principle',
      name: 'Vastu', tagline: 'Aligned, not superstitious',
      description: 'Direction, geometry and balance. Vastu principles are interpreted with modern planning discipline.',
      accent:     '#8674B5', accentSoft: 'rgba(134,116,181,.15)', accentLine: 'rgba(134,116,181,.40)',
      auraA: '#D6CBEC', auraB: '#F1ECF9', wash: '#F8F5FC',
      icon: SVG_OPEN +
        '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="1.2"/>' +
        '<path d="M12 3.4v17.2M3.4 12h17.2"/><circle cx="12" cy="12" r="3.1"/></svg>'
    },
    {
      id: 'sustainability', num: '05', sub: 'Principle',
      name: 'Sustainability', tagline: 'Built to give back',
      description: 'Materials, water and energy. A home that runs lightly on the land it stands on.',
      accent:     '#6E9B5E', accentSoft: 'rgba(110,155,94,.15)', accentLine: 'rgba(110,155,94,.40)',
      auraA: '#C9DFBC', auraB: '#EDF5E7', wash: '#F5FAF1',
      icon: SVG_OPEN +
        '<path d="M20.2 3.8c0 8.6-4.6 13-10.6 13A5.9 5.9 0 0 1 3.8 10.9C3.8 5.4 9.7 3.8 20.2 3.8Z"/>' +
        '<path d="M4.2 20.2c2.5-5.9 6.7-9.6 11.4-11.5"/></svg>'
    }
  ];

  var STEP = 360 / TATTVAS.length;

  /* ============================================================
     2. ENVIRONMENT
     ============================================================ */
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap || null;

  /* ============================================================
     3. DOM
     ============================================================ */
  var wheel       = document.getElementById('tattvaWheel');
  var nodesLayer  = document.getElementById('tattvaNodes');
  var cardsLayer  = document.getElementById('tattvaCards');
  var orbitDots   = document.getElementById('orbitDots');
  var canvas      = section.querySelector('.tattvas__particles');
  var statusEl    = document.getElementById('tattvaStatus');

  var nodeEls = [];
  var cardEls = [];

  /* ============================================================
     4. BUILD NODES + CARDS
     ============================================================ */
  TATTVAS.forEach(function (t, i) {

    var node = document.createElement('button');
    node.type = 'button';
    node.className = 'tattva-node';
    node.setAttribute('data-id', t.id);
    node.setAttribute('aria-pressed', 'false');
    node.setAttribute('aria-label', t.name + ' — ' + t.tagline);
    node.style.setProperty('--node-accent', t.accent);
    node.style.setProperty('--node-accent-line', t.accentLine);
    node.innerHTML =
      '<span class="tattva-node__disc">' +
        '<span class="tattva-node__ring"></span>' +
        '<span class="tattva-node__ring tattva-node__ring--outer"></span>' +
        '<span class="tattva-node__icon">' + t.icon + '</span>' +
      '</span>' +
      '<span class="tattva-node__label">' + t.name + '</span>';
    node.addEventListener('click', function () { selectTattva(i, 'user'); });
    nodesLayer.appendChild(node);
    nodeEls.push(node);

    var card = document.createElement('article');
    card.className = 'tattva-card';
    card.setAttribute('data-id', t.id);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', t.name + ' — ' + t.tagline);
    card.style.setProperty('--card-accent', t.accent);
    card.style.setProperty('--card-accent-soft', t.accentSoft);
    card.style.setProperty('--card-accent-line', t.accentLine);
    card.innerHTML =
      '<span class="tattva-card__accent" aria-hidden="true"></span>' +
      '<span class="tattva-card__corner" aria-hidden="true"></span>' +
      '<span class="tattva-card__num" aria-hidden="true">' + t.num + '</span>' +
      '<span class="tattva-card__glow" aria-hidden="true"></span>' +
      '<span class="tattva-card__shine" aria-hidden="true"></span>' +
      '<span class="tattva-card__head">' +
        '<span class="tattva-card__icon">' + t.icon + '</span>' +
        '<span class="tattva-card__titles">' +
          '<span class="tattva-card__name">' + t.name + '</span>' +
          '<span class="tattva-card__sub">' + t.sub + '</span>' +
        '</span>' +
      '</span>' +
      '<p class="tattva-card__tagline">' + t.tagline + '</p>' +
      '<p class="tattva-card__desc">' + t.description + '</p>' +
      '<span class="tattva-card__bar" aria-hidden="true"></span>';
    card.addEventListener('click', function () { selectTattva(i, 'user'); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        selectTattva(i, 'user');
      }
    });
    cardsLayer.appendChild(card);
    cardEls.push(card);
  });

  (function () {
    var n = 4;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      var a = (i / n) * 360 * Math.PI / 180;
      s.style.left = (50 + Math.cos(a) * 33) + '%';
      s.style.top  = (50 + Math.sin(a) * 33) + '%';
      orbitDots.appendChild(s);
    }
  })();

  /* ============================================================
     5. STATE
     ============================================================ */
  var state = { index: 0, rot: FOCAL };
  var radius = 180;
  var nodeSize = 84;

  /* ============================================================
     6. MEASURE + RENDER
     ============================================================ */
  var retries = 0;
  function measure() {
    var rect = wheel.getBoundingClientRect();
    var size = Math.min(rect.width, rect.height);
    if (!size) { if (retries++ < 20) requestAnimationFrame(measure); return; }
    retries = 0;
    radius   = size * 0.33;
    nodeSize = Math.max(54, Math.min(96, size * 0.165));
    wheel.style.setProperty('--node-size', nodeSize + 'px');
    wheel.style.setProperty('--wheel-r', radius + 'px');
    render();
  }

  function render() {
    for (var i = 0; i < nodeEls.length; i++) {
      var el = nodeEls[i];
      var angle = i * STEP + state.rot;
      var rad   = angle * Math.PI / 180;
      var x     = Math.cos(rad) * radius;
      var y     = Math.sin(rad) * radius;

      var diff = ((angle - FOCAL) % 360 + 540) % 360 - 180;
      var d = Math.abs(diff);
      var t = d / 180;

      var scale   = 1.06 - 0.24 * t;
      var opacity = 1 - 0.40 * t;
      var blur    = t > 0.12 ? (t - 0.12) * 0.85 : 0;

      el.style.transform =
        'translate(-50%,-50%) translate3d(' +
        x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';
      el.style.setProperty('--n-o', opacity.toFixed(3));
      el.style.zIndex = String(Math.round(200 - d));
      el.style.filter = blur > 0.02 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
    }
  }

  /* ============================================================
     7. BACKGROUND
     ============================================================ */
  var bgState = {
    wash: '#FCF9F1', auraA: '#EEDCA9', auraB: '#F9F2E2',
    accent: '#C8A24A', accentSoft: 'rgba(200,162,74,.16)',
    accentLine: 'rgba(200,162,74,.36)'
  };

  function applyBackground() {
    var s = section.style;
    s.setProperty('--t-wash', bgState.wash);
    s.setProperty('--t-aura-a', bgState.auraA);
    s.setProperty('--t-aura-b', bgState.auraB);
    s.setProperty('--t-accent', bgState.accent);
    s.setProperty('--t-accent-soft', bgState.accentSoft);
    s.setProperty('--t-accent-line', bgState.accentLine);
    particleTarget = hexToRgb(bgState.accent);
  }

  var bgTween = null;
  function animateBackground(index) {
    var t = TATTVAS[index];
    var next = {
      wash: t.wash, auraA: t.auraA, auraB: t.auraB,
      accent: t.accent, accentSoft: t.accentSoft, accentLine: t.accentLine
    };
    if (!G || REDUCED) {
      for (var k in next) bgState[k] = next[k];
      applyBackground();
      return;
    }
    if (bgTween) bgTween.kill();
    bgTween = G.to(bgState, {
      wash: next.wash, auraA: next.auraA, auraB: next.auraB,
      accent: next.accent, accentSoft: next.accentSoft, accentLine: next.accentLine,
      duration: TRANSITION_TIME + 0.2,
      ease: 'power2.inOut',
      onUpdate: applyBackground
    });
  }

  /* ============================================================
     8. MASTER TRANSITION
     ============================================================ */
  var wheelTween = null;

  function rollWheelTo(index) {
    var desired = FOCAL - index * STEP;
    var delta   = desired - state.rot;
    delta = ((delta % 360) + 540) % 360 - 180;
    var target = state.rot + delta;

    if (wheelTween && wheelTween.kill) { wheelTween.kill(); wheelTween = null; }

    if (G) {
      wheelTween = G.to(state, {
        rot: target,
        duration: REDUCED ? 0.001 : TRANSITION_TIME,
        ease: 'power3.inOut',
        onUpdate: render
      });
    } else {
      state.rot = target;
      render();
    }
  }

  function selectTattva(index, source) {
    index = ((index % TATTVAS.length) + TATTVAS.length) % TATTVAS.length;
    var prev = state.index;
    state.index = index;

    for (var i = 0; i < TATTVAS.length; i++) {
      var on = i === index;
      nodeEls[i].classList.toggle('is-active', on);
      nodeEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      cardEls[i].classList.toggle('is-active', on);
      cardEls[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    animateBackground(index);

    if (G && !REDUCED && prev !== index) {
      G.fromTo(cardEls[index].querySelector('.tattva-card__icon'),
        { rotate: -8, scale: 0.88 },
        { rotate: 0, scale: 1, duration: 0.7, ease: 'power3.out' });
      G.fromTo(nodeEls[index].querySelector('.tattva-node__icon'),
        { rotate: -12, scale: 0.9 },
        { rotate: 0, scale: 1, duration: 0.75, ease: 'power3.out' });
    }

    if (statusEl && source === 'user') {
      statusEl.textContent = TATTVAS[index].name + ' — ' + TATTVAS[index].tagline;
    }

    rollWheelTo(index);
  }

  /* ============================================================
     9. PARTICLES
     ============================================================ */
  var ctx = canvas ? canvas.getContext('2d') : null;
  var particles = [];
  var cw = 0, ch = 0, dpr = 1;
  var pColor = { r: 200, g: 162, b: 74 };
  var particleTarget = { r: 200, g: 162, b: 74 };
  var particlesRunning = false;

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function spawnParticle(anywhere) {
    return {
      x: Math.random() * cw,
      y: anywhere ? Math.random() * ch : ch + 12,
      r: 0.6 + Math.random() * 1.6,
      vy: 0.05 + Math.random() * 0.18,
      a: 0.04 + Math.random() * 0.14,
      phase: Math.random() * 900
    };
  }
  function initParticles() {
    if (!ctx || REDUCED) return;
    var rect = section.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = rect.width; ch = rect.height;
    canvas.width  = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.round(Math.min(40, Math.max(14, cw / 44)));
    particles = [];
    for (var i = 0; i < count; i++) particles.push(spawnParticle(true));
    startParticles();
  }
  function drawParticles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    pColor.r += (particleTarget.r - pColor.r) * 0.045;
    pColor.g += (particleTarget.g - pColor.g) * 0.045;
    pColor.b += (particleTarget.b - pColor.b) * 0.045;
    var cr = Math.round(pColor.r), cg = Math.round(pColor.g), cb = Math.round(pColor.b);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.y -= p.vy;
      p.x += Math.sin((p.y + p.phase) * 0.006) * 0.18;
      if (p.y < -12) { p.y = ch + 12; p.x = Math.random() * cw; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + p.a + ')';
      ctx.fill();
    }
  }
  var rafId = null;
  function startParticles() {
    if (!ctx || REDUCED || particlesRunning) return;
    particlesRunning = true;
    if (G) { G.ticker.add(drawParticles); return; }
    (function loop(){ drawParticles(); rafId = requestAnimationFrame(loop); })();
  }
  function stopParticles() {
    if (!ctx || !particlesRunning) return;
    particlesRunning = false;
    if (G) { G.ticker.remove(drawParticles); return; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ============================================================
     10. AUTO-ROTATION — never stops on hover.
     Only a brief pause after a click (for readability),
     and when the browser tab is hidden.
     ============================================================ */
  var rotationTimer = null;
  var idlePause     = false;
  var idleTimer     = null;

  function rotationTick() {
    if (REDUCED) return;
    if (idlePause) return;     /* brief pause after a user click only */
    selectTattva(state.index + 1, 'auto');
  }
  function startRotation() {
    if (rotationTimer) return;
    rotationTimer = setInterval(rotationTick, AUTO_INTERVAL * 1000);
  }
  function stopRotation() {
    if (rotationTimer) { clearInterval(rotationTimer); rotationTimer = null; }
  }
  function pauseForIdle() {
    idlePause = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { idlePause = false; }, IDLE_RESUME);
  }

  /* ============================================================
     NO hover-pause listeners.
     Hovering the wheel or the cards does NOT stop the roll.
     ============================================================ */

  /* Click / tap pauses briefly so the user can read the selection. */
  nodesLayer.addEventListener('click', pauseForIdle);
  cardsLayer.addEventListener('click', pauseForIdle);
  section.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') pauseForIdle();
  });

  /* Pause when the browser tab is hidden (saves CPU), resume when back. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopRotation();
    else startRotation();
  });

  /* ============================================================
     11. INTRO
     ============================================================ */
  var introPlayed = false;
  var introDone   = false;

  function finishIntro() {
    if (introDone) return;
    introDone = true;
    if (G) {
      G.set(cardEls, { clearProps: 'opacity,transform' });
      G.set(nodeEls, { clearProps: 'opacity' });
    }
    startRotation();
  }

  function playIntro() {
    if (introPlayed) return;
    introPlayed = true;

    if (!G || REDUCED) { finishIntro(); return; }

    var bg      = section.querySelector('.tattvas__bg');
    var eyebrow = section.querySelector('.tattvas__eyebrow');
    var title   = section.querySelector('.tattvas__title');
    var lede    = section.querySelector('.tattvas__lede');
    var orbit   = section.querySelector('.orbit--outer');
    var hub     = section.querySelector('.tattva-wheel__hub');
    var aura    = section.querySelector('.tattva-wheel__aura');
    var mandala = section.querySelector('.tattva-wheel__mandala');
    var dots    = section.querySelector('.orbit-dots');

    var nodeTargets = nodeEls.map(function (el) {
      return parseFloat(el.style.getPropertyValue('--n-o')) || 1;
    });

    var tl = G.timeline({ defaults: { ease: 'power3.out' }, onComplete: finishIntro });

    tl.from(bg,      { opacity: 0, duration: 0.9 }, 0)
      .from(eyebrow, { y: 14, opacity: 0, duration: .55 }, 0.08)
      .from(title,   { y: 22, opacity: 0, duration: .8 }, 0.15)
      .from(lede,    { y: 16, opacity: 0, duration: .8 }, 0.25)
      .from(aura,    { opacity: 0, scale: .8, duration: 1.2, ease: 'power2.out' }, 0.28)
      .from(wheel,   { scale: .86, opacity: 0, duration: 1.1, ease: 'power3.out' }, 0.30)
      .from(mandala, { opacity: 0, scale: .55, rotate: -25, duration: 1.6, ease: 'power2.out' }, 0.5)
      .fromTo(orbit, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.6)
      .from(dots,    { opacity: 0, duration: .8 }, 0.9)
      .from(hub,     { opacity: 0, duration: .7 }, 1.0)
      .set(nodeEls,  { opacity: 0 }, 0.85)
      .to(nodeEls,   {
        opacity: function (i) { return nodeTargets[i]; },
        duration: .65, stagger: .09, ease: 'power2.out'
      }, 0.9)
      .from(cardEls, { y: 26, opacity: 0, duration: .75, stagger: .06, ease: 'power3.out' }, 1.0);

    setTimeout(finishIntro, 2500);
  }

  /* ============================================================
     12. VISIBILITY
     ============================================================ */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!introPlayed) playIntro();
          startParticles();
        } else {
          stopParticles();
        }
      });
    }, { threshold: 0.1 });
    io.observe(section);
  } else {
    playIntro();
    startParticles();
  }

  setTimeout(function () {
    if (!introPlayed) playIntro();
    if (!introDone)   finishIntro();
  }, 4000);

  /* ============================================================
     13. RESIZE
     ============================================================ */
  var lastSize = 0;
  function onResize() {
    var r = wheel.getBoundingClientRect();
    var s = Math.min(r.width, r.height);
    if (Math.abs(s - lastSize) > 1) {
      lastSize = s;
      measure();
      if (ctx && !REDUCED) initParticles();
    }
  }
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(wheel);
  else window.addEventListener('resize', onResize);

  /* ============================================================
     14. INIT
     ============================================================ */
  measure();
  render();
  applyBackground();
  selectTattva(0, 'init');
  initParticles();

  /* ============================================================
     15. CLEANUP
     ============================================================ */
  window.addEventListener('pagehide', function () {
    stopRotation();
    stopParticles();
    if (wheelTween && wheelTween.kill) wheelTween.kill();
    if (bgTween    && bgTween.kill)    bgTween.kill();
    if (idleTimer) clearTimeout(idleTimer);
  });

})();


/* ==========================================================================
   PREMIUM MOTION — page-ready flag, auto-stagger, section reveal, parallax
   (vanilla; reuses the existing .reveal system — no new libraries)
   ========================================================================== */
(function () {
  'use strict';
  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* start the intro sequence once the loader has cleared */
  var ready = false;
  function setReady() { if (ready) return; ready = true; body.classList.add('is-ready'); }
  var loader = document.getElementById('loader');
  if (!loader) setTimeout(setReady, 60);
  else if (document.readyState === 'complete') setTimeout(setReady, 350);
  else window.addEventListener('load', function () { setTimeout(setReady, 350); });
  setTimeout(setReady, 3800);

  /* cascading delays for card groups: 0 / 100 / 200 / 300ms … (cleared after reveal so hover stays instant) */
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    var items = group.querySelectorAll(':scope > .reveal');
    items.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i, 5) * 100) + 'ms';
      var clear = function (e) {
        if (e.propertyName !== 'opacity') return;
        el.style.transitionDelay = '';
        el.removeEventListener('transitionend', clear);
      };
      el.addEventListener('transitionend', clear);
    });
  });

  /* cinematic section entrance for opt-in sections */
  var cines = document.querySelectorAll('.cine');
  if (cines.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); cio.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    cines.forEach(function (el) { cio.observe(el); });
  } else {
    cines.forEach(function (el) { el.classList.add('in'); });
  }

  /* subtle parallax (max ~22px) — desktop / hover devices only */
  var pEls = [].slice.call(document.querySelectorAll('[data-parallax]'));
  if (pEls.length) {
    var mq = window.matchMedia('(min-width:901px) and (hover:hover) and (prefers-reduced-motion:no-preference)');
    var ticking = false;
    var update = function () {
      ticking = false;
      if (!mq.matches) { pEls.forEach(function (el) { el.style.translate = ''; }); return; }
      var vh = window.innerHeight;
      pEls.forEach(function (el) {
        var host = el.parentElement;
        var r = host.getBoundingClientRect();
        if (r.bottom < -60 || r.top > vh + 60) return;
        var f = parseFloat(el.getAttribute('data-parallax')) || 0.05;
        var max = Math.min(22, host.clientHeight * 0.045);
        var d = -(r.top + r.height / 2 - vh / 2) * f;
        d = Math.max(-max, Math.min(max, d));
        el.style.translate = '0 ' + d.toFixed(1) + 'px';
      });
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }
})();

/* ==========================================================================
   CAREERS — filters, Apply Now, validation, resume upload, email/WhatsApp routing
   ========================================================================== */
(function () {
  'use strict';
  var form = document.getElementById('careerForm');
  var grid = document.getElementById('jobGrid');
  if (!form || !grid) return;

  /* set endpoint to a real form/API URL to post applications (with the CV attached);
     while empty, the form hands the application off via email + WhatsApp */
  var CFG = { email: 'info@tatvmgroup.com', whatsapp: '919152000425', endpoint: '' };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- filters ---------- */
  var cards = [].slice.call(grid.querySelectorAll('.job-card'));
  var fDept = $('fDept'), fLoc = $('fLoc'), fType = $('fType');
  var count = $('jobCount'), empty = $('jobEmpty'), reset = $('jobReset');
  var timer = null;

  function matches(c) {
    return (!fDept.value || c.dataset.dept === fDept.value) &&
           (!fLoc.value || c.dataset.loc === fLoc.value) &&
           (!fType.value || c.dataset.type === fType.value);
  }
  function label(n) { return 'Showing ' + n + ' of ' + cards.length + ' opening' + (cards.length === 1 ? '' : 's'); }

  function applyFilter() {
    clearTimeout(timer);
    grid.style.minHeight = grid.offsetHeight + 'px';
    cards.forEach(function (c) { if (!c.hidden) c.classList.add('is-out'); });
    timer = setTimeout(function () {
      var shown = [];
      cards.forEach(function (c) {
        var ok = matches(c);
        c.hidden = !ok;
        if (ok) { c.classList.add('is-out'); shown.push(c); } else { c.classList.remove('is-out'); }
      });
      void grid.offsetWidth;
      shown.forEach(function (c, i) {
        c.style.transitionDelay = (reduce ? 0 : i * 70) + 'ms';
        c.classList.remove('is-out');
      });
      count.textContent = label(shown.length);
      empty.classList.toggle('show', shown.length === 0);
      setTimeout(function () {
        shown.forEach(function (c) { c.style.transitionDelay = ''; });
        grid.style.minHeight = '';
      }, reduce ? 0 : 320 + shown.length * 70);
    }, reduce ? 0 : 260);
  }
  [fDept, fLoc, fType].forEach(function (s) { s.addEventListener('change', applyFilter); });
  reset.addEventListener('click', function () { fDept.value = fLoc.value = fType.value = ''; applyFilter(); });
  count.textContent = label(cards.length);

  /* ---------- Apply Now → smooth scroll → position pre-selected ---------- */
  var position = $('cfPosition');
  var posField = position.closest('.field');
  var picked = $('applyPicked');
  var nameInput = $('cfName');

  function setPosition(v) {
    position.value = v;
    if (position.value !== v) position.value = '';
    picked.textContent = position.value ? 'Applying for: ' + position.value : '';
    clearError(posField);
  }
  position.addEventListener('change', function () { setPosition(position.value); });

  grid.addEventListener('click', function (e) {
    var a = e.target.closest('[data-apply]');
    if (!a) return;
    e.preventDefault();
    setPosition(a.getAttribute('data-apply'));
    $('apply').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () {
      posField.classList.add('flash');
      setTimeout(function () { posField.classList.remove('flash'); }, 1900);
      nameInput.focus({ preventScroll: true });
    }, reduce ? 0 : 750);
  });

  /* ---------- resume upload + validation ---------- */
  var fileInput = $('cfResume');
  var upload = form.querySelector('.upload');
  var resumeField = fileInput.closest('.field');
  var fileName = $('cfFileName'), fileSize = $('cfFileSize'), clearBtn = $('cfFileClear');
  var file = null;
  var MAX = 5 * 1024 * 1024;

  function fmt(b) { return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
  function pick(f) {
    if (!f) { dropFile(); return; }
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    if (['pdf', 'doc', 'docx'].indexOf(ext) < 0) { dropFile(); showError(resumeField, 'Please upload a PDF, DOC or DOCX file.'); return; }
    if (f.size > MAX) { dropFile(); showError(resumeField, 'That file is larger than 5 MB. Please upload a smaller one.'); return; }
    file = f;
    fileName.textContent = f.name;
    fileSize.textContent = fmt(f.size);
    upload.classList.add('has-file');
    clearError(resumeField);
  }
  function dropFile() { file = null; fileInput.value = ''; upload.classList.remove('has-file'); }
  fileInput.addEventListener('change', function () { pick(fileInput.files[0]); });
  clearBtn.addEventListener('click', function (e) { e.preventDefault(); dropFile(); fileInput.focus(); });
  ['dragenter', 'dragover'].forEach(function (t) { upload.addEventListener(t, function () { upload.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (t) { upload.addEventListener(t, function () { upload.classList.remove('drag'); }); });

  function showError(field, msg) {
    field.classList.add('invalid');
    var err = field.querySelector('.err');
    if (err) err.textContent = msg;
    var input = field.querySelector('input,select,textarea');
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  function clearError(field) {
    field.classList.remove('invalid');
    var input = field.querySelector('input,select,textarea');
    if (input) input.removeAttribute('aria-invalid');
  }
  ['cfName', 'cfEmail', 'cfPhone'].forEach(function (id) {
    $(id).addEventListener('input', function () { clearError($(id).closest('.field')); });
  });

  function validate() {
    var firstBad = null;
    function check(field, ok, msg) {
      if (ok) { clearError(field); return; }
      showError(field, msg);
      if (!firstBad) firstBad = field.querySelector('input,select,textarea');
    }
    check($('cfName').closest('.field'), $('cfName').value.trim().length >= 2, 'Please enter your full name.');
    check($('cfEmail').closest('.field'), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('cfEmail').value.trim()), 'Please enter a valid email address.');
    var digits = $('cfPhone').value.replace(/\D/g, '');
    check($('cfPhone').closest('.field'), digits.length >= 8 && digits.length <= 15, 'Please enter a valid phone number.');
    check(posField, !!position.value, 'Please choose the position you are applying for.');
    check(resumeField, !!file, 'Please attach your resume (PDF, DOC or DOCX, up to 5 MB).');
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /* ---------- submit: real endpoint if configured, otherwise email + WhatsApp hand-off ---------- */
  var success = $('applySuccess');
  var alertEl = $('formAlert');

  function summary() {
    return [
      'Position: ' + position.value,
      'Name: ' + $('cfName').value.trim(),
      'Email: ' + $('cfEmail').value.trim(),
      'Phone: ' + $('cfPhone').value.trim(),
      'Experience: ' + ($('cfExp').value.trim() || 'Not specified'),
      'Note: ' + ($('cfMessage').value.trim() || '(none)')
    ];
  }
  function showSuccess(sent) {
    var first = $('cfName').value.trim().split(/\s+/)[0];
    var lines = summary();
    $('successTitle').textContent = sent ? 'Application Submitted Successfully' : 'Your application is ready to send';
    $('successText').textContent = sent
      ? 'Thank you, ' + first + '. Our team will review your application and be in touch.'
      : 'Thank you, ' + first + '. One last step: send it to our team by email (attach your resume) or on WhatsApp, whichever is quicker.';
    var mailBody = lines.join('\n') + '\n\nResume: ' + file.name + ' (please attach it to this email)';
    $('successMail').href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent('Application: ' + position.value + ' - ' + $('cfName').value.trim()) + '&body=' + encodeURIComponent(mailBody);
    $('successWa').href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent('Hello Tat:vm, I would like to apply.\n' + lines.join('\n') + '\nI will share my resume (' + file.name + ') here.');
    $('successRoute').hidden = sent;
    form.classList.add('is-leaving');
    setTimeout(function () {
      form.hidden = true;
      success.classList.add('show');
      success.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      $('successTitle').focus({ preventScroll: true });
    }, reduce ? 0 : 450);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    alertEl.classList.remove('show');
    if (!validate()) return;
    if (!CFG.endpoint) { showSuccess(false); return; }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    var fd = new FormData(form);
    fd.set('resume', file, file.name);
    fetch(CFG.endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); showSuccess(true); })
      .catch(function () {
        btn.disabled = false;
        alertEl.textContent = 'Something went wrong sending your application. Please try again, or email ' + CFG.email + ' directly.';
        alertEl.classList.add('show');
      });
  });

  $('applyAgain').addEventListener('click', function (e) {
    e.preventDefault();
    form.reset(); dropFile(); setPosition(''); form.querySelectorAll('.invalid').forEach(function (f) { clearError(f); });
    success.classList.remove('show');
    form.hidden = false;
    void form.offsetWidth;
    form.classList.remove('is-leaving');
    $('apply').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
})();
