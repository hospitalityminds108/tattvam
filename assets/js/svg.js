// Tat:vm — shared SVG assets (logo, tattva pentagon, icon library)
window.TATVM = (() => {

  /* ---------------- BRAND LOGO ---------------- */
  const logo = (variant = 'dark') => {
    const base = location.pathname.includes('/projects/') ? '../' : './';
    const src = `${base}tatvm_logo.png`;
    const fallback = `${base}assets/img/tatvm-logo.svg`;
    return `<img src="${src}" alt="Tat:vm — Rooted in you" class="brand-logo ${variant === 'white' ? 'brand-logo-white' : ''}" loading="eager" decoding="async" onerror="this.onerror=null;this.src='${fallback}';">`;
  };

  /* ---------------- TATTVA PENTAGON (all five together) ---------------- */
  const tattvaPentagon = () => {
    // Central pentagon: 5 · node colors from brand graphics
    const nodes = [
      { key:'space',      label:'SPACE',   color:'#E8B23A' },
      { key:'light',      label:'LIGHT',   color:'#E97F31' },
      { key:'air',        label:'AIR',     color:'#3FA8B5' },
      { key:'vastu',      label:'VASTU',   color:'#8B6BB1' },
      { key:'sustain',    label:'SUSTAINABILITY', color:'#9FB63D' },
    ];
    // node positions on a pentagon (top, upper-right, lower-right, lower-left, upper-left)
    const pos = [
      { x:250, y:52  },  // top
      { x:448, y:196 },  // upper-right
      { x:372, y:430 },  // lower-right
      { x:128, y:430 },  // lower-left
      { x:52,  y:196 },  // upper-left
    ];
    const icons = {
      space:   `<path d="M12 3c-2.5 3.8-7.5 4.2-7.5 9A7.5 7.5 0 0 0 12 19.5 7.5 7.5 0 0 0 19.5 12c0-4.8-5-5.2-7.5-9Z"/>`,
      light:   `<circle cx="12" cy="12" r="4.6"/><g stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></g>`,
      air:     `<path d="M3 8h9.5a3 3 0 1 0-3-3M3 12h13.5a3 3 0 1 1-3 3M3 16h7.5a2.5 2.5 0 1 1-2.5 2.5" fill="none" stroke-width="2.1" stroke-linecap="round"/>`,
      vastu:   `<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke-width="1.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke-width="1.6" transform="rotate(-60 12 12)"/>`,
      sustain: `<path d="M12 21c-4 0-7-3-7-7 0-3 2-6.5 7-11 5 4.5 7 8 7 11 0 4-3 7-7 7Z"/><path d="M12 21V9" stroke="#fff" stroke-width="1.6" fill="none"/>`,
    };
    let nodesSvg = '';
    nodes.forEach((n, i) => {
      const p = pos[i];
      nodesSvg += `
      <g class="pnode" data-tattva="${n.key}" tabindex="0" role="button" aria-label="${n.label} — show meaning">
        <circle class="halo" cx="${p.x}" cy="${p.y}" r="46" fill="#FFFFFF" stroke="${n.color}" stroke-width="2" stroke-dasharray="5 6"/>
        <circle cx="${p.x}" cy="${p.y}" r="34" fill="${n.color}"/>
        <g transform="translate(${p.x - 12},${p.y - 12})" fill="#fff">${icons[n.key].replace(/stroke-width="2\.1"/,'stroke="#fff"').replace(/stroke-width="1\.6"/g,'stroke="#fff"')}</g>
        <text class="lbl" x="${p.x}" y="${p.y + 64}" text-anchor="middle">${n.label}</text>
      </g>`;
    });
    // core pentagon
    const core = `M250 96 L414 215 L351 408 L149 408 L86 215 Z`;
    return `<svg class="pent-svg" viewBox="0 0 500 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The five Tat:vm tattvas — space, light, air, vastu and sustainability as one system">
      <defs>
        <linearGradient id="pcore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8E1F24"/><stop offset="1" stop-color="#6E1417"/>
        </linearGradient>
      </defs>
      <!-- dotted connectors from core to each node -->
      <g stroke="#B98A8D" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round">
        <line x1="250" y1="120" x2="250" y2="76"/>
        <line x1="330" y1="238" x2="392" y2="212"/>
        <line x1="310" y1="330" x2="348" y2="396"/>
        <line x1="190" y1="330" x2="152" y2="396"/>
        <line x1="170" y1="238" x2="108" y2="212"/>
      </g>
      <g class="pent-core">
        <path d="${core}" fill="url(#pcore)"/>
        <path d="${core}" fill="none" stroke="#9FB63D" stroke-width="2.5" stroke-dasharray="6 8"/>
        <text x="250" y="248" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="86" fill="#FBF7F0">5</text>
        <text x="250" y="296" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="21" letter-spacing="6" fill="#F3C9CD">TATTVAS</text>
        <text x="250" y="322" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-weight="700" font-size="11.5" letter-spacing="2.4" fill="rgba(251,247,240,.72)">ONE SYSTEM · ONE HOME</text>
      </g>
      ${nodesSvg}
    </svg>`;
  };

  /* ---------------- ICON LIBRARY ---------------- */
  const I = {
    arrow:    `<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    arrowUp:  `<path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    arrowR:   `<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    chevL:    `<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    chevR:    `<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    chevD:    `<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    pin:      `<path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/>`,
    home:     `<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v10h12V10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
    building: `<rect x="5" y="3" width="14" height="18" rx="1.6"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><path d="M10.5 21v-3h3v3" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
    ruler:    `<rect x="2" y="9" width="20" height="6" rx="1.4" transform="rotate(0)"/><path d="M6 9v3M10 9v3M14 9v3M18 9v3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
    bed:      `<path d="M3 18v-7h18v7"/><path d="M3 11V6M3 11h13a6 6 0 0 1 6 6v1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7.5" cy="8.6" r="1.8"/>`,
    key:      `<circle cx="8" cy="12" r="4.2"/><path d="M12.2 12H21M18 12v3.4M15 12v2.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    user:     `<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    users:    `<circle cx="9" cy="8.5" r="3.6"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0"/><path d="M16 5.4a3.6 3.6 0 0 1 0 6.9M17.6 13.6a6.2 6.2 0 0 1 3.6 5.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
    phone:    `<path d="M6.8 3.5c.6-.6 1.6-.6 2.2 0l2 2c.6.6.6 1.6 0 2.2l-1.3 1.3a13.5 13.5 0 0 0 5.3 5.3l1.3-1.3c.6-.6 1.6-.6 2.2 0l2 2c.6.6.6 1.6 0 2.2l-1.5 1.5c-.9.9-2.2 1.2-3.4.8-6.8-2.2-12.2-7.6-14.4-14.4-.4-1.2-.1-2.5.8-3.4l1.5-1.5Z"/>`,
    mail:     `<rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
    whatsapp: `<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M9.2 7.8c.3-.7 1.5-.8 1.8-.1l.7 1.5c.2.4 0 .9-.4 1.2l-.6.5c.4 1 1.2 1.9 2.2 2.4l.5-.6c.3-.4.8-.5 1.2-.3l1.6.7c.7.3.6 1.5-.1 1.8-2.7 1.1-6.9-2.6-6.9-7.1Z" fill="#fff"/>`,
    chat:     `<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.4 3.4a.8.8 0 0 1-1.3-.7V6a1 1 0 0 1 1-1Z"/><path d="M8 9h8M8 12.5h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
    leaf:     `<path d="M12 21c-4.4 0-8-3.6-8-8 0-3.6 2.3-7.8 8-12 5.7 4.2 8 8.4 8 12 0 4.4-3.6 8-8 8Z"/><path d="M12 21V9.5" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
    sun:      `<circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    wind:     `<path d="M3 8h9.5a3 3 0 1 0-3-3M3 12h13.5a3 3 0 1 1-3 3M3 16h7.5a2.5 2.5 0 1 1-2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    compass:  `<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="#fff"/>`,
    recycle:  `<path d="M7 9h3l-2.5-4L5 9h2ZM14.5 5 17 9h-3l.5-4ZM9.5 19l2.5-4h-3l.5 4ZM15 9h4l-2.5 4M4 17l2.5-4M13.5 13 16 17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
    shield:   `<path d="M12 3 5 5.5v5c0 4.6 3 8.2 7 10 4-1.8 7-5.4 7-10v-5L12 3Z"/><path d="m9 11.5 2.3 2.3L15.5 9.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    star:     `<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3Z"/>`,
    heart:    `<path d="M12 20.5S4 15.5 4 9.8C4 7 6.2 5 8.7 5c1.4 0 2.6.7 3.3 1.8.7-1.1 1.9-1.8 3.3-1.8 2.5 0 4.7 2 4.7 4.8 0 5.7-8 10.7-8 10.7Z"/>`,
    check:    `<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    plus:     `<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
    close:    `<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
    clock:    `<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    doc:      `<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 12h6M9 15.5h6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
    // social
    linkedin: `<path d="M6.5 8.5v11H3v-11h3.5ZM4.7 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM21 12.4v7.1h-3.5v-6.3c0-1.5-.6-2.4-1.8-2.4-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9v6.4H10.2s.05-10.4 0-11h3.5v1.6c.5-.8 1.3-1.9 3.3-1.9 2.4 0 4 1.6 4 5.2Z"/>`,
    instagram:`<path d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Z"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.3" cy="6.7" r="1.3" fill="#fff"/>`,
    youtube:  `<path d="M22 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.8C18.3 5 12 5 12 5s-6.3 0-7.9.5A2.5 2.5 0 0 0 2.4 7.3C2 8.8 2 12 2 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.7 1.8C5.7 19 12 19 12 19s6.3 0 7.9-.5a2.5 2.5 0 0 0 1.7-1.8c.4-1.5.4-4.7.4-4.7Z"/><path d="m10 9 5 3-5 3V9Z" fill="#fff"/>`,
    facebook: `<path d="M14 8.5V7c0-.8.2-1.2 1.3-1.2H17V3h-2.6C11.5 3 11 4.6 11 6.8v1.7H9V12h2v9h3v-9h2.3l.4-3.5H14Z"/>`,
    // tattva icons (used in detail panel)
    tSpace:   `<path d="M12 3c-2.5 3.8-7.5 4.2-7.5 9A7.5 7.5 0 0 0 12 19.5 7.5 7.5 0 0 0 19.5 12c0-4.8-5-5.2-7.5-9Z"/>`,
    tLight:   `<circle cx="12" cy="12" r="4.6"/><g stroke="currentColor" stroke-linecap="round" fill="none" stroke-width="1.9"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></g>`,
    tAir:     `<path d="M3 8h9.5a3 3 0 1 0-3-3M3 12h13.5a3 3 0 1 1-3 3M3 16h7.5a2.5 2.5 0 1 1-2.5 2.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>`,
    tVastu:   `<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-60 12 12)"/>`,
    tSustain: `<path d="M12 21c-5.5-4.2-8.5-7.8-8.5-12A5.5 5.5 0 0 1 9 3.5c1.5 0 3 .7 4 2.1 1-1.4 2.5-2.1 4-2.1A5.5 5.5 0 0 1 20.5 9c0 4.2-3 7.8-8.5 12Z"/><path d="M12 20V9.5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
    // brand diamond mark (loader / poem badge)
    diamond:  `<path d="M12 2 22 12 12 22 2 12Z"/><path d="M12 6.5 17.5 12 12 17.5 6.5 12Z" fill="#FBF7F0" opacity=".9"/>`,
    quote:    `<path d="M9.5 7C6.5 8 5 10.3 5 13.8V17h4.8v-4.8H7.4c0-2 .9-3.4 2.7-4L9.5 7Zm9 0c-3 1-4.5 3.3-4.5 6.8V17h4.8v-4.8h-2.4c0-2 .9-3.4 2.7-4L18.5 7Z"/>`,
    globe:    `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
    book:     `<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" fill="#FBF7F0" opacity=".55"/>`,
    play:     `<path d="M8 5.5v13l11-6.5-11-6.5Z"/>`,
    pause:    `<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>`,
    mute:     `<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m16 9 5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    gear:     `<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>`,
    wrench:   `<path d="M20.7 6.3a5.5 5.5 0 0 1-7.3 6.9L7 19.6a2.1 2.1 0 1 1-3-3l6.4-6.4a5.5 5.5 0 0 1 6.9-7.3l-3.1 3.1 1.3 4.5 4.5 1.3 3.1-3.1Z"/>`,
    briefcase:`<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
    handshake:`<path d="m3 12 4-4 5 5-2 2-3-3-4 0Zm18 0-4-4-5 5 2 2 3-3 4 0Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m9 13 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
    emi:      `<path d="M12 3v18M8.5 6.5 12 3l3.5 3.5M4 9c0 6 3.6 9 8 12 4.4-3 8-6 8-12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
    fileDown: `<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 18v2h16v-2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
    search:   `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.4-4.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>`,
    bars:     `<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  };

  const icon = (name, cls = '') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${I[name] || I.arrow}</svg>`;

  /* ---------------- DECORATIVE BRAND PATTERN ---------------- */
  const patternURI = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'><path d='M28 20l8 8-8 8-8-8z' fill='none' stroke='%238E1F24' stroke-opacity='.35' stroke-width='1.4'/><circle cx='28' cy='28' r='1.6' fill='%239FB63D' fill-opacity='.5'/></svg>`
  )}`;

  return { logo, tattvaPentagon, icon, I, patternURI };
})();

/* auto-inject icons/logos from static markup: <i data-icon="pin"></i>, <span data-logo="dark"></span> */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-icon]').forEach(el => {
    el.classList.add('ico');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = window.TATVM.icon(el.dataset.icon, el.dataset.icls || '');
  });
  document.querySelectorAll('[data-logo]').forEach(el => {
    el.innerHTML = window.TATVM.logo(el.dataset.logo || 'dark');
  });
});
