/* Press clipping viewer: opens the image / PDF pages of a clipping in a zoomable overlay.
   Any element with data-clip="page1.jpg|page2.jpg" (and optional data-clip-title) opens it. */
(function () {
  var MIN = 1, MAX = 6;
  var CSS = "[data-clip]{cursor:zoom-in}html.clipv-lock{overflow:hidden}.clipv{position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;background:rgba(20,16,13,.96);color:#fff;font-family:inherit}.clipv.open{display:flex}.clipv-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:rgba(0,0,0,.35);flex-wrap:wrap}.clipv-title{font-size:.92rem;font-weight:700;line-height:1.3;flex:1 1 220px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.clipv-tools,.clipv-zoom{display:flex;align-items:center;gap:6px}.clipv-btn{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;padding:0 10px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font:700 1.15rem/1 inherit;cursor:pointer;text-decoration:none;transition:background .2s}.clipv-btn:hover,.clipv-btn:focus-visible{background:rgba(255,255,255,.22);outline:none}.clipv-btn.clipv-txt{font-size:.78rem;letter-spacing:.04em;padding:0 12px}.clipv-btn.clipv-close{font-size:1.5rem;background:#fff;color:#1d1814;border-color:#fff}.clipv-btn:disabled{opacity:.3;cursor:default}.clipv-pct{min-width:48px;text-align:center;font-size:.8rem;font-weight:700}.clipv-stage{position:relative;flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none}.clipv-stage.zoomed{cursor:grab}.clipv-stage.zoomed:active{cursor:grabbing}.clipv-img{display:block;max-width:calc(100% - 24px);max-height:calc(100% - 24px);width:auto;height:auto;transform-origin:center center;will-change:transform;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5);cursor:zoom-in}.clipv-stage.zoomed .clipv-img{cursor:inherit}.clipv-frame{display:none;width:100%;height:100%;border:0;background:#fff}.clipv-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:56px;font-size:2rem;background:rgba(0,0,0,.55);z-index:2}.clipv-prev{left:10px}.clipv-next{right:10px}.clipv-count{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.6);font-size:.78rem;font-weight:700;letter-spacing:.04em;z-index:2}@media (max-width:600px){.clipv-title{flex-basis:100%;white-space:normal;font-size:.85rem}.clipv-tools{width:100%;justify-content:space-between}.clipv-nav{width:38px;height:48px}}";
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  var ov, stage, img, frame, titleEl, pctEl, countEl, openEl, prevBtn, nextBtn, zoomBox;
  var pages = [], original = '', idx = 0, scale = 1, tx = 0, ty = 0, lastFocus = null;
  var pointers = {}, dragStart = null, pinchStart = null, moved = false;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  function btn(cls, label, html) { var b = el('button', 'clipv-btn ' + cls, html); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; return b; }
  function isPdf(u) { return /\.pdf($|[?#])/i.test(u); }

  function build() {
    ov = el('div', 'clipv');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Press clipping viewer');
    var bar = el('div', 'clipv-bar');
    titleEl = el('div', 'clipv-title');
    var tools = el('div', 'clipv-tools');
    zoomBox = el('div', 'clipv-zoom');
    var out = btn('', 'Zoom out', '&minus;'), inn = btn('', 'Zoom in', '+'), reset = btn('clipv-txt', 'Reset zoom', 'Reset');
    pctEl = el('span', 'clipv-pct', '100%');
    zoomBox.appendChild(out); zoomBox.appendChild(pctEl); zoomBox.appendChild(inn); zoomBox.appendChild(reset);
    openEl = el('a', 'clipv-btn clipv-txt', 'Open original'); openEl.target = '_blank'; openEl.rel = 'noopener';
    var close = btn('clipv-close', 'Close', '&times;');
    tools.appendChild(zoomBox); tools.appendChild(openEl); tools.appendChild(close);
    bar.appendChild(titleEl); bar.appendChild(tools);

    stage = el('div', 'clipv-stage');
    img = el('img', 'clipv-img'); img.alt = ''; img.draggable = false;
    frame = el('iframe', 'clipv-frame'); frame.title = 'Press clipping';
    prevBtn = btn('clipv-nav clipv-prev', 'Previous page', '&#8249;');
    nextBtn = btn('clipv-nav clipv-next', 'Next page', '&#8250;');
    countEl = el('div', 'clipv-count');
    stage.appendChild(img); stage.appendChild(frame);
    ov.appendChild(bar); ov.appendChild(stage); ov.appendChild(prevBtn); ov.appendChild(nextBtn); ov.appendChild(countEl);
    document.body.appendChild(ov);

    out.addEventListener('click', function () { zoomTo(scale / 1.4); });
    inn.addEventListener('click', function () { zoomTo(scale * 1.4); });
    reset.addEventListener('click', function () { scale = 1; tx = ty = 0; apply(); });
    close.addEventListener('click', hide);
    prevBtn.addEventListener('click', function () { show(idx - 1); });
    nextBtn.addEventListener('click', function () { show(idx + 1); });

    stage.addEventListener('wheel', function (e) {
      if (frame.style.display === 'block') return;
      e.preventDefault();
      zoomTo(scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
    }, { passive: false });

    stage.addEventListener('dblclick', function (e) {
      if (e.target !== img) return;
      if (scale > 1.05) { scale = 1; tx = ty = 0; apply(); } else zoomTo(2.5, e.clientX, e.clientY);
    });

    stage.addEventListener('pointerdown', function (e) {
      if (frame.style.display === 'block') return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      moved = false;
      if (ids.length === 1) dragStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      if (ids.length === 2) { pinchStart = { d: dist(), s: scale }; dragStart = null; }
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinchStart && Object.keys(pointers).length === 2) { moved = true; zoomTo(pinchStart.s * dist() / pinchStart.d); return; }
      if (dragStart && scale > 1) {
        var dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        tx = dragStart.tx + dx; ty = dragStart.ty + dy; apply();
      }
    });
    function up(e) {
      var wasDown = !!pointers[e.pointerId];
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchStart = null;
      if (!Object.keys(pointers).length) dragStart = null;
      // a plain click on the dark area (not the page) closes the viewer
      if (wasDown && !moved && e.type === 'pointerup' && e.target === stage) hide();
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);

    document.addEventListener('keydown', function (e) {
      if (!ov.classList.contains('open')) return;
      if (e.key === 'Escape') hide();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === '+' || e.key === '=') zoomTo(scale * 1.4);
      else if (e.key === '-') zoomTo(scale / 1.4);
      else if (e.key === '0') { scale = 1; tx = ty = 0; apply(); }
    });
    window.addEventListener('resize', function () { if (ov.classList.contains('open')) apply(); });
  }

  function dist() {
    var p = Object.keys(pointers).map(function (k) { return pointers[k]; });
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
  }

  // zoom keeping the point under (cx, cy) in place; defaults to the centre of the stage
  function zoomTo(next, cx, cy) {
    next = Math.max(MIN, Math.min(MAX, next));
    var r = stage.getBoundingClientRect();
    var ox = (cx == null ? r.left + r.width / 2 : cx) - (r.left + r.width / 2);
    var oy = (cy == null ? r.top + r.height / 2 : cy) - (r.top + r.height / 2);
    var k = next / scale;
    tx = ox - (ox - tx) * k; ty = oy - (oy - ty) * k;
    scale = next;
    if (scale === 1) tx = ty = 0;
    apply();
  }

  function apply() {
    var mx = Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2 + 40);
    var my = Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2 + 40);
    tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    pctEl.textContent = Math.round(scale * 100) + '%';
    stage.classList.toggle('zoomed', scale > 1);
  }

  function show(i) {
    if (i < 0 || i >= pages.length) return;
    idx = i; scale = 1; tx = ty = 0;
    var u = pages[idx], pdf = isPdf(u);
    img.style.display = pdf ? 'none' : 'block';
    frame.style.display = pdf ? 'block' : 'none';
    zoomBox.style.display = pdf ? 'none' : '';
    if (pdf) { frame.src = u; img.removeAttribute('src'); } else { frame.removeAttribute('src'); img.src = u; }
    openEl.href = original || u;
    prevBtn.style.display = nextBtn.style.display = countEl.style.display = pages.length > 1 ? '' : 'none';
    prevBtn.disabled = idx === 0; nextBtn.disabled = idx === pages.length - 1;
    countEl.textContent = 'Page ' + (idx + 1) + ' of ' + pages.length;
    apply();
  }

  function open(list, title, file) {
    if (!ov) build();
    pages = list; original = file || ''; lastFocus = document.activeElement;
    titleEl.textContent = title || '';
    img.alt = title || 'Press clipping';
    ov.classList.add('open');
    document.documentElement.classList.add('clipv-lock');
    show(0);
    ov.querySelector('.clipv-close').focus();
  }

  function hide() {
    ov.classList.remove('open');
    document.documentElement.classList.remove('clipv-lock');
    frame.removeAttribute('src');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-clip]');
    if (!t) return;
    var list = (t.getAttribute('data-clip') || '').split('|').filter(Boolean);
    if (!list.length) return;
    e.preventDefault();
    open(list, t.getAttribute('data-clip-title'), t.getAttribute('data-clip-file'));
  });
})();
