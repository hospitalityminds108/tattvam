// Tat:vm — shared components (header, footer, floating contact stack)
document.addEventListener('DOMContentLoaded', () => {
  const T = window.TATVM;
  const path = location.pathname.split('/').pop() || 'index.html';
  const depth = location.pathname.includes('/projects/') ? '../' : '';

  /* ============ HEADER ============ */
  const NAV = [
    { label:'About', href:'about.html', dd:[
      { label:'Our Approach',      href:'our-approach.html', icon:'compass' },
      { label:'Vision & Mission',  href:'vision-mission.html', icon:'star' },
      { label:'Brand Story',       href:'brand-story.html', icon:'book' },
      { label:'Leadership',        href:'leadership.html', icon:'user' },
      { label:'CSR',               href:'csr.html', icon:'heart' },
    ]},
    { label:'Projects', href:'projects.html', dd:[
      { label:'All Projects',          href:'projects.html', icon:'building' },
      { label:'Ghatkopar — Mixed-Use', href:'projects/ghatkopar-mixed-use.html', icon:'briefcase' },
      { label:'Ghatkopar — Residential', href:'projects/ghatkopar-residential.html', icon:'home' },
    ]},
    { label:'Redevelopment', href:'redevelopment.html' },
    { label:'Opportunities', href:'#', dd:[
      { label:'Work With Us',     href:'work-with-us.html', icon:'handshake' },
      { label:'Network Partners', href:'network-partners.html', icon:'users' },
      { label:'NRI Services',     href:'nri.html', icon:'globe' },
    ]},
    { label:'Insights', href:'insights.html', dd:[
      { label:'Blogs & Perspectives', href:'insights.html', icon:'book' },
      { label:'FAQs',                 href:'faqs.html', icon:'chat' },
    ]},
    { label:'Contact', href:'contact.html' },
  ];

  const headerHTML = `
  <header class="site-header" id="siteHeader">
    <div class="bar">
      <a class="brand" href="${depth}index.html" aria-label="Tat:vm home">${T.logo('dark')}</a>
      <nav class="nav-desktop" aria-label="Primary">
        ${NAV.map(n => {
          const active = n.dd
            ? n.dd.some(d => d.href === path || (d.href === 'projects.html' && path === 'projects.html' && n.label === 'Projects'))
            : n.href === path;
          const activeCls = active ? ' active' : '';
          return `<div class="nav-item${activeCls}">
            <a href="${n.dd && n.label !== 'Projects' ? '#' : (n.label==='Projects' && n.dd ? depth + 'projects.html' : depth + n.href)}" ${n.dd && n.label !== 'Projects' ? 'aria-haspopup="true"' : ''}>${n.label}</a>
            ${n.dd ? `<div class="dd">${n.dd.map(d => `<a href="${d.href.startsWith('projects/') && depth === '' ? '' : depth}${d.href}">${T.icon(d.icon)}${d.label}</a>`).join('')}</div>` : ''}
          </div>`;
        }).join('')}
      </nav>
      <div class="header-cta">
        <a href="${depth}contact.html" class="btn btn-primary" style="padding:.8rem 1.4rem">Enquire Now ${T.icon('arrow','arrow')}</a>
        <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>
  <div class="mnav" id="mnav" aria-hidden="true">
    ${NAV.map(n => `
      <a class="mlink" href="${n.href === '#' ? 'javascript:void(0)' : depth + n.href}" data-mgroup="${n.label}">${n.label}${n.dd ? `<em>+</em>` : ''}</a>
      ${n.dd ? `<div class="msub" data-msub="${n.label}">${n.dd.map(d => `<a href="${d.href.startsWith('projects/') && depth === '' ? '' : depth}${d.href}">${d.label}</a>`).join('')}</div>` : ''}`).join('')}
    <div class="mnav-foot">
      <a href="${depth}contact.html" class="btn btn-primary">Enquire Now ${T.icon('arrow','arrow')}</a>
      <a href="https://wa.me/919152000425" class="btn btn-green" target="_blank" rel="noopener">WhatsApp ${T.icon('whatsapp','arrow')}</a>
    </div>
  </div>`;

  document.getElementById('header-slot').outerHTML = headerHTML;

  /* header scroll state */
  const header = document.getElementById('siteHeader');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('solid', y > 40);
    header.classList.toggle('hidden', y > 500 && y > lastY && !document.getElementById('mnav').classList.contains('open'));
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* mobile menu */
  const burger = document.getElementById('burger');
  const mnav = document.getElementById('mnav');
  const openM = (open) => {
    burger.classList.toggle('open', open);
    mnav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    mnav.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
    mnav.querySelectorAll('.mlink').forEach((a, i) => a.style.transitionDelay = open ? `${.12 + i * .06}s` : '0s');
  };
  burger.addEventListener('click', () => openM(!mnav.classList.contains('open')));
  mnav.querySelectorAll('.mlink').forEach(a => {
    a.addEventListener('click', e => {
      const sub = mnav.querySelector(`[data-msub="${a.dataset.mgroup}"]`);
      if (sub) {
        e.preventDefault();
        const vis = sub.style.display === 'block';
        mnav.querySelectorAll('.msub').forEach(s => s.style.display = 'none');
        sub.style.display = vis ? 'none' : 'block';
        const em = a.querySelector('em');
        if (em) em.textContent = vis ? '+' : '–';
      }
    });
  });

  /* ============ FOOTER (light pink) ============ */
  const footerHTML = `
  <footer class="site-footer">
    <div class="container">
      <div class="f-top">
        <div class="f-brand">
          ${T.logo('dark')}
          <p class="tagline">Rooted in you.</p>
          <p>A Mumbai real estate development company building residential, commercial and mixed-use spaces around the five tattvas — with transparency, discipline and care.</p>
          <div class="f-social">
            <a href="https://in.linkedin.com/company/tatvm-group" target="_blank" rel="noopener" aria-label="LinkedIn">${T.icon('linkedin')}</a>
            <a href="https://www.instagram.com/tatvmgroup/" target="_blank" rel="noopener" aria-label="Instagram">${T.icon('instagram')}</a>
            <a href="https://youtube.com/@tatvmgroup" target="_blank" rel="noopener" aria-label="YouTube">${T.icon('youtube')}</a>
            <a href="https://www.facebook.com/profile.php?id=61577605111837" target="_blank" rel="noopener" aria-label="Facebook">${T.icon('facebook')}</a>
          </div>
        </div>
        <div class="f-col">
          <h4>Company</h4>
          <a href="${depth}about.html">About Tat:vm</a>
          <a href="${depth}our-approach.html">Our Approach</a>
          <a href="${depth}vision-mission.html">Vision &amp; Mission</a>
          <a href="${depth}brand-story.html">Brand Story</a>
          <a href="${depth}leadership.html">Leadership</a>
          <a href="${depth}csr.html">CSR</a>
        </div>
        <div class="f-col">
          <h4>Explore</h4>
          <a href="${depth}projects.html">Projects</a>
          <a href="${depth}redevelopment.html">Redevelopment</a>
          <a href="${depth}insights.html">Insights</a>
          <a href="${depth}faqs.html">FAQs</a>
          <a href="${depth}work-with-us.html">Work With Us</a>
          <a href="${depth}nri.html">NRI Services</a>
          <a href="${depth}network-partners.html">Network Partners</a>
        </div>
        <div class="f-col">
          <h4>Get in touch</h4>
          <ul class="f-contact">
            <li>${T.icon('pin')}<span>Unit 607, 6th Floor, Lodha Supremus,<br>Senapati Bapat Marg, Lower Parel,<br>Mumbai 400013</span></li>
            <li>${T.icon('phone')}<a href="tel:+912235006800">+91 22 3500 6800</a></li>
            <li>${T.icon('mail')}<a href="mailto:info@tatvmgroup.com">info@tatvmgroup.com</a></li>
          </ul>
          <h4 style="margin-top:1.6rem">Newsletter</h4>
          <form class="f-news" onsubmit="return tatvmSubscribe(event)">
            <input type="email" required placeholder="Your email" aria-label="Email for newsletter">
            <button type="submit" aria-label="Subscribe">${T.icon('arrowR')}</button>
          </form>
          <p class="form-note" style="margin-top:.6rem">Project updates &amp; insights. No spam.</p>
        </div>
      </div>
      <div class="f-bottom">
        <span>© ${new Date().getFullYear()} Tat:vm Builders &amp; Developers Pvt. Ltd.</span>
        <span class="f-cin">CIN: U43299MH2025PTC455088</span>
        <span>
          <a href="${depth}privacy-policy.html">Privacy</a> ·
          <a href="${depth}terms-and-conditions.html">Terms</a> ·
          <a href="${depth}cookie-policy.html">Cookies</a>
        </span>
      </div>
    </div>
  </footer>`;

  document.getElementById('footer-slot').outerHTML = footerHTML;

  /* ============ FLOATING CONTACT STACK ============ */
  const stackHTML = `
  <div class="float-stack" id="floatStack">
    <div class="float-items">
      <a class="fbtn wa" href="https://wa.me/919152000425" target="_blank" rel="noopener">${T.icon('whatsapp')}<span>WhatsApp</span></a>
      <a class="fbtn call" href="tel:+912235006800">${T.icon('phone')}<span>Call Us</span></a>
      <a class="fbtn mail" href="mailto:info@tatvmgroup.com">${T.icon('mail')}<span>Email Us</span></a>
      <button class="fbtn bot" id="chatbotBtn" onclick="tatvmOpenChat()" aria-label="Open chat">${T.icon('chat')}<span>Chat with us</span></button>
    </div>
    <button class="float-main" id="floatMain" aria-label="Contact options">
      ${T.icon('chat','c')}${T.icon('close','x')}
    </button>
  </div>
  <button class="to-top" id="toTop" aria-label="Back to top">${T.icon('arrowUp')}</button>`;

  document.body.insertAdjacentHTML('beforeend', stackHTML);

  const stack = document.getElementById('floatStack');
  const mainBtn = document.getElementById('floatMain');
  mainBtn.addEventListener('click', () => stack.classList.toggle('open'));

  const toTop = document.getElementById('toTop');
  window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 700), { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* chatbot (Sell.do slot — replace body with client's script when provided) */
  window.tatvmOpenChat = () => {
    const w = document.getElementById('sellDoChat');
    if (w) { w.style.display = 'flex'; return; }
    const el = document.createElement('div');
    el.id = 'sellDoChat';
    el.innerHTML = `
      <div class="chat-win">
        <div class="chat-head">
          <span class="chat-dot"></span>
          <div><strong>Tat:vm Assistant</strong><small>Typically replies in minutes</small></div>
          <button onclick="tatvmCloseChat()" aria-label="Close chat">${T.icon('close')}</button>
        </div>
        <div class="chat-body">
          <div class="msg them">Namaste! Looking for a home, a commercial space, or exploring redevelopment? Ask us anything.</div>
          <div class="msg me">Hi — I'd like to know more about your projects.</div>
          <div class="msg them">Happy to help. You can also reach us directly on WhatsApp or call +91 22 3500 6800.</div>
        </div>
        <div class="chat-foot">
          <input type="text" placeholder="Type your message…" aria-label="Message">
          <button onclick="this.closest('.chat-win').querySelector('.chat-body').insertAdjacentHTML('beforeend','<div class=\\'msg me\\'>Thanks! I\\'ll explore the projects page.</div>')" aria-label="Send">${T.icon('arrowR')}</button>
        </div>
      </div>`;
    el.style.cssText = 'position:fixed;right:clamp(14px,2.4vw,26px);bottom:calc(clamp(14px,2.4vw,26px) + 84px);z-index:950;display:flex;align-items:flex-end;animation:chatIn .45s var(--ease-out)';
    document.body.appendChild(el);
  };
  window.tatvmCloseChat = () => { const w = document.getElementById('sellDoChat'); if (w) w.style.display = 'none'; };

  /* newsletter (front-end demo — wire to Sell.do/CRM later) */
  window.tatvmSubscribe = (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const ok = document.createElement('div');
    ok.className = 'form-ok show';
    ok.style.cssText = 'margin-top:.7rem;max-width:400px';
    ok.innerHTML = `${T.icon('check')}<span>Thank you — you're on the list.</span>`;
    e.target.replaceWith(ok);
    return false;
  };
});

/* chat window styles (injected once) */
(function injectChatCSS(){
  const css = `
  .chat-win{width:min(360px,88vw);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(43,36,32,.4);border:1px solid #E5D9C6;display:flex;flex-direction:column}
  .chat-head{display:flex;align-items:center;gap:.75rem;padding:1rem 1.1rem;background:#8E1F24;color:#fff}
  .chat-head .chat-dot{width:10px;height:10px;border-radius:50%;background:#9FB63D;box-shadow:0 0 0 3px rgba(159,182,61,.35)}
  .chat-head strong{font-size:.92rem;display:block}
  .chat-head small{font-size:.7rem;opacity:.75}
  .chat-head button{margin-left:auto;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;display:grid;place-items:center}
  .chat-head button svg{width:15px;height:15px}
  .chat-body{padding:1.1rem;display:flex;flex-direction:column;gap:.6rem;max-height:280px;overflow-y:auto;background:#FBF7F0}
  .msg{max-width:82%;padding:.65rem .95rem;border-radius:16px;font-size:.86rem;font-weight:600;line-height:1.45}
  .msg.them{background:#fff;border:1px solid #E5D9C6;color:#3A3128;border-bottom-left-radius:5px;align-self:flex-start}
  .msg.me{background:#8E1F24;color:#fff;border-bottom-right-radius:5px;align-self:flex-end}
  .chat-foot{display:flex;gap:.5rem;padding:.7rem;border-top:1px solid #E5D9C6;background:#fff}
  .chat-foot input{flex:1;border:none;background:#FBF7F0;border-radius:999px;padding:.65rem 1rem;font-family:inherit;font-size:.86rem;min-width:0}
  .chat-foot input:focus{outline:1.5px solid #8E1F24}
  .chat-foot button{width:42px;height:42px;border-radius:50%;background:#8E1F24;color:#fff;display:grid;place-items:center;flex-shrink:0}
  .chat-foot button svg{width:16px;height:16px}
  @keyframes chatIn{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
  @media(max-width:640px){#sellDoChat{bottom:calc(clamp(14px,2.4vw,26px) + 76px)!important}}`;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();
