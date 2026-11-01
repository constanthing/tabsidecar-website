// Homepage prototypes: draws TabSidecar product mockups with the popup's own
// classes (shared/mock.css) instead of screenshots, and wires up the small
// interactions. Pages drop placeholders like
//   <div data-mock="popup" data-page="tabs" data-theme="dark"></div>
// and call nothing: everything mounts on DOMContentLoaded.
(function () {
  const ICONS = window.TS_ICONS || {};
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ------------------------------------------------------------------
     Sample data. Window colors come from shared/window-colors.js; teal is
     reserved for the anchor window.
     ------------------------------------------------------------------ */
  const C = { violet: '#8b5cf6', blue: '#3b82f6', sky: '#0ea5e9', indigo: '#6366f1', fuchsia: '#d946ef', pink: '#ec4899', orange: '#f97316', amber: '#f59e0b', anchor: '#009688' };
  const LABELS = { Research: '#0ea5e9', Design: '#ec4899', Work: '#f59e0b' };
  const PRI = { High: '#ef4444', Medium: '#f59e0b', Low: '#a3a6ae' };

  const WINDOWS = {
    launch: { name: 'Launch week', color: C.violet, current: true, tabs: [
      { t: 'Release notes — v2.4', u: 'docs.google.com/document/d/1Qx8', f: 'D', c: '#4285f4', time: '1h 50m', when: 'Now', active: true },
      { t: 'Launch checklist', u: 'notion.so/acme/launch-checklist', f: 'N', c: '#191919', time: '2h 10m', when: '8m ago', pri: 'High' },
      { t: 'Pull requests · acme/web', u: 'github.com/acme/web/pulls', f: 'G', c: '#24292f', lock: true, when: 'Yesterday', lbl: ['Work'] },
      { t: 'Onboarding v2', u: 'figma.com/design/onboarding-v2', f: 'F', c: '#f24e1e', time: '1h 5m', when: '32m ago', lbl: ['Design'] },
      { t: 'Claude', nick: 'Launch copy ideas', u: 'claude.ai/chat/7f3e', f: 'C', c: '#d97757', time: '40m', when: '14m ago', pin: true },
      { t: 'Payments', u: 'dashboard.stripe.com/payments', f: 'S', c: '#635bff', time: '25m', when: '2h ago' },
      { t: 'Deep focus — lofi mix', u: 'youtube.com/watch?v=jfKfPfyJRdk', f: '▶', c: '#ff0000', time: '3h 20m', when: '1m ago', audio: true },
    ] },
    reading: { name: 'Reading list', color: C.sky, saved: true, tabs: [
      { t: 'A field guide to calm interfaces', u: 'uxdesign.cc/calm-interfaces', f: 'U', c: '#111827', time: '12m', when: '3h ago', later: 'Later' },
      { t: 'Rust async book — Pinning', u: 'rust-lang.github.io/async-book/pinning', f: 'R', c: '#b7410e', time: '35m', when: '4h ago', note: 'Re-read before Thursday' },
      { t: 'Things to do in Lisbon', u: 'timeout.com/lisbon/things-to-do', f: 'T', c: '#e4002b', time: '18m', when: '1h ago', lbl: ['Research'] },
      { t: 'Best budget travel cameras (2026)', u: 'theverge.com/travel-cameras', f: 'V', c: '#5200ff', time: '8m', when: '5h 58m ago', soon: true },
      { t: 'Sourdough, day 1 to day 7', u: 'kingarthurbaking.com/recipes/sourdough', f: 'K', c: '#b91c1c', lock: true, when: 'Sep 12' },
    ] },
    home: { name: 'Home', color: C.orange, tabs: [
      { t: 'Flights to Lisbon', u: 'google.com/travel/flights', f: 'G', c: '#4285f4', time: '26m', when: '40m ago' },
      { t: 'Booking.com: Hotels in Lisbon', nick: 'Lisbon hotel shortlist', u: 'booking.com/city/pt/lisbon', f: 'B', c: '#003580', time: '15m', when: '52m ago', pri: 'Medium' },
      { t: 'Inbox (12) — Gmail', u: 'mail.google.com/mail/u/0', f: 'M', c: '#ea4335', time: '4h', when: '6m ago', pin: true },
      { t: 'KALLAX shelf unit', u: 'ikea.com/us/en/p/kallax', f: 'I', c: '#0058a3', time: '4m', when: '3h ago', later: 'Later' },
    ] },
    daily: { name: 'Daily', color: C.anchor, anchored: true, tabs: [
      { t: 'Calendar — Week of Sep 21', u: 'calendar.google.com', f: '31', c: '#1a73e8', lock: true, when: '20m ago' },
      { t: 'Slack — #launch', u: 'app.slack.com/client/T01/launch', f: 'S', c: '#4a154b', lock: true, when: '2m ago' },
      { t: 'Linear — Cycle 14', u: 'linear.app/acme/cycle/14', f: 'L', c: '#5e6ad2', lock: true, when: '1h ago' },
      { t: 'Inbox (12) — Gmail', u: 'mail.google.com/mail/u/0', f: 'M', c: '#ea4335', lock: true, when: '6m ago' },
    ] },
    // The home page's AI window titles picture: a new window, then the name AI
    // titles gave it. The restore banner lists the same window by that name.
    laptops: { name: 'Laptop research', color: C.violet, ai: true, tabs: [
      { t: 'The best laptops for 2026', u: 'theverge.com/best-laptop', f: 'V', c: '#5200ff', time: '12m', when: '4m ago' },
      { t: 'Laptop battery life, tested', u: 'rtings.com/laptop/tests/battery', f: 'R', c: '#e0301e', time: '9m', when: '3m ago' },
      { t: 'The best ultrabooks', u: 'nytimes.com/wirecutter/reviews/best-ultrabooks', f: 'W', c: '#111827', time: '6m', when: '2m ago' },
      { t: 'ThinkPad X1 Carbon: tech specs', u: 'lenovo.com/us/en/p/laptops', f: 'L', c: '#e2231a', time: '3m', when: '1m ago' },
      { t: 'Laptops on sale', u: 'bestbuy.com/site/laptops', f: 'B', c: '#0046be', when: 'Just now' },
      { t: 'Which laptop should I buy?', u: 'reddit.com/r/SuggestALaptop', f: 'R', c: '#ff4500', when: 'Just now' },
    ] },
  };
  const PARKED = [
    { t: 'Wireless earbuds, compared', u: 'rtings.com/headphones/earbuds', f: 'R', c: '#e0301e', when: '1h ago' },
    { t: 'Q3 metrics — dashboard', u: 'lookerstudio.google.com/reporting/q3', f: 'L', c: '#4285f4', when: '3h ago' },
    { t: 'Hacker News', u: 'news.ycombinator.com', f: 'Y', c: '#ff6600', when: 'Yesterday' },
    { t: 'Cold brew ratio calculator', u: 'coffeeratios.com/cold-brew', f: 'C', c: '#6f4e37', when: 'Yesterday' },
    { t: 'Standing desk reviews', u: 'wirecutter.com/reviews/standing-desks', f: 'W', c: '#111827', when: 'Sep 20' },
  ];
  const DAYS7 = [3, 1, 5, 0, 2, 1, 6];
  const HOURS = [0, 0, 0, 0, 0, 0, 1, 3, 6, 9, 8, 5, 4, 7, 9, 11, 10, 8, 6, 5, 4, 3, 2, 1];

  /* ------------------------------------------------------------------
     Building blocks (markup follows popup-tabs-calm-redesign.html)
     ------------------------------------------------------------------ */
  const fv = (f, c) => ({ f, c });
  const fav = t => `<span class="fav" style="--c:${t.c}">${esc(t.f)}</span>`;
  const FAV_MAX = 5;  // favicons a window row shows before "+N"
  const favStrip = (tabs, n = FAV_MAX) => `<span class="fav-strip">${tabs.slice(0, n).map(fav).join('')}${tabs.length > n ? `<span class="more">+${tabs.length - n}</span>` : ''}</span>`;
  const sw = (on, key = '') => `<button class="switch" role="switch" aria-checked="${!!on}"${key ? ` data-sw="${key}"` : ''}><i></i></button>`;
  const select = label => `<span class="select">${esc(label)}${icon('chev')}</span>`;
  const seg = (opts, on) => `<span class="seg">${opts.map(o => `<button aria-pressed="${o === on}">${esc(o)}</button>`).join('')}</span>`;
  const srow = (label, desc, ctl, cls = '') => `<div class="set-row ${cls}"><div class="set-text"><div class="set-label">${label}</div>${desc ? `<div class="set-sub">${desc}</div>` : ''}</div><div class="set-ctl">${ctl}</div></div>`;
  const sgroup = (title, rows) => `<section class="set-group">${title ? `<h3>${title}</h3>` : ''}<div class="card">${rows.join('')}</div></section>`;

  function tabRow(t, w, o = {}) {
    const flags = (t.pin ? `<span class="t-flag" title="Pinned">${icon('pin')}</span>` : '')
      + (t.audio ? `<span class="t-flag audio" title="Playing audio">${icon('audio')}</span>` : '')
      + (t.note ? `<span class="t-flag" title="${esc(t.note)}">${icon('note')}</span>` : '');
    const chips = (t.pri ? `<span class="pri" style="--pc:${PRI[t.pri]}">${t.pri}</span>` : '')
      + (t.lbl || []).map(n => `<span class="lbl" style="--lc:${LABELS[n]}">${esc(n)}</span>`).join('')
      + (t.later ? `<span class="later">${icon('clock')}${esc(t.later)}</span>` : '');
    const first = t.lock ? `<span class="park locked" title="Locked: never AutoParked">${icon('lock')}</span>`
      : `<span class="park" title="Time accumulated">${t.time ? esc(t.time) : ''}</span>`;
    const title = o.mark ? mark(t.nick || t.t, o.mark) : esc(t.nick || t.t);
    const sub = t.nick ? t.t : t.u;
    const whenCls = t.when === 'Now' ? ' now' : t.soon ? ' soon' : '';
    return `<div class="tab${t.active ? ' active' : ''}" data-key="${esc(t.t)}">
      ${first}${fav(t)}
      <span class="t-main"><span class="t-title">${title}</span>${flags}${chips}<span class="t-url">${o.mark ? mark(sub, o.mark) : esc(sub)}</span></span>
      <span class="t-right">
        ${o.showWin ? `<span class="wd" style="--wc:${w.color}" title="${esc(w.name)}"></span>` : ''}
        <span class="t-when${whenCls}"${t.soon ? ' title="Parks at 6h"' : ''}>${esc(t.when)}</span>
        <span class="t-actions">
          <button class="icon-btn" title="${t.lock ? 'Unlock' : 'Lock'}">${icon(t.lock ? 'unlock' : 'lock')}</button>
          <button class="icon-btn" title="More" data-more>${icon('more')}</button>
          <button class="icon-btn" title="Close tab">${icon('x')}</button>
        </span>
      </span>
    </div>`;
  }
  // Same as highlightSearchMatch() in app/pages/tabs/badges.js: every
  // case-insensitive match, wrapped in <mark class="search-highlight">.
  function mark(text, q) {
    if (!q || !text) return esc(text);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return esc(text).replace(re, '<mark class="search-highlight">$1</mark>');
  }

  function winCard(key, o = {}) {
    const w = WINDOWS[key];
    const tabs = o.rows ? w.tabs.slice(...o.rows) : w.tabs;
    const locked = w.tabs.filter(t => t.lock).length;
    return `<article class="win${o.closed ? ' closed' : ''}${o.cls ? ' ' + o.cls : ''}" style="--wc:${w.color}" data-win="${key}">
      <div class="win-head">
        <button class="caret" aria-label="Collapse window" data-caret>${icon('chev')}</button>
        <span class="wdot"></span>
        <span class="win-title">${esc(o.name || w.name)}</span>
        <span class="win-meta">${w.tabs.length} tabs</span>
        ${w.current ? '<span class="tag brand">Current</span>' : ''}
        ${w.anchored ? `<span class="tag anchor">${icon('pin')}Anchored</span>` : ''}
        ${w.saved ? `<span class="tag">${icon('bookmark')}Saved</span>` : ''}
        ${locked ? `<span class="tag" title="Locked tabs">${icon('lock')}${locked}/${w.tabs.length}</span>` : ''}
        ${w.ai ? `<span class="tag ai">${icon('sparkle')}AI</span>` : ''}
        ${o.closed ? favStrip(w.tabs) : ''}
        <span class="win-actions"><button class="icon-btn" title="Window options" data-winmenu>${icon('more')}</button></span>
      </div>
      <div class="tabs">${tabs.map(t => tabRow(t, w, o)).join('')}</div>
    </article>`;
  }

  function bars(vals, hi) {
    const max = Math.max(...vals, 1), n = vals.length, bw = 100 / n, h = 96;
    return `<svg class="bars" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true">${vals.map((v, i) => {
      const bh = v ? Math.max(3, (v / max) * (h - 4)) : 1.5;
      return `<rect x="${(i * bw + bw * 0.18).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${(bw * 0.64).toFixed(2)}" height="${bh.toFixed(2)}"${i === hi ? ' class="hi"' : ''}/>`;
    }).join('')}</svg>`;
  }
  const statGrid = () => `<div class="stat-grid">
      <div class="card stat"><div class="k">Total parked</div><div class="v">1,284</div><div class="d">since Aug 3</div></div>
      <div class="card stat"><div class="k">Today</div><div class="v" data-today>6</div><div class="d">~410 MB freed</div></div>
      <div class="card stat"><div class="k">This week</div><div class="v">18</div><div class="d">down from 31 last week</div></div>
    </div>`;
  const parkedRow = (p, cls = '') => `<div class="srow${cls}">${fav(p)}<span class="t-main"><span class="t-title">${esc(p.t)}</span><span class="t-url">${esc(p.u)}</span></span>
      <span class="t-right"><span class="sub-meta r-hide">${esc(p.when)}</span><span class="r-actions"><button class="btn sm quiet">${icon('restore')}Reopen</button></span></span></div>`;
  const parkedCard = (list = PARKED, head = true) => `<div class="card">
      ${head ? `<div class="card-head"><h3>Recently parked</h3><span class="r"><button class="btn sm quiet">Reopen all</button></span></div>` : ''}
      <div class="rows" data-parked>${list.map(p => parkedRow(p)).join('')}</div></div>`;

  // The session restore banner at the top of Tabs (recovery-ui.js): green
  // when every window came back, amber while some are still missing. The
  // amber one follows the restore redesign (#267-#275): the summary with when
  // the browser started, Restore all, then Named windows and a folding Other
  // windows (N) group, each row with Restore this window, Hide and a menu.
  const circleCheck = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;
  const RB_RESTORED = ['daily', 'launch', 'reading', 'home'];
  const RB_MISSING = {
    named: [
      { name: 'Tax return 2024', intent: 'File before Oct 15', count: 11, seen: 'Sun 6:02 PM', to: 'closed', favs: [fv('I', '#1a73e8'), fv('T', '#2ca01c'), fv('D', '#4285f4')] },
      { name: 'Q4 planning', count: 9, seen: 'Yesterday', to: 'saved', favs: [fv('S', '#0f9d58'), fv('N', '#191919'), fv('F', '#f24e1e')] },
    ],
    other: [
      { name: 'Laptop research', ai: true, count: 6, seen: '3h ago', to: 'closed', favs: [fv('V', '#5200ff'), fv('R', '#e0301e'), fv('W', '#111827')] },
      { name: 'Untitled Window', count: 4, seen: '6h ago', to: 'closed', favs: [fv('W', '#636466'), fv('G', '#24292f'), fv('Y', '#ff6600')] },
      { name: 'Untitled Window', count: 2, seen: 'Sat 11:40 AM', to: 'closed', favs: [fv('M', '#ea4335'), fv('▶', '#ff0000')] },
    ],
  };
  // A window of the same session hidden from the banner earlier: it moved to
  // the Closed page and left the banner, so the Last session page shows it as
  // Moved to Closed and the picture's Closed page lists it. Its name is an AI
  // title, so it is one of the Other windows, as Laptop research is.
  const MOVED_TO_CLOSED = {
    kitchen: { name: 'Kitchen remodel', ai: true, color: C.fuchsia, tabs: [fv('H', '#4dbc15'), fv('I', '#0058a3'), fv('P', '#e60023'), fv('L', '#004990'), fv('▶', '#ff0000')] },
  };
  // When the browser started, on the banner and the Last session page alike.
  const LAUNCHED = 'Chrome started Mon 9:02 AM';
  const HIDE_TIP = { saved: 'Already in Saved Windows', closed: 'Moves to the Closed page' };

  // The Last session page (last-session.js, #272): the same session as the
  // banner, built from its lists so the two can't disagree (#543): its
  // restored windows, its missing ones, and the window moved to Closed, each
  // with what became of it, in the banner's two groups. Statuses are
  // STATUS_LABEL's words; a missing window has Restore and Hide, one moved to
  // Closed has Restore. The website check compares these copies with the
  // popup's.
  const LS_STATUS = { 'restored-auto': 'Restored automatically', 'restored-by-you': 'Restored by you', missing: 'Missing', 'moved-to-closed': 'Moved to Closed' };
  const LS_RESTORE_TIP = 'Opens this window again with all its tabs, its name and its locks';
  // Of the banner's restored windows, the ones you restored; the rest came back on their own.
  const RESTORED_BY_YOU = ['home'];
  const lsWindow = (w, status) => ({ name: w.name, count: w.tabs.length, favs: w.tabs, status });
  const lsMissing = w => ({ ...w, status: 'missing' });
  const LAST_SESSION = {
    named: [...RB_RESTORED.map(key => lsWindow(WINDOWS[key], RESTORED_BY_YOU.includes(key) ? 'restored-by-you' : 'restored-auto')), ...RB_MISSING.named.map(lsMissing)],
    other: [...RB_MISSING.other.map(lsMissing), ...Object.values(MOVED_TO_CLOSED).map(w => lsWindow(w, 'moved-to-closed'))],
  };
  function restoredBanner({ missing = false, open = true } = {}) {
    const keys = RB_RESTORED;
    const list = (o = open) => `<details class="rb-restored"${o ? ' open' : ''}><summary><span class="rb-chev">${icon('chev-r')}</span>Show restored windows</summary>
      <ul>${keys.map(k => `<li><span class="rb-title">${esc(WINDOWS[k].name)}</span><span class="win-meta">${WINDOWS[k].tabs.length} tabs</span></li>`).join('')}</ul></details>`;
    if (!missing) {
      return `<div class="rb rb-ok"><div class="rb-head"><span class="rb-icon">${circleCheck}</span><span class="rb-title-main">${keys.length} windows restored from your last session</span><button class="btn sm quiet rb-dismiss">Dismiss</button></div>${list()}</div>`;
    }
    const row = (w, i) => `<div class="rb-window" data-rb="${i}">
        <span class="fav-strip">${w.favs.map(fav).join('')}</span>
        <span class="rb-wtxt"><b>${w.ai ? `<span class="rb-ai" title="AI title">${icon('sparkle')}</span>` : ''}${esc(w.name)}</b>${w.intent ? `<i>${esc(w.intent)}</i>` : ''}<span>${w.count} tabs · ${esc(w.seen)}</span></span>
        <span class="rb-acts"><button class="btn sm" data-rb-act="restore">Restore this window</button><button class="btn sm" data-rb-act="hide" title="${HIDE_TIP[w.to]}">Hide</button><button class="icon-btn" title="More">${icon('more')}</button></span>
        <span class="rb-done">Restored</span>
      </div>`;
    let n = 0;
    const named = RB_MISSING.named.map(w => row(w, n++)).join('');
    const other = RB_MISSING.other.map(w => row(w, n++)).join('');
    return `<div class="rb rb-missing rb-groups">
      <div class="rb-head"><span class="rb-icon">${icon('history')}</span><span class="rb-title-main" data-rb-title></span><button class="btn sm quiet rb-dismiss">Dismiss</button></div>
      ${list(false)}
      <div class="rb-missing-head"><button class="btn sm" data-rb-act="all">Restore all</button></div>
      <div class="rb-group"><div class="rb-group-head">Named windows</div><div class="rb-group-list">${named}</div></div>
      <details class="rb-group rb-other"><summary class="rb-group-head"><span class="rb-chev">${icon('chev-r')}</span><span>Other windows (<span data-rb-other>${RB_MISSING.other.length}</span>)</span></summary><div class="rb-group-list">${other}</div></details>
      <div class="toast" data-toast></div>
    </div>`;
  }
  // Restore, Hide and Restore all work in the mockup, with the popup's words.
  function wireBanner(el) {
    const rb = el.querySelector('.rb-groups');
    if (!rb) return;
    const all = [...RB_MISSING.named, ...RB_MISSING.other];
    const restored = new Set(), hidden = new Set();
    const title = () => {
      const left = all.length - restored.size - hidden.size, back = RB_RESTORED.length + restored.size;
      rb.querySelector('[data-rb-title]').innerHTML = (left ? `${back} windows restored · ${left} still missing` : `${back} windows restored from your last session`) + ` · <span class="rb-when">${LAUNCHED}</span>`;
      rb.querySelector('[data-rb-other]').textContent = RB_MISSING.other.filter((_, i) => !hidden.has(RB_MISSING.named.length + i)).length;
      rb.querySelector('.rb-missing-head').hidden = left < 2;
    };
    let timer;
    const toast = msg => {
      const t = rb.querySelector('[data-toast]');
      t.innerHTML = msg; t.classList.add('show');
      clearTimeout(timer); timer = setTimeout(() => t.classList.remove('show'), 2400);
    };
    const restore = i => { restored.add(i); rb.querySelector(`[data-rb="${i}"]`).classList.add('is-done'); };
    rb.addEventListener('click', e => {
      const b = e.target.closest('[data-rb-act]');
      if (!b) return;
      const act = b.dataset.rbAct;
      if (act === 'undo') {
        const row = rb.querySelector(`[data-rb="${b.dataset.i}"]`);
        hidden.delete(+b.dataset.i); row.classList.remove('is-gone');
        rb.querySelector('[data-toast]').classList.remove('show');
        if (!e.detail) row.querySelector('[data-rb-act="hide"]').focus();
      } else if (act === 'all') all.forEach((_, i) => { if (!restored.has(i) && !hidden.has(i)) restore(i); });
      else {
        const i = +b.closest('[data-rb]').dataset.rb;
        if (act === 'restore') restore(i);
        else {
          hidden.add(i); rb.querySelector(`[data-rb="${i}"]`).classList.add('is-gone');
          toast(`${all[i].to === 'saved' ? 'Hidden. It stays in Saved Windows.' : 'Moved to the Closed page.'} <button type="button" class="toast-undo" data-rb-act="undo" data-i="${i}">Undo</button>`);
          // From the keyboard the focus goes to Undo, as on the popup's banner (#338).
          if (!e.detail) rb.querySelector('.toast-undo').focus();
        }
      }
      title();
    });
    title();
  }

  // The tab right-click menu, and its Label submenu.
  const mi = (ic, label, o = {}) => `<div class="menu-item${o.hot ? ' hot' : ''}${o.danger ? ' danger' : ''}${o.on ? ' on' : ''}">${ic ? (ic.startsWith('<') ? ic : icon(ic)) : '<span class="mi-pad"></span>'}<span class="mi-l">${label}</span>${o.hint ? `<span class="hint">${o.hint}</span>` : ''}${o.check ? `<span class="check">${icon('check')}</span>` : ''}${o.sub ? `<span class="hint">${icon('chev-r')}</span>` : ''}</div>`;
  const msep = '<div class="menu-sep"></div>';
  // Items and order follow #tab-context-menu in popup.html.
  const ctxItems = (hot = '') => `${mi('pin', 'Pin')}${mi('edit', 'Add nickname')}${mi('clock', 'Save For Later', { sub: 1 })}${mi('note', 'Add Note')}
    ${mi('label', 'Label', { sub: 1, hot: hot === 'label' })}${mi('flag', 'Set Priority', { sub: 1 })}${msep}
    ${mi('copy', 'Copy', { sub: 1 })}${mi('move', 'Move to Window', { sub: 1 })}${mi('lock', 'Lock Tab', { hint: 'Never park' })}${msep}
    ${mi('history', 'Remove from History')}${mi('x', 'Close Tab', { danger: 1 })}`;
  // Like showLabelSubmenu() in context-menu.js: labels with a check, then Remove all.
  const labelItems = () => `${mi(`<span class="mdot" style="--c:${LABELS.Research}"></span>`, 'Research', { check: 1, on: 1 })}
    ${mi(`<span class="mdot" style="--c:${LABELS.Design}"></span>`, 'Design')}
    ${mi(`<span class="mdot" style="--c:${LABELS.Work}"></span>`, 'Work')}${msep}${mi('x', 'Remove all labels')}`;
  // The window ⋮ menu (views/windows.js).
  const winMenuItems = () => `${mi('edit', 'Rename')}${mi('popout', 'Focus window')}${mi('lock', 'Lock all tabs')}${mi('bookmark', 'Save window')}${msep}
    ${mi('pin', 'Anchor Window')}${mi('sparkle', 'Generate AI Title')}${msep}${mi('archive', 'Save & Close Window')}${mi('x', 'Close window', { danger: 1 })}`;

  /* ---------- Design option cards (Settings -> Design) ---------- */
  const OPTIONS = {
    theme: [['light', 'Light', 'Bright and neutral'], ['dark', 'Dark', 'Easy on the eyes at night']],
    wstyle: [['tint', 'Tint', 'Light wash of color'], ['stripe', 'Stripe', 'Thin colored edge'], ['plain', 'Dot', 'Color dot only']],
    density: [['compact', 'Compact', 'Fits more tabs'], ['comfortable', 'Comfortable', 'Roomier rows']],
  };
  function mini(a) {
    const wins = (a.density === 'compact' ? [['#8b5cf6', 4], ['#0ea5e9', 3]] : [['#8b5cf6', 3], ['#0ea5e9', 2]])
      .map(([c, n]) => `<span class="m-win" style="--wc:${c}"><span class="m-head"><i class="m-dot"></i><i class="m-title"></i></span>${'<i class="m-row"></i>'.repeat(n)}</span>`).join('');
    return `<span class="mini" data-t="${a.theme}" data-ws="${a.wstyle}" data-dn="${a.density}" aria-hidden="true">
      <span class="m-side"><i class="m-logo"></i><i class="m-nav on"></i><i class="m-nav"></i><i class="m-nav"></i><i class="m-nav"></i></span>
      <span class="m-main"><i class="m-search"></i>${wins}</span></span>`;
  }
  function rowsMini(a, density) {
    const favs = ['#ea4335', '#24292f', '#d97757', '#4285f4', '#9146ff', '#10a37f', '#0acf83', '#635bff'];
    const widths = [62, 48, 70, 55, 40, 66, 52, 58];
    return `<span class="mini rows-mini" data-t="${a.theme}" data-dn="${density}" aria-hidden="true"><span class="rm-card">
      ${favs.map((c, i) => `<span class="rm-row"><i class="rm-fav" style="background:${c}"></i><i class="rm-title" style="width:${widths[i]}%"></i></span>`).join('')}</span></span>`;
  }
  function optionCards(key, a) {
    return OPTIONS[key].map(([value, label, desc]) => {
      const preview = key === 'density' ? rowsMini(a, value) : mini({ ...a, [key]: value });
      return `<button type="button" class="opt" data-opt="${key}" data-value="${value}" aria-pressed="${a[key] === value}">
        ${preview}<span class="opt-l"><b>${label}</b><span>${desc}</span></span><span class="opt-check">${icon('check')}</span></button>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
     The whole popup
     ------------------------------------------------------------------ */
  const NAV = [
    ['tabs', 'grid', 'Tabs', 20], null,
    ['saved', 'bookmark', 'Saved Windows'], ['closed', 'history', 'Closed'], ['last-session', 'restore', 'Last session'], null,
    ['autoparked', 'park', 'AutoParked', 9], ['cloud', 'cloud', 'Cloud Sync'],
  ];
  const NAV_BOTTOM = [['help', 'help', 'Help'], ['settings', 'gear', 'Settings'], ['account', 'user', 'Account']];
  const SETTINGS_NAV = [
    ['design', 'palette', 'Design', 'Choose how TabSidecar looks. Changes apply right away.'],
    ['autopark', 'park', 'Auto-Park', 'Free memory by parking tabs you haven’t used.'],
    ['ai', 'sparkle', 'Artificial Intelligence', 'Quick access to your AI chats.'],
    ['swo', 'wand', 'Smart Window Organizer', 'Keep windows tidy with URL-based rules.'],
    ['filters', 'filter', 'Filters', 'Narrow the tab list to sites or categories.'],
    ['labels', 'label', 'Labels', 'Categories you can tag tabs with.'],
    ['backup', 'archive', 'Backup and Restore', 'Keep a copy of your windows and settings.'],
  ];

  function sidebar(s) {
    const item = n => n ? `<button class="nav-item" data-go="${n[0]}"${s.page === n[0] ? ' aria-current="page"' : ''}>${icon(n[1])}<span class="label">${n[2]}</span>${n[3] ? `<span class="count">${n[3]}</span>` : ''}${n[0] === 'account' ? '<span class="dot-ok"></span>' : ''}</button>` : '<div class="nav-sep"></div>';
    return `<aside class="sidebar"><div class="brand"><div class="logo">TS</div><span>TabSidecar</span></div>
      <nav class="nav">${NAV.map(item).join('')}</nav>
      <nav class="nav nav-bottom">${NAV_BOTTOM.map(item).join('')}<button class="nav-item">${icon('collapse')}<span class="label">Collapse</span></button></nav></aside>`;
  }
  const topbar = (title, ph) => `<header class="topbar"><h1>${title}</h1>${ph ? `<div class="search">${icon('search')}<span class="q ph">${ph}</span><kbd>/</kbd></div>` : '<div style="flex:1"></div>'}</header>`;

  function settingsBody(s) {
    const tab = s.stab;
    const body = {
      // Rows and wording follow the real Settings pages (settings.js, design.js).
      design: () => [
        `<section class="set-group"><h3>Theme</h3><div class="opt-grid">${optionCards('theme', s)}</div></section>`,
        `<section class="set-group"><h3>Window color</h3><div class="opt-grid">${optionCards('wstyle', s)}</div></section>`,
        `<section class="set-group"><h3>Density</h3><div class="opt-grid">${optionCards('density', s)}</div></section>`],
      autopark: () => [
        sgroup('', [srow('Next check', 'AutoPark looks for inactive tabs on a schedule.', '<span class="sub-meta">in 29m 43s</span>'),
          srow('AutoPark inactive tabs', 'Close tabs you haven’t used in a while to free memory. Parked tabs reopen instantly.', sw(true)),
          srow('Park after (hours)', 'Tabs you haven’t used for this long are parked.', input('6')),
          srow('Keep open', 'Always keep at least this many tabs open.', input('5')),
          srow('Count tabs', 'Browser-wide uses one count for all windows. Window-wide counts each window on its own.', select('Browser-wide'))]),
        sgroup('Never park', [srow('Locked tabs', 'Right-click a tab → Lock Tab.', sw(true)), srow('Pinned tabs', '', sw(true)), srow('Tabs playing audio', '', sw(true))])],
      ai: () => [sgroup('', [srow('AI tagging', 'Suggest labels for your tabs.', sw(false)),
          srow('AI window titles', 'Name windows automatically from the tabs they hold.', sw(true))])],
      swo: () => [sgroup('', [srow('Smart Window Organizer', 'Automatically move or close tabs that match your filters.', sw(true))]),
        sgroup('How it works', [srow('Checked on every change', 'Tabs are matched against your filters when their URL or title changes.', ''),
          srow('Move', 'Filters with a Move action send matching tabs to a window named after the filter.', ''),
          srow('Close', 'Filters with a Close action close matching tabs automatically.', ''),
          `<div class="set-row"><button class="btn sm">${icon('filter')}Manage filters</button></div>`])],
      filters: () => [sgroup('', [rulesRows(), `<div class="rule"><button class="btn sm">${icon('plus')}Add filter</button></div>`])],
      labels: () => [sgroup('', [labelRow('Research', LABELS.Research, '2 sub-labels'), labelRow('Papers', LABELS.Research, '', true), labelRow('Travel', LABELS.Research, '', true),
        labelRow('Design', LABELS.Design, '0 sub-labels'), labelRow('Work', LABELS.Work, '1 sub-label'), labelRow('Launch', LABELS.Work, '', true)])],
      backup: () => [sgroup('', [srow('Automatic backups', 'Save a backup to Downloads/tabsidecar on a schedule, using the content and formats below.', sw(true)),
          srow('Back up when Chrome starts', 'Right after session recovery finishes. Needs automatic backups.', sw(true)),
          srow('Schedule', '', select('Fixed interval')), srow('Every', '', select('Daily'))]),
        sgroup('Manual', [srow('Back up now', 'Saves the content below to a file.', '<button class="btn sm primary">Back up now</button>'),
          srow('Restore from a file', 'Choose what to bring back from a JSON or ZIP backup.', `<button class="btn sm">${icon('upload')}Restore</button>`)])],
    }[tab]();
    const [, , title, desc] = SETTINGS_NAV.find(n => n[0] === tab);
    return `<div class="set-layout"><nav class="set-nav">${SETTINGS_NAV.map(([k, ic, t]) => `<button data-stab="${k}" aria-current="${k === tab}">${icon(ic)}${t}</button>`).join('')}<span class="set-version">v0.7.66 <span class="tag">Beta</span></span></nav>
      <div class="set-body"><h2>${title}</h2><p>${desc}</p>${body.join('')}</div></div>`;
  }
  // Filters, as the Filters page lists them. A Move or Close action is what
  // makes a filter a Smart Window Organizer rule.
  const rulesRows = () => [
    `<div class="rule"><span class="txt"><b>Work</b><div>URL includes any of github.com, linear.app, figma.com</div></span><span class="tag">Moves</span><button class="icon-btn" title="Edit">${icon('edit')}</button><button class="icon-btn" title="Delete">${icon('trash')}</button></div>`,
    `<div class="rule"><span class="txt"><b>AI</b><div>URL includes any of claude.ai, chatgpt.com, gemini.google.com</div></span><span class="tag">Moves</span><button class="icon-btn" title="Edit">${icon('edit')}</button><button class="icon-btn" title="Delete">${icon('trash')}</button></div>`,
    `<div class="rule"><span class="txt"><b>Zoom leftovers</b><div>URL includes any of zoom.us/j/</div></span><span class="tag">Closes</span><button class="icon-btn" title="Edit">${icon('edit')}</button><button class="icon-btn" title="Delete">${icon('trash')}</button></div>`,
  ].join('');
  const input = v => `<span class="input">${esc(v)}</span>`;
  const labelRow = (name, color, sub, child = false) => `<div class="rule${child ? ' sub' : ''}"><span class="mdot" style="--c:${color}"></span><span class="txt"><b>${esc(name)}</b>${sub ? `<div>${sub}</div>` : ''}</span>
    ${child ? '' : `<button class="icon-btn" title="Add sub-label">${icon('plus')}</button>`}<button class="icon-btn" title="Rename">${icon('edit')}</button><button class="icon-btn" title="Delete">${icon('trash')}</button></div>`;

  // Saved-only windows for the longer Saved Windows list on the home page.
  // They never appear in the popup's tab list, so only favicons are needed.
  const SAVED_EXTRA = {
    q4: { name: 'Q4 planning', color: C.indigo, tabs: [fv('S', '#0f9d58'), fv('N', '#191919'), fv('F', '#f24e1e'), fv('L', '#5e6ad2'), fv('S', '#4a154b'), fv('D', '#4285f4'), fv('G', '#24292f'), fv('M', '#ea4335'), fv('C', '#d97757')] },
    trip: { name: 'Trip to Lisbon', color: C.amber, tabs: [fv('G', '#4285f4'), fv('B', '#003580'), fv('A', '#ff5a5f'), fv('M', '#34a853'), fv('T', '#e4002b'), fv('W', '#3366cc')] },
    jobs: { name: 'Job search', color: C.blue, tabs: [fv('in', '#0a66c2'), fv('G', '#3ab549'), fv('D', '#4285f4'), fv('M', '#ea4335'), fv('W', '#1b1f23')] },
    recipes: { name: 'Weekend recipes', color: C.pink, tabs: [fv('N', '#111111'), fv('S', '#d52b1e'), fv('▶', '#ff0000')] },
  };

  const windowOf = key => WINDOWS[key] || SAVED_EXTRA[key] || MOVED_TO_CLOSED[key];

  function windowList(kind) {
    const rows = kind === 'saved' ? [['launch', 'Opened 2d ago'], ['daily', 'Opened today']]
      : kind === 'savedMany' ? [['daily', 'Opened today'], ['launch', 'Opened 2d ago'], ['q4', 'Opened 3d ago'], ['trip', 'Opened last week'], ['jobs', 'Opened Sep 18'], ['recipes', 'Opened Sep 14']]
      : [['kitchen', 'Closed 1h ago'], ['home', 'Closed 2h ago'], ['reading', 'Closed yesterday']];
    kind = kind === 'savedMany' ? 'saved' : kind;
    return rows.map(([k, when]) => {
      const w = windowOf(k);
      return `<article class="win" style="--wc:${w.color}" data-win="${k}"><div class="win-head"><span class="wdot" style="margin-left:6px"></span><span class="win-title">${esc(w.name)}</span>
        <span class="win-meta">${w.tabs.length} tabs · ${when}</span>${favStrip(w.tabs)}
        <span class="win-actions"><button class="btn sm">${icon(kind === 'saved' ? 'popout' : 'restore')}${kind === 'saved' ? 'Open' : 'Restore'}</button></span></div></article>`;
    }).join('');
  }

  // Markup follows rowHtml() and groupsHtml() in last-session.js.
  function lastSessionRow(w) {
    const restore = w.status === 'missing' || w.status === 'moved-to-closed' ? `<button class="btn sm" title="${LS_RESTORE_TIP}">Restore</button>` : '';
    const hide = w.status === 'missing' ? `<button class="btn sm" title="${HIDE_TIP[w.to]}">Hide</button>` : '';
    return `<div class="ls-row"><span class="fav-strip">${w.favs.slice(0, 3).map(fav).join('')}</span>
      <span class="ls-text"><span class="ls-title">${esc(w.name)}</span>${w.intent ? `<span class="ls-intent">${esc(w.intent)}</span>` : ''}</span>
      <span class="sub-meta">${w.count} tabs</span><span class="ls-status" data-status="${w.status}">${LS_STATUS[w.status]}</span>
      ${restore || hide ? `<span class="ls-actions">${restore}${hide}</span>` : ''}</div>`;
  }
  const lastSessionGroups = () => [['Named windows', LAST_SESSION.named], ['Other windows', LAST_SESSION.other]]
    .map(([heading, list]) => `<div class="card"><div class="card-head"><h3>${heading}</h3><span class="sub-meta">${list.length}</span></div><div class="rows">${list.map(lastSessionRow).join('')}</div></div>`).join('');

  // A window card's title wins the room (#504). Where it would be cut, the
  // meta goes first, then the plain tags (Saved, locks, AI; never Current or
  // Anchored), then the favicons one at a time, then the whole strip.
  // Measured on the card itself, so it holds wherever the card sits.
  function fitWindowHead(card) {
    const tabs = windowOf(card.dataset.win).tabs;
    const title = card.querySelector('.win-title');
    const meta = card.querySelector('.win-meta');
    const plainTags = [...card.querySelectorAll('.win-head .tag:not(.brand):not(.anchor)')];
    const hasStrip = !!card.querySelector('.win-head .fav-strip');
    const cut = () => title.scrollWidth > title.clientWidth;
    const showFavs = n => {
      card.querySelector('.win-head .fav-strip').outerHTML = favStrip(tabs, n);
      card.querySelector('.win-head .fav-strip').hidden = n === 0;
    };
    meta.hidden = false;
    plainTags.forEach(tag => { tag.hidden = false; });
    if (hasStrip) showFavs(FAV_MAX);
    if (!cut()) return;
    meta.hidden = true;
    if (!cut()) return;
    plainTags.forEach(tag => { tag.hidden = true; });
    if (!hasStrip) return;
    for (let n = FAV_MAX - 1; n >= 0 && cut(); n--) showFavs(n);
  }
  const fitWindowHeads = cards => cards.forEach(card => new ResizeObserver(() => fitWindowHead(card)).observe(card));

  function mainHTML(s) {
    switch (s.page) {
      case 'tabs': return topbar('Tabs', 'Search tabs') + `
        <div class="toolbar">
          <span class="chip">${icon('windows')}Windows${icon('chev')}</span><span class="chip">${icon('sort')}Tab order${icon('chev')}</span><span class="chip">${icon('filter')}Filter${icon('chev')}</span>
          <span class="tool-sep"></span><button class="icon-btn" title="Collapse all">${icon('collapse-all')}</button><button class="icon-btn" title="Expand all">${icon('expand-all')}</button>
          <button class="icon-btn" title="Show pinned tabs" aria-pressed="false" data-press>${icon('pin')}</button><button class="icon-btn" title="Show labels" aria-pressed="true" data-press>${icon('label')}</button>
          <span class="stats"><span><b data-parkcount>9</b> parked</span></span></div>
        <div class="list">${winCard('launch', { closed: folded(s, 'launch') })}${winCard('reading', { closed: folded(s, 'reading') })}${winCard('home', { closed: folded(s, 'home') })}</div>
        <button class="fab">${icon('chat')}Chats</button>`;
      case 'saved': return topbar('Saved Windows', 'Search saved windows') + `<p class="subtitle">Reusable windows you saved for later. Opening one keeps it saved.</p><div class="list">${windowList('saved')}</div>`;
      case 'closed': return topbar('Closed', 'Search closed windows') + `<p class="subtitle">Windows you recently closed, ready to restore.</p><div class="list"><div class="group-label">Today</div>${windowList('closed')}</div>`;
      case 'last-session': return topbar('Last session') + `<p class="subtitle">Every window your last session had open, and whether it came back.<span class="subtitle-count"> ${LAUNCHED}.</span></p><div class="list">${lastSessionGroups()}</div>`;
      case 'autoparked': return topbar('AutoParked', 'Search parked tabs') + `<p class="subtitle">Tabs closed automatically after 6h of inactivity. Nothing is lost.</p>
        <div class="list">${statGrid()}
          <div class="card"><div class="card-head"><h3>Tabs parked over time</h3><span class="r">${seg(['7 days', '14 days', '30 days'], '7 days')}</span></div>
            <div class="card-body">${bars(DAYS7, DAYS7.length - 1)}<div class="axis"><span>Sep 16</span><span>Sep 19</span><span>Today</span></div></div></div>
          ${parkedCard()}</div>`;
      case 'cloud': return topbar('Cloud Sync') + `<p class="subtitle">Sync your windows and restore them on another machine.</p><div class="list">
          <div class="card"><div class="card-head"><h3>This device</h3><span class="r"><span class="status">Synced 2 min ago</span><button class="btn sm primary">${icon('refresh')}Sync now</button></span></div>
            <div class="card-body" style="color:var(--muted);font-size:12.5px">This PC · Chrome on Windows · 4 windows · 20 tabs</div></div>
          <div class="card">${srow('Automatic sync', 'Send a cloud snapshot on a recurring schedule.', sw(true))}${srow('Interval', 'Next sync in 48 min', select('Every 3 hours'))}</div>
          <div class="group-label">Latest snapshots</div>
          <div class="card"><div class="link-row"><span class="ico">${icon('laptop')}</span><span class="txt"><b>Work laptop</b><span>3 windows · 17 tabs · Today 9:40 AM</span></span><button class="btn sm">${icon('download')}Import</button></div>
            <div class="link-row"><span class="ico">${icon('monitor')}</span><span class="txt"><b>This PC</b><span>4 windows · 20 tabs · 2 min ago</span></span><button class="btn sm">${icon('download')}Import</button></div></div></div>`;
      case 'help': case 'account': return topbar(s.page === 'help' ? 'Help' : 'Account') + `<p class="subtitle">Quick access to setup, shortcuts, and support.</p><div class="list"><div class="card">
          ${[['play', 'Onboarding', 'Replay the product walkthrough.'], ['keyboard', 'Keyboard Shortcuts', 'See the browser shortcut bindings.'], ['mail', 'Email Support', 'Send a bug report, feature request, or question.'], ['bulb', 'Feature Request', 'Share an idea or workflow you want supported.']]
            .map(([ic, t, d]) => `<div class="link-row"><span class="ico">${icon(ic)}</span><span class="txt"><b>${t}</b><span>${d}</span></span>${icon('chev-r')}</div>`).join('')}</div></div>`;
      case 'settings': return topbar('Settings') + `<div class="list flush" style="border-top:1px solid var(--border)">${settingsBody(s)}</div>`;
    }
    return '';
  }

  // The phone-sized popup (#506): the Tabs page alone at its real size, with
  // the toolbar's first chip and the parked count, and only Launch week open.
  const phoneHTML = s => topbar('Tabs', 'Search tabs') + `
    <div class="toolbar"><span class="chip">${icon('windows')}Windows${icon('chev')}</span><span class="stats"><span><b data-parkcount>9</b> parked</span></span></div>
    <div class="list">${['launch', 'reading', 'home'].map(key => winCard(key, { closed: folded(s, key) })).join('')}</div>`;

  // Which windows start folded: Home in the full popup; Reading list too in
  // the phone-sized one. A window the visitor has opened or folded since is
  // in s.open or s.closed (never both), and keeps that in either size.
  const STARTS_FOLDED = { full: ['home'], phone: ['reading', 'home'] };
  const folded = (s, key) => {
    if (s.open.has(key)) return false;
    if (s.closed.has(key)) return true;
    return STARTS_FOLDED[s.phone ? 'phone' : 'full'].includes(key);
  };

  function renderPopup(el) {
    const s = el._ts;
    el.dataset.theme = s.theme; el.dataset.wstyle = s.wstyle; el.dataset.density = s.density;
    el.classList.toggle('pop-phone', s.phone);
    const body = s.phone ? `<section class="main">${phoneHTML(s)}</section>` : sidebar(s) + `<section class="main">${mainHTML(s)}</section>`;
    el.innerHTML = body + `<div class="ts menu" data-ctx hidden></div><div class="toast" data-toast></div>`;
    if (s.phone) fitWindowHeads(el.querySelectorAll('.win'));
    document.querySelectorAll(`[data-target="#${el.id}"][data-mock="options"]`).forEach(renderOptions);
  }

  function mountPopup(el) {
    el.classList.add('ts', 'pop');
    el._ts = {
      page: el.dataset.page || 'tabs', stab: el.dataset.stab || 'design',
      theme: el.dataset.theme || document.documentElement.dataset.theme || 'light', wstyle: el.dataset.wstyle || 'tint', density: el.dataset.density || 'comfortable',
      closed: new Set(), open: new Set(), phone: false,
    };
    renderPopup(el);
    el.addEventListener('click', e => {
      const s = el._ts;
      const go = e.target.closest('[data-go]');
      if (go) { s.page = go.dataset.go === 'account' ? 'cloud' : go.dataset.go; return renderPopup(el); }
      const st = e.target.closest('[data-stab]');
      if (st) { s.stab = st.dataset.stab; return renderPopup(el); }
      const opt = e.target.closest('.opt');
      if (opt) { s[opt.dataset.opt] = opt.dataset.value; return renderPopup(el); }
      const caret = e.target.closest('[data-caret]');
      if (caret) {
        const key = caret.closest('.win').dataset.win;
        const fold = !folded(s, key);
        (fold ? s.open : s.closed).delete(key);
        (fold ? s.closed : s.open).add(key);
        caret.closest('.win').classList.toggle('closed', fold);
        return;
      }
      const more = e.target.closest('[data-more]');
      if (more) { e.stopPropagation(); return openCtx(el, more.closest('.tab'), more.getBoundingClientRect()); }
      const winBtn = e.target.closest('[data-winmenu]');
      if (winBtn) return openWinMenu(el, winBtn);
      const press = e.target.closest('[data-press]');
      if (press) return press.setAttribute('aria-pressed', press.getAttribute('aria-pressed') !== 'true');
      toggleControls(e);
      closeCtx(el);
    });
    // Window ⋮ menus open on hover, like the popup (hover-menu.js).
    // They close 200ms after the pointer leaves both the button and the menu.
    let leaveTimer;
    el.addEventListener('mouseover', e => {
      const winBtn = e.target.closest('[data-winmenu]');
      if (winBtn || e.target.closest('[data-ctx]')) clearTimeout(leaveTimer);
      if (winBtn && winBtn.getAttribute('aria-expanded') !== 'true') openWinMenu(el, winBtn);
      else if (!winBtn && !e.target.closest('[data-ctx]') && el.querySelector('[data-winmenu][aria-expanded="true"]')) {
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => closeCtx(el), 200);
      }
    });
    el.addEventListener('contextmenu', e => {
      const row = e.target.closest('.tab');
      if (!row) return;
      e.preventDefault();
      openCtx(el, row, { left: e.clientX, top: e.clientY, bottom: e.clientY, right: e.clientX });
    });
    el.addEventListener('mouseleave', () => closeCtx(el));
  }
  // The popup's size in its own (unzoomed) pixels: 752 x 600, or the
  // phone-sized one's, which isn't zoomed.
  const popSize = el => (el._ts.phone ? { w: el.clientWidth, h: el.clientHeight } : { w: 752, h: 600 });
  // Right-click menu inside a live popup. Positions are in the popup's own
  // (unzoomed) pixels.
  function openCtx(el, row, r) {
    closeCtx(el);
    const menu = el.querySelector('[data-ctx]');
    menu.innerHTML = ctxItems();
    menu.hidden = false;
    const z = parseFloat(el.style.zoom) || 1, p = el.getBoundingClientRect(), { w, h } = popSize(el);
    const x = (r.left - p.left) / z, y = (r.bottom - p.top) / z;
    const left = Math.min(x, w - menu.offsetWidth - 8), top = y + menu.offsetHeight > h - 8 ? Math.max(8, (r.top - p.top) / z - menu.offsetHeight) : y + 2;
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
    row.classList.add('ctx-open');
  }
  function openWinMenu(el, btn) {
    closeCtx(el);
    const menu = el.querySelector('[data-ctx]');
    menu.innerHTML = winMenuItems();
    menu.hidden = false;
    const z = parseFloat(el.style.zoom) || 1, p = el.getBoundingClientRect(), r = btn.getBoundingClientRect(), { h } = popSize(el);
    menu.style.left = Math.max(8, (r.right - p.left) / z - menu.offsetWidth) + 'px';
    menu.style.top = Math.max(8, Math.min((r.bottom - p.top) / z + 4, h - 8 - menu.offsetHeight)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    btn.closest('.win')?.classList.add('menu-open');
  }
  function closeCtx(el) {
    const menu = el.querySelector('[data-ctx]');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      el.querySelectorAll('.ctx-open').forEach(x => x.classList.remove('ctx-open'));
      el.querySelectorAll('.menu-open').forEach(x => x.classList.remove('menu-open'));
      el.querySelectorAll('[data-winmenu][aria-expanded]').forEach(x => x.removeAttribute('aria-expanded'));
    }
  }

  // Switches and segmented controls flip wherever they are.
  function toggleControls(e) {
    const s = e.target.closest('.switch');
    if (s) { s.setAttribute('aria-checked', s.getAttribute('aria-checked') !== 'true'); s.dispatchEvent(new CustomEvent('ts-switch', { bubbles: true })); return true; }
    const b = e.target.closest('.seg button');
    if (b) { b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); return true; }
    return false;
  }

  /* ------------------------------------------------------------------
     Fit a 752px popup into narrower containers. Scaled under
     FULL_POPUP_MIN_ZOOM, its smallest labels (10.5px) would draw under the
     site's 9px minimum, so a box that narrow gets the phone-sized popup
     instead, unscaled (#506).
     ------------------------------------------------------------------ */
  const FULL_POPUP_MIN_ZOOM = 0.86;
  function fit(box) {
    const pop = box.querySelector('.pop');
    if (!pop) return;
    const max = parseFloat(box.dataset.max || '1');
    const apply = () => {
      const z = Math.min(max, box.clientWidth / 752);
      const phone = box.clientWidth / 752 < FULL_POPUP_MIN_ZOOM;
      if (phone !== pop._ts.phone) { pop._ts.phone = phone; renderPopup(pop); }
      pop.style.zoom = phone ? '' : z.toFixed(4);
    };
    new ResizeObserver(apply).observe(box);
    apply();
  }

  /* ------------------------------------------------------------------
     Smaller mockups
     ------------------------------------------------------------------ */
  function renderOptions(el) {
    const target = document.querySelector(el.dataset.target);
    const a = target?._ts || { theme: el.dataset.theme || 'light', wstyle: 'tint', density: 'comfortable' };
    el.classList.add('ts', 'opt-grid');
    el.innerHTML = optionCards(el.dataset.key, a);
  }
  function mountOptions(el) {
    renderOptions(el);
    el.addEventListener('click', e => {
      const opt = e.target.closest('.opt');
      const target = document.querySelector(el.dataset.target);
      if (!opt || !target?._ts) return;
      target._ts[opt.dataset.opt] = opt.dataset.value;
      if (target._ts.page !== 'tabs' && el.dataset.show !== 'stay') target._ts.page = 'tabs';
      renderPopup(target);
    });
  }

  // A window where one tab reaches the Auto-Park limit and parks itself.
  function mountAutopark(el) {
    el.classList.add('ts', 'ap-demo');
    const draw = () => {
      el.innerHTML = `${winCard('reading', { cls: 'ap-win' })}
        <div class="card ap-parked"><div class="card-head"><span class="ap-ico">${icon('park')}</span><h3>AutoParked</h3><span class="win-meta" data-count>5 tabs</span>
          <span class="r"><button class="btn sm quiet">Reopen all</button></span></div>
          <div class="rows" data-parked>${PARKED.slice(0, 3).map(p => parkedRow(p)).join('')}</div></div>
        <div class="toast" data-toast></div>`;
    };
    draw();
    let running = false;
    const play = async () => {
      if (running) return; running = true;
      draw();
      if (!reduced) await sleep(1400);
      const row = el.querySelector('.tab[data-key^="Best budget"]');
      const t = WINDOWS.reading.tabs.find(x => x.soon);
      row.classList.add('leaving');
      const list = el.querySelector('[data-parked]');
      list.insertAdjacentHTML('afterbegin', parkedRow({ ...t, when: 'Just now' }, ' arriving'));
      list.lastElementChild.remove();
      el.querySelector('[data-count]').textContent = '6 tabs';
      el.querySelector('.ap-win .win-meta').textContent = '4 tabs';
      const toast = el.querySelector('[data-toast]');
      toast.innerHTML = `Parked “Best budget travel cameras” <b>Reopen</b>`;
      toast.classList.add('show');
      await sleep(2600);
      toast.classList.remove('show');
      running = false;
    };
    el._play = play;
    onVisible(el, play);
    el.closest('[data-demo]')?.querySelector('[data-replay]')?.addEventListener('click', play);
  }

  // Search that filters every window as you type. Types a query by itself the
  // first time it scrolls into view.
  function mountSearch(el) {
    el.classList.add('ts', 'search-demo');
    const all = ['launch', 'reading', 'home'].flatMap(k => WINDOWS[k].tabs.map(t => ({ t, w: WINDOWS[k] })));
    el.innerHTML = `<label class="search focus">${icon('search')}<input type="search" placeholder="Search tabs" autocomplete="off" aria-label="Search the example tabs"><kbd>/</kbd></label>
      <div class="sd-meta"></div><article class="win neutral"><div class="tabs sd-rows"></div></article>`;
    const input = el.querySelector('input'), rows = el.querySelector('.sd-rows'), meta = el.querySelector('.sd-meta');
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const hits = all.filter(({ t }) => !q || `${t.t} ${t.u} ${t.nick || ''} ${(t.lbl || []).join(' ')}`.toLowerCase().includes(q));
      const wins = new Set(hits.map(h => h.w.name)).size;
      meta.innerHTML = q ? `<b>${hits.length}</b> ${hits.length === 1 ? 'tab' : 'tabs'} in <b>${wins}</b> ${wins === 1 ? 'window' : 'windows'}` : `<b>${all.length}</b> tabs in <b>3</b> windows`;
      rows.innerHTML = hits.slice(0, 6).map(({ t, w }) => tabRow({ ...t, active: false }, w, { showWin: true, mark: q })).join('')
        || `<div class="sd-empty">No tabs match “${esc(input.value)}”.</div>`;
    };
    input.addEventListener('input', () => { el._typed = true; draw(); });
    draw();
    onVisible(el, async () => {
      if (reduced) { input.value = 'lisbon'; return draw(); }
      await sleep(500);
      for (const ch of 'lisbon') { if (el._typed) return; input.value += ch; draw(); await sleep(130); }
    });
  }

  // Tab rows with the right-click menu (and Label submenu) open.
  function mountContext(el) {
    el.classList.add('ts', 'ctx-demo');
    el.innerHTML = `${winCard('reading', { rows: [0, 4] })}<div class="menu ctx-main">${ctxItems('label')}</div><div class="menu ctx-sub">${labelItems()}</div>`;
    el.querySelector('.tab[data-key^="Things to do"]').classList.add('ctx-open');
  }

  function mountRestored(el) {
    // data-state="missing" shows the amber banner with windows still to restore.
    el.classList.add('ts', 'restored');
    el.innerHTML = restoredBanner({ missing: el.dataset.state === 'missing', open: el.dataset.open !== 'false' });
    wireBanner(el);
  }

  // data-closed draws the window folded: its header with the favicon strip.
  function mountWindow(el) {
    el.classList.add('ts', 'win-mock');
    const rows = el.dataset.rows ? el.dataset.rows.split('-').map(Number) : undefined;
    el.innerHTML = winCard(el.dataset.win, { rows, name: el.dataset.name, closed: 'closed' in el.dataset });
    fitWindowHeads(el.querySelectorAll('.win'));
    el.addEventListener('click', e => { if (e.target.closest('[data-caret]')) e.target.closest('.win').classList.toggle('closed'); });
  }

  function mountSettings(el) {
    el.classList.add('ts', 'settings-mock');
    const s = { stab: el.dataset.stab || 'autopark', theme: 'light', wstyle: 'tint', density: 'comfortable' };
    const groups = settingsBody(s).match(/<section class="set-group">[\s\S]*<\/section>/);
    el.innerHTML = groups ? groups[0] : '';
    el.addEventListener('click', toggleControls);
  }

  // One small picture per "Everything else" feature, drawn with the same
  // pieces as the popup page that holds it.
  // The Cloud Sync page's This device card (cloud-sync.js renderDashboard).
  const thisDevice = body => `<div class="card"><div class="card-head"><h3>This device</h3><span class="r"><span class="status">Synced 2 min ago</span><button class="btn sm primary">${icon('refresh')}Sync now</button></span></div>
          <div class="card-body" style="color:var(--muted);font-size:12.5px">${body}</div></div>`;
  function featureHTML(key) {
    const s = { stab: 'backup', theme: 'light', wstyle: 'tint', density: 'comfortable' };
    const groups = html => (html.match(/<section class="set-group">[\s\S]*<\/section>/) || [''])[0];
    const list = (title, entries) => `<article class="win neutral"><div class="win-head"><span class="wdot" style="margin-left:6px"></span><span class="win-title">${title}</span><span class="win-meta">${entries.length} tabs</span></div>
      <div class="tabs">${entries.map(([t, w]) => tabRow({ ...t, active: false }, w, { showWin: true })).join('')}</div></article>`;
    const W = WINDOWS;
    switch (key) {
      case 'saved': return windowList('saved');
      case 'savedMany': return windowList('savedMany');
      case 'closed': return `<div class="group-label">Today</div>${windowList('closed')}`;
      case 'notes': return list('Notes and priority', [[W.launch.tabs[1], W.launch], [W.reading.tabs[1], W.reading], [W.home.tabs[1], W.home]])
        + `<div class="f-note">${icon('note')}<span><b>Rust async book — Pinning</b> Re-read before Thursday</span></div>`;
      case 'ai': return list('AI chats', [[W.launch.tabs[4], W.launch],
          [{ t: 'Trip planning', u: 'chatgpt.com/c/68a1', f: 'G', c: '#10a37f', time: '22m', when: '1h ago' }, W.home],
          [{ t: 'Summarize this paper', u: 'gemini.google.com/app/5e2', f: 'G', c: '#1a73e8', time: '9m', when: '3h ago' }, W.reading]])
        + `<div class="f-fab"><span class="fab" style="position:static">${icon('chat')}Chats</span><span class="f-cap" style="margin:0">One click filters the list to these, wherever they are.</span></div>`;
      case 'backups': return groups(settingsBody(s));
      case 'cloud': return `${thisDevice('This PC · Chrome on Windows · 4 windows · 20 tabs')}
        <div class="card"><div class="link-row"><span class="ico">${icon('laptop')}</span><span class="txt"><b>Work laptop</b><span>3 windows · 17 tabs · Today 9:40 AM</span></span><button class="btn sm">${icon('download')}Import</button></div></div>`;
      // Cloud Sync on the home page: This device, then Latest snapshots as the
      // Cloud Sync page lists them (cloud-sync.js renderSnapshots).
      case 'cloudMany': {
        const snaps = [['This PC', 'auto', 4, 20, 'Today 10:00 AM'], ['Work laptop', 'auto', 3, 17, 'Today 9:40 AM'],
          ['Home desktop', 'auto', 5, 26, 'Yesterday 11:02 PM'], ['Home desktop', 'manual', 5, 24, 'Oct 9 9:15 PM']];
        return `${thisDevice('This PC · Chrome on Windows · Automatic sync every hour')}
          <div class="f-snaps-head">Latest snapshots <span>${snaps.length}</span></div>
          <div class="card">${snaps.map(([d, type, w, t, when]) => `<div class="link-row"><span class="ico">${icon('laptop')}</span><span class="txt"><b>${d}</b><span>${type} · ${w} windows · ${t} tabs · ${when}</span></span><button class="btn sm">${icon('download')}Restore</button></div>`).join('')}</div>`;
      }
      case 'keyboard': return `<div class="dialog" style="width:auto;box-shadow:var(--shadow);border-color:var(--border)"><h2>Keyboard Shortcuts</h2><p class="d-desc">In the tab list</p><div class="kbd-list">
          <div><span>Move to next tab</span><kbd>↓</kbd></div><div><span>Move to previous tab</span><kbd>↑</kbd></div><div><span>Switch to selected tab</span><kbd>Enter</kbd></div>
          <div><span>Deselect / close dialog</span><kbd>Esc</kbd></div><div><span>Search tabs</span><kbd>/</kbd></div></div>
          <p class="d-desc" style="margin:14px 0 0">In the browser</p><div class="kbd-list"><div><span>Switch to last used tab</span><kbd>Alt+Shift+Z</kbd></div></div></div>`;
    }
    return '';
  }
  function mountFeature(el) {
    el.classList.add('ts', 'feature-mock');
    el.innerHTML = featureHTML(el.dataset.feature);
    fitWindowHeads(el.querySelectorAll('.win[data-win]'));
    el.addEventListener('click', toggleControls);
  }

  function mountRules(el) {
    el.classList.add('ts', 'card');
    el.innerHTML = rulesRows() + `<div class="rule"><button class="btn sm">${icon('plus')}Add filter</button></div>`;
  }

  function mountParked(el) {
    el.classList.add('ts', 'parked-mock');
    el.innerHTML = statGrid() + `<div class="card"><div class="card-head"><h3>By hour of day</h3><span class="r sub-meta">Most tabs park around 3pm</span></div>
      <div class="card-body">${bars(HOURS, 15)}<div class="axis"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div></div></div>`;
  }

  function onVisible(el, fn) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold: 0.3 });
    io.observe(el);
  }

  const MOUNTS = { popup: mountPopup, options: mountOptions, autopark: mountAutopark, search: mountSearch, context: mountContext, restored: mountRestored, window: mountWindow, settings: mountSettings, rules: mountRules, parked: mountParked, feature: mountFeature };
  function mountAll(root = document) {
    // Popups first so option cards can read their state.
    root.querySelectorAll('[data-mock="popup"]').forEach(mountPopup);
    root.querySelectorAll('[data-mock]:not([data-mock="popup"])').forEach(el => MOUNTS[el.dataset.mock]?.(el));
    root.querySelectorAll('.pop-fit').forEach(fit);
  }

  window.TS = { icon, esc, WINDOWS, C, LABELS, mountAll, toggleControls };
  document.addEventListener('DOMContentLoaded', () => {
    // Static icons in page markup: <i data-icon="park"></i>
    document.querySelectorAll('[data-icon]').forEach(i => { i.outerHTML = icon(i.dataset.icon); });
    mountAll();
  });
})();
