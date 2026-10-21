/* ==========================================================================
   Tat:vm — Diwali festive layer
   Adds: marigold toran and akash kandil lanterns over the page hero, glowing
   embers and gentle fireworks in the hero sky, a diya + rangoli ledge on the
   footer, and a dismissible greeting card. Nothing existing is altered.
   Respects "reduce motion", pauses when off-screen or in a background tab,
   and visitors can switch the motion to "calm" from the greeting card.
   ========================================================================== */
(function () {
  if (window.__tatvmFestive) return;
  window.__tatvmFestive = 'diwali';

  const root = document.documentElement;
  const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  root.classList.add('festive-diwali');
  if (store.get('tatvm-festive-calm') === '1') root.classList.add('festive-calm');
  const calm = () => REDUCE || root.classList.contains('festive-calm');
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (html, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; return d; };
  const rand = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------------ artwork
  let uid = 0;
  function diyaSVG() {
    const i = ++uid;
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="fxh${i}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD98A" stop-opacity=".85"/><stop offset=".45" stop-color="#F4B740" stop-opacity=".35"/><stop offset="1" stop-color="#F4B740" stop-opacity="0"/></radialGradient>
        <linearGradient id="fxf${i}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F08A24"/><stop offset=".55" stop-color="#FFC94A"/><stop offset="1" stop-color="#FFF4C9"/></linearGradient>
        <linearGradient id="fxc${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A8312F"/><stop offset=".6" stop-color="#8E1F24"/><stop offset="1" stop-color="#5E1215"/></linearGradient>
      </defs>
      <circle class="fx-halo" cx="32" cy="22" r="20" fill="url(#fxh${i})"/>
      <path class="fx-flame" d="M32 6 C37 14 39 20 36 26 C34.6 28.6 29.4 28.6 28 26 C25 20 27 14 32 6 Z" fill="url(#fxf${i})"/>
      <path d="M32 15 C34 19 34.5 22 33.2 25 C32.4 26.2 31.6 26.2 30.8 25 C29.5 22 30 19 32 15 Z" fill="#FFF7DB" opacity=".9"/>
      <path d="M31.4 27 L32.6 27 L32.4 32 L31.6 32 Z" fill="#3A2416"/>
      <path d="M8 34 C8 31 56 31 56 34 C56 48 46 56 32 56 C18 56 8 48 8 34 Z" fill="url(#fxc${i})"/>
      <path d="M8 34 C8 31 56 31 56 34 C56 36.5 8 36.5 8 34 Z" fill="#F4B740"/>
      <path d="M14 41 Q20 45 26 41 Q32 45 38 41 Q44 45 50 41" fill="none" stroke="#F4B740" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="20" cy="48" r="1.4" fill="#F6D7DA"/><circle cx="32" cy="50" r="1.4" fill="#F6D7DA"/><circle cx="44" cy="48" r="1.4" fill="#F6D7DA"/>
    </svg>`;
  }
  function rangoliSVG() {
    const petals = (n, r, w, h, fill, extra = '') => Array.from({ length: n }, (_, k) =>
      `<ellipse cx="60" cy="${60 - r}" rx="${w}" ry="${h}" fill="${fill}" transform="rotate(${(360 / n) * k} 60 60)" ${extra}/>`).join('');
    const dots = (n, r, rad, fill) => Array.from({ length: n }, (_, k) => {
      const a = (Math.PI * 2 * k) / n; return `<circle cx="${(60 + Math.cos(a) * r).toFixed(2)}" cy="${(60 + Math.sin(a) * r).toFixed(2)}" r="${rad}" fill="${fill}"/>`;
    }).join('');
    return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="58" fill="#FBF7F0" stroke="#8E1F24" stroke-width="1.5"/>
      <g class="fx-ring">${petals(16, 44, 5, 12, '#8E1F24')}${dots(16, 54, 1.8, '#F4B740')}</g>
      <g class="fx-ring rev">${petals(12, 31, 6.5, 11, '#9FB63D')}</g>
      ${petals(8, 18, 6, 10, '#F08A24')}
      ${dots(8, 26, 2, '#8E1F24')}
      <circle cx="60" cy="60" r="10" fill="#F4B740"/><circle cx="60" cy="60" r="5.5" fill="#8E1F24"/><circle cx="60" cy="60" r="2.2" fill="#FFF4C9"/>
    </svg>`;
  }
  function kandilSVG() {
    const i = ++uid;
    const star = (cx, cy, R, r) => Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (Math.PI * k) / 5, rad = k % 2 ? r : R; return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 80 150" aria-hidden="true" focusable="false">
      <defs><radialGradient id="fxk${i}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE7A8"/><stop offset=".55" stop-color="#F4B740"/><stop offset="1" stop-color="#C2321F"/></radialGradient></defs>
      <line x1="40" y1="0" x2="40" y2="34" stroke="#F4B740" stroke-width="1.4"/>
      <circle class="fx-glow" cx="40" cy="70" r="34" fill="#F4B740" opacity=".18"/>
      <polygon points="${star(40, 70, 34, 15)}" fill="#8E1F24" stroke="#F4B740" stroke-width="2" stroke-linejoin="round"/>
      <polygon class="fx-glow" points="${star(40, 70, 22, 10)}" fill="url(#fxk${i})"/>
      <circle cx="40" cy="70" r="5" fill="#FFF4C9"/>
      <g stroke="#F4B740" stroke-width="1.2" stroke-linecap="round"><line x1="31" y1="100" x2="29" y2="138"/><line x1="40" y1="104" x2="40" y2="146"/><line x1="49" y1="100" x2="51" y2="138"/></g>
      <g fill="#9FB63D"><circle cx="29" cy="139" r="2.6"/><circle cx="40" cy="147" r="2.6"/><circle cx="51" cy="139" r="2.6"/></g>
    </svg>`;
  }
  function toranSVG(width) {
    const seg = width < 700 ? 118 : 168, n = Math.max(3, Math.round(width / seg)), step = width / n;
    let d = 'M0 6', strands = '', flowers = '';
    const flower = (x, y, r, c) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${c}" stroke="${c === '#F6B92B' ? '#E39A1B' : '#D86F12'}" stroke-width="${(r * 0.55).toFixed(1)}" stroke-dasharray="1.6 1.2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.38).toFixed(1)}" fill="#B5530E"/>`;
    for (let k = 0; k < n; k++) {
      const x0 = k * step, x1 = x0 + step, mx = x0 + step / 2;
      d += ` Q ${mx.toFixed(1)} 30 ${x1.toFixed(1)} 6`;
      // flowers along the string
      for (let t = 0.2; t < 1; t += 0.2) {
        const x = x0 + step * t;
        const yy = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 30 + t * t * 6;   // point on the curve
        flowers += flower(x, yy, 4.2, t === 0.2 || t > 0.79 ? '#F6B92B' : '#F08A24');
      }
      // hanging strand at the dip
      const len = 3 + (k % 3), top = 18;
      let s = `<g class="fx-strand" style="animation-delay:${(-k * 0.7).toFixed(2)}s"><line x1="${mx.toFixed(1)}" y1="${top}" x2="${mx.toFixed(1)}" y2="${top + len * 11 + 6}" stroke="#5E1215" stroke-width="1"/>`;
      for (let j = 0; j < len; j++) s += flower(mx, top + 6 + j * 11, 5.2, j % 2 ? '#F6B92B' : '#F08A24');
      const ly = top + len * 11 + 8;
      s += `<path d="M${mx.toFixed(1)} ${ly - 2} C ${(mx + 7).toFixed(1)} ${ly + 4} ${(mx + 4).toFixed(1)} ${ly + 14} ${mx.toFixed(1)} ${ly + 18} C ${(mx - 4).toFixed(1)} ${ly + 14} ${(mx - 7).toFixed(1)} ${ly + 4} ${mx.toFixed(1)} ${ly - 2} Z" fill="#7C922B"/><line x1="${mx.toFixed(1)}" y1="${ly}" x2="${mx.toFixed(1)}" y2="${ly + 15}" stroke="#5C6E1C" stroke-width=".8"/></g>`;
      strands += s;
    }
    return `<svg viewBox="0 0 ${width} 92" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="#5E1215" stroke-width="1.6"/>${flowers}${strands}</svg>`;
  }

  // ------------------------------------------------------------------ sections below the hero: fine line art
  // The hero banners stay exactly as designed. Below them, alternate sections get one quiet line-art motif:
  // a rangoli mandala drawn in a single gold line in a top corner, or a jaali (lattice screen) strip along one edge.
  // Each motif sits behind the section's content, takes no space and never changes the layout.
  function mandalaLine() {
    const petals = (n, r, w, h) => Array.from({ length: n }, (_, k) =>
      `<ellipse cx="100" cy="${100 - r}" rx="${w}" ry="${h}" transform="rotate(${(360 / n) * k} 100 100)"/>`).join('');
    const dots = (n, r) => Array.from({ length: n }, (_, k) => {
      const a = (Math.PI * 2 * k) / n; return `<circle cx="${(100 + Math.cos(a) * r).toFixed(1)}" cy="${(100 + Math.sin(a) * r).toFixed(1)}" r="1.6" class="fx-fill"/>`;
    }).join('');
    return `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="90" stroke-dasharray="2 5"/>
      ${petals(16, 66, 9, 22)}${dots(16, 86)}
      <circle cx="100" cy="100" r="50"/>${petals(12, 36, 8, 14)}
      <circle cx="100" cy="100" r="20"/>${petals(8, 12, 4, 8)}
      <circle cx="100" cy="100" r="4" class="fx-fill"/>
    </svg>`;
  }
  function diyaLine() {
    // a lit clay diya drawn in one fine gold line; the flame and its glow are the only parts that move
    return `<svg viewBox="0 0 120 110" aria-hidden="true" focusable="false">
      <ellipse class="fx-lglow" cx="60" cy="30" rx="34" ry="30" stroke="none"/>
      <path class="fx-lflame" d="M60 6 C71 21 75 33 67 43 C63.5 47.5 56.5 47.5 53 43 C45 33 49 21 60 6 Z"/>
      <path class="fx-lflame2" d="M60 22 C65 29 66 35 62.5 40 C61.2 41.8 58.8 41.8 57.5 40 C54 35 55 29 60 22 Z"/>
      <path d="M60 46 L60 54"/>
      <path d="M10 56 C10 52 110 52 110 56 C110 82 90 98 60 98 C30 98 10 82 10 56 Z"/>
      <path d="M10 56 C10 60 110 60 110 56"/>
      <path d="M24 70 Q33 77 42 70 Q51 77 60 70 Q69 77 78 70 Q87 77 96 70"/>
      <circle cx="37" cy="86" r="1.5" class="fx-fill"/><circle cx="60" cy="89" r="1.5" class="fx-fill"/><circle cx="83" cy="86" r="1.5" class="fx-fill"/>
      <path d="M42 98 L78 98 M48 104 L72 104"/>
    </svg>`;
  }
  function jaaliLine(id) {
    // ogee lattice: interlocking arches, the classic stone-screen pattern
    return `<svg width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs><pattern id="${id}" width="44" height="64" patternUnits="userSpaceOnUse">
        <path d="M0 0 C 0 18 22 18 22 32 C 22 46 0 46 0 64 M44 0 C 44 18 22 18 22 32 C 22 46 44 46 44 64"/>
        <circle cx="22" cy="32" r="2.4"/><circle cx="0" cy="0" r="1.4" class="fx-fill"/><circle cx="44" cy="64" r="1.4" class="fx-fill"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#${id})" stroke="none"/>
    </svg>`;
  }
  function isDark(el) {       // maroon / dark sections get a lighter line colour
    if (el.classList.contains('bg-red') || el.classList.contains('on-dark')) return true;
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(el).backgroundColor || '');
    if (!m || (m[4] !== undefined && +m[4] < 0.2)) return false;
    return (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) < 110;
  }
  function decorateSections() {
    const hero = document.querySelector('.hero, .page-hero');
    const all = [...document.querySelectorAll('main section, body > section')].filter((s, i, a) => a.indexOf(s) === i);
    const list = all.filter(s =>
      s !== hero && !s.closest('.hero, .page-hero') &&
      !s.matches('.hero, .page-hero, .tattvas, .poem-band') &&          // banners and sections that already carry their own artwork
      (!hero || (hero.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)) &&
      getComputedStyle(s).position !== 'static' && s.offsetHeight > 260);
    let n = 0;
    list.forEach((s, i) => {
      if (i === 0) {             // the intro section (first below the hero) also gets one lit diya, bottom-left
        const deco = document.createElement('div');
        deco.className = 'fx-deco fx-deco--diya fx-l' + (isDark(s) ? ' fx-on-dark' : '');
        deco.setAttribute('aria-hidden', 'true');
        deco.innerHTML = `<span class="fx-diyaline">${diyaLine()}</span>`;
        s.classList.add('fx-host'); s.insertBefore(deco, s.firstChild);
      }
      if (i % 2 === 1) return;
      if (n >= 6) return;            // every other section, at most six per page
      const kind = n % 2 === 0 ? 'mandala' : 'jaali', side = n % 4 < 2 ? 'r' : 'l';
      const deco = document.createElement('div');
      deco.className = `fx-deco fx-deco--${kind} fx-${side}` + (isDark(s) ? ' fx-on-dark' : '');
      deco.setAttribute('aria-hidden', 'true');
      deco.innerHTML = kind === 'mandala' ? `<span class="fx-mandala">${mandalaLine()}</span>` : `<span class="fx-jaali">${jaaliLine('fxJaali' + n)}</span>`;
      s.classList.add('fx-host');
      s.insertBefore(deco, s.firstChild);
      n++;
    });
    // fade each motif in gently as its section scrolls into view
    if ('IntersectionObserver' in window && !REDUCE) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('fx-seen'); io.unobserve(e.target); } }), { threshold: 0.15 });
      document.querySelectorAll('.fx-deco').forEach(d => io.observe(d));
    } else document.querySelectorAll('.fx-deco').forEach(d => d.classList.add('fx-seen'));
    setTimeout(() => document.querySelectorAll('.fx-deco').forEach(d => d.classList.add('fx-seen')), 6000);   // safety net
  }

  function sky(canvas, host, fireworks) {
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0, embers = [], sparks = [], rockets = [], running = false, visible = true, next = 0, last = 0;
    const COLORS = ['255,201,90', '255,170,70', '255,226,160', '214,232,138', '255,150,140'];
    const sprites = {};
    function sprite(rgb) {   // pre-rendered soft glow, much cheaper than canvas shadows
      if (sprites[rgb]) return sprites[rgb];
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(.25, `rgba(${rgb},.55)`); grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return (sprites[rgb] = c);
    }
    function size() {
      W = host.clientWidth; H = host.clientHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const target = Math.min(fireworks ? 70 : 38, Math.round((W * H) / (fireworks ? 16000 : 22000)));
      while (embers.length < target) embers.push(ember(true));
      embers.length = target;
    }
    function ember(anywhere) {
      return { x: rand(0, W), y: anywhere ? rand(H * .2, H) : H + rand(0, 40), r: rand(1.2, 3.4), vy: rand(-.18, -.48), vx: rand(-.08, .08),
        a: rand(.35, .9), tw: rand(0, Math.PI * 2), c: COLORS[(Math.random() * 3) | 0] };
    }
    function burst(x, y) {
      const n = (rand(36, 56)) | 0, c = COLORS[(Math.random() * COLORS.length) | 0], speed = rand(1.6, 2.6);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-.05, .05), v = speed * rand(.65, 1);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rand(.010, .016), c, r: rand(1.4, 2.4) });
      }
      for (let i = 0; i < 10; i++) sparks.push({ x, y, vx: rand(-.6, .6), vy: rand(-.6, .6), life: 1, decay: .025, c: '255,240,200', r: 1.2 });
    }
    function launch() {
      const x = rand(W * .14, W * .86), ty = rand(H * .14, H * .42);
      rockets.push({ x, y: H * .92, tx: x + rand(-30, 30), ty, t: 0 });
    }
    function frame(now) {
      if (!running) return;
      const dt = Math.min(48, now - (last || now)) / 16.67; last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.y += e.vy * dt; e.x += e.vx * dt; e.tw += .05 * dt;
        if (e.y < -10) Object.assign(e, ember(false));
        const al = e.a * (.6 + .4 * Math.sin(e.tw)) * Math.min(1, (H - e.y) / 120 + .2) * Math.min(1, e.y / (H * .25));
        if (al > 0) { ctx.globalAlpha = al; const s = e.r * 7; ctx.drawImage(sprite(e.c), e.x - s / 2, e.y - s / 2, s, s); }
      }
      if (fireworks && !calm()) {
        if (now > next) { launch(); next = now + rand(2200, 4200); }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i]; r.t += .022 * dt;
          const px = r.x + (r.tx - r.x) * r.t, py = r.y + (r.ty - r.y) * (1 - Math.pow(1 - r.t, 2));
          ctx.globalAlpha = .8; ctx.drawImage(sprite('255,226,160'), px - 6, py - 6, 12, 12);
          for (let k = 1; k < 5; k++) { ctx.globalAlpha = .18 / k; ctx.drawImage(sprite('255,201,90'), px - 4, py + k * 6, 8, 8); }
          if (r.t >= 1) { burst(px, py); rockets.splice(i, 1); }
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const p = sparks[i];
          p.vx *= Math.pow(.985, dt); p.vy = p.vy * Math.pow(.985, dt) + .028 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
          if (p.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.globalAlpha = Math.max(0, p.life) * .9; const s = p.r * 6; ctx.drawImage(sprite(p.c), p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }
    function staticFrame() {     // reduced motion: a still scatter of soft lights
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) { ctx.globalAlpha = e.a * .7; const s = e.r * 7; ctx.drawImage(sprite(e.c), e.x - s / 2, e.y - s / 2, s, s); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    function setRunning(on) {
      if (REDUCE) { staticFrame(); return; }
      if (on && !running) { running = true; last = 0; next = performance.now() + 900; requestAnimationFrame(frame); }
      if (!on) running = false;
    }
    size();
    let rs; window.addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(() => { size(); if (REDUCE) staticFrame(); }, 150); });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; setRunning(visible && !document.hidden); }, { threshold: 0.02 }).observe(host);
    document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));
    setRunning(true);
  }

  // ------------------------------------------------------------------ footer: diya ledge + rangoli
  function decorateFooter() {
    const footer = document.querySelector('.site-footer');
    if (!footer || document.querySelector('.fx-ledge')) return !!footer;
    const ledge = document.createElement('div');
    ledge.className = 'fx-ledge'; ledge.setAttribute('aria-hidden', 'true');
    const side = 4;
    let html = '';
    for (let i = 0; i < side; i++) html += `<span class="fx-diya">${diyaSVG()}</span>`;
    html += `<span class="fx-rangoli">${rangoliSVG()}</span>`;
    for (let i = 0; i < side; i++) html += `<span class="fx-diya">${diyaSVG()}</span>`;
    ledge.innerHTML = html;
    footer.parentNode.insertBefore(ledge, footer);
    return true;
  }

  // ------------------------------------------------------------------ greeting card
  function greet() {
    const KEY = 'tatvm-festive-greet-' + new Date().getFullYear();
    if (store.get(KEY) === 'closed') return;
    const card = document.createElement('aside');
    card.className = 'fx-greet'; card.setAttribute('role', 'note'); card.setAttribute('aria-label', 'Diwali greeting from Tat:vm');
    card.innerHTML = `<span class="fx-diya" aria-hidden="true">${diyaSVG()}</span>
      <div><h3>Shubh Deepavali</h3><p>May your home glow with light, warmth and togetherness this Diwali.</p><span class="fx-sign">— Team Tat:vm</span></div>
      <button type="button" class="fx-calm"></button>
      <button type="button" class="fx-x" aria-label="Close greeting">×</button>`;
    const calmBtn = card.querySelector('.fx-calm');
    const label = () => { calmBtn.textContent = root.classList.contains('festive-calm') ? 'Turn sparkles back on' : 'Calm the sparkles'; };
    if (REDUCE) calmBtn.remove(); else { label(); calmBtn.addEventListener('click', () => { root.classList.toggle('festive-calm'); store.set('tatvm-festive-calm', root.classList.contains('festive-calm') ? '1' : '0'); label(); }); }
    card.querySelector('.fx-x').addEventListener('click', () => { card.classList.remove('show'); store.set(KEY, 'closed'); setTimeout(() => card.remove(), 700); });
    document.body.appendChild(card);
    // never cover the hero's own buttons: show the card once the visitor has scrolled past most of the hero
    const hero = document.querySelector('.hero, .page-hero');
    const show = () => setTimeout(() => card.classList.add('show'), REDUCE ? 0 : 400);
    if (hero) {
      const check = () => { if (hero.getBoundingClientRect().bottom < window.innerHeight * 0.4) { window.removeEventListener('scroll', check); show(); } };
      window.addEventListener('scroll', check, { passive: true });
      check();
    } else show();
  }

  // ------------------------------------------------------------------ welcome popup (once per visitor per season)
  // To use your own Diwali creative instead of the animated artwork, set image to its path from the site root,
  // e.g. 'assets/festive/diwali-creative.jpg' (landscape or square, at least 900 px wide).
  const POPUP = { image: '', link: 'projects.html', linkText: 'Explore Our Projects', delay: 500 };
  const DEPTH = /\/(projects|Blogs|News|blog)\//.test(location.pathname) ? '../' : '';
  function popup() {
    const KEY = 'tatvm-festive-popup-' + new Date().getFullYear();
    if (store.get(KEY) === 'seen' || /[?&]festive-popup=off/.test(location.search)) return false;
    const last = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'fx-pop';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'fxPopTitle');
    const art = POPUP.image
      ? `<img src="${DEPTH + POPUP.image}" alt="Shubh Deepavali from Tat:vm">`
      : `<span class="fx-pop-moon" aria-hidden="true"></span><span class="fx-pop-rangoli" aria-hidden="true">${rangoliSVG()}</span>
         <div class="fx-pop-diyas" aria-hidden="true">${Array.from({ length: 5 }, () => `<span class="fx-diya">${diyaSVG()}</span>`).join('')}</div>`;
    wrap.innerHTML = `<div class="fx-pop-card">
        <button type="button" class="fx-pop-x" aria-label="Close">×</button>
        <div class="fx-pop-art">${art}</div>
        <div class="fx-pop-body">
          <img class="fx-pop-logo" src="${DEPTH}assets/img/tatvm_logo.png" alt="Tat:vm">
          <span class="fx-pop-eyebrow">Festival of lights</span>
          <h2 class="fx-pop-title" id="fxPopTitle">Shubh Deepavali<span>Happy Diwali from Tat:vm</span></h2>
          <p class="fx-pop-text">This Diwali, may every home be filled with light, warmth and new beginnings. Thank you for being part of our journey. Here is to a bright and prosperous year ahead.</p>
          <span class="fx-pop-sign">— With warm wishes, Team Tat:vm</span>
          <div class="fx-pop-actions"><a href="${DEPTH + POPUP.link}">${POPUP.linkText}</a><button type="button" class="fx-pop-close">Celebrate with us</button></div>
        </div>
      </div>`;
    const artBox = wrap.querySelector('.fx-pop-art');
    if (!POPUP.image) {
      const t = document.createElement('div'); t.className = 'fx-toran'; artBox.appendChild(t);
      ['l', 'r'].forEach(side => artBox.appendChild(svgEl(kandilSVG(), 'fx-kandil ' + side)));
    }
    const close = () => {
      wrap.classList.remove('show'); root.classList.remove('fx-lock');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => wrap.remove(), 500);
      if (last && last.focus) last.focus();
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {     // keep keyboard focus inside the popup
        const f = [...wrap.querySelectorAll('a,button')]; const i = f.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.fx-pop-x, .fx-pop-close')) close(); });
    // show as soon as the site's loading screen has cleared (not after every image and video has finished)
    const later = fn => {
      const ld = document.getElementById('loader');
      if (!ld || ld.classList.contains('done')) return fn();
      let fired = false; const go = () => { if (!fired) { fired = true; fn(); } };
      new MutationObserver((m, o) => { if (ld.classList.contains('done')) { o.disconnect(); go(); } }).observe(ld, { attributes: true, attributeFilter: ['class'] });
      setTimeout(go, 4200);   // safety
    };
    later(() => setTimeout(() => {
      if (document.querySelector('.fx-pop')) return;
      document.body.appendChild(wrap);
      root.classList.add('fx-lock');
      store.set(KEY, 'seen');
      if (!POPUP.image) {
        artBox.querySelector('.fx-toran').innerHTML = toranSVG(Math.max(300, Math.round(artBox.clientWidth)));
        const c = document.createElement('canvas'); c.className = 'fx-sky'; artBox.insertBefore(c, artBox.firstChild);
        sky(c, artBox, true);
      }
      requestAnimationFrame(() => wrap.classList.add('show'));
      document.addEventListener('keydown', onKey, true);
      wrap.querySelector('.fx-pop-actions a').focus({ preventScroll: true });
    }, REDUCE ? 600 : POPUP.delay));
    return true;
  }

  // ------------------------------------------------------------------ start
  function start() {
    decorateSections();
    if (!popup()) greet();     // the popup is the greeting on a visitor's first page; the small card appears on later pages
    // the footer is drawn by components.js; wait for it briefly
    let tries = 0; (function waitFooter() { if (!decorateFooter() && tries++ < 40) setTimeout(waitFooter, 150); })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
