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
