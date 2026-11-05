// What the account pages share: reading the link an account email opens them with, and
// their status line (email-confirmed.html, reset-password.html, TabSentry#192), and their
// icons; on account.tabsidecar.com the sign-in pages use it too (#579).
// These pages hold a live Supabase session or recovery token, so:
//   - a token comes only from the link's #fragment, where Supabase puts it, and only
//     for the link types the page is for; a token in the query string (which ends up
//     in server logs and history) is removed from the address bar but never used;
//   - in a frame the page reads nothing: a meta CSP can't set frame-ancestors, so
//     another site could frame the page and lay its own controls over the form;
//   - text from Supabase or the link is only ever set as text (textContent), never
//     parsed as markup.
(() => {
  // Where the account pages send their requests (connect-src in build_site.py's
  // TOKEN_PAGE_CSP must allow it).
  const SUPABASE_URL = 'https://quqhdnkypnuxvmibnzhn.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2O_Jk16JhJLmK7bFtLHsNQ_ifUzkz1Z';
  const MIN_LENGTH = 8;  // MIN_PASSWORD_LENGTH in background/cloud-auth.js
  // Parameters that carry a session or say why a link failed. When the address holds
  // any of them (in the fragment or the query), the page removes them from the address
  // bar, whether it uses them or not.
  const LINK_PARAMS = ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'error', 'error_code', 'error_description'];
  const STATUS_ICONS = { ok: 'check', warn: 'clock', err: 'x' };
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // The link the page opened with, as { kind, clearAddress, ... }:
  //   kind 'token'   a session for one of `types`: accessToken, type
  //   kind 'error'   Supabase sent the person back with an error: code, description
  //   kind 'framed'  the page is inside a frame and read nothing
  //   kind 'none'    no usable link (no fragment, a token for another link type, or a
  //                  token in the query string only)
  // clearAddress: the address holds link parameters the page should remove.
  // `where` is { hash, search, framed }, as location.hash, location.search and
  // window.top !== window.self.
  function readAccountLink(where, types) {
    if (where.framed) return { kind: 'framed', clearAddress: false };
    const fragment = new URLSearchParams(String(where.hash || '').replace(/^#/, ''));
    const query = new URLSearchParams(String(where.search || '').replace(/^\?/, ''));
    const clearAddress = LINK_PARAMS.some(name => fragment.has(name) || query.has(name));
    const accessToken = fragment.get('access_token');
    const type = fragment.get('type');
    if (accessToken && types.includes(type)) return { kind: 'token', clearAddress, accessToken, type };
    const code = fragment.get('error_code');
    if (fragment.get('error') || code) return { kind: 'error', clearAddress, code: code || '', description: fragment.get('error_description') || '' };
    return { kind: 'none', clearAddress };
  }

  // readAccountLink for this page's own address.
  function readThisLink(types) {
    return readAccountLink({ hash: location.hash, search: location.search, framed: isFramed() }, types);
  }

  // One icon from the sprite (icons.js) as an <svg> element. The sprite is
  // the site's own fixed data; nothing from a link or a server goes in here.
  function iconNode(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const sprite = (window.TS_ICONS || {})[name];
    if (!sprite) return svg;
    const parsed = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${sprite}</svg>`, 'image/svg+xml');
    svg.append(...[...parsed.documentElement.childNodes].map(node => document.importNode(node, true)));
    return svg;
  }

  // Shows `text` in the status line `el` as ok, warn or err; a falsy type hides it.
  function showStatus(el, type, text) {
    if (!type) { el.hidden = true; return; }
    el.className = `status ${type}`;
    const span = document.createElement('span');
    span.textContent = text;
    el.replaceChildren(iconNode(STATUS_ICONS[type]), span);
    el.hidden = false;
  }

  // Each <i data-icon="name"> placeholder in `root` as its icon (the site's own sprite).
  function renderIcons(root = document) {
    root.querySelectorAll('i[data-icon]').forEach(placeholder => placeholder.replaceWith(iconNode(placeholder.dataset.icon)));
  }

  // Whether the page is inside a frame: an account page then reads and sends nothing.
  const isFramed = () => window.top !== window.self;

  // A submit button's label while it works (with a spinner) or at rest.
  function setBusyLabel(button, busy, busyText, idleText) {
    if (!busy) { button.textContent = idleText; return; }
    const spin = document.createElement('span');
    spin.className = 'spin';
    button.replaceChildren(spin, busyText);
  }

  // Whether `text` has an email address's shape (and no spaces or markup), so a page may
  // show it: a token's payload isn't checked on the page, and could hold any words.
  const EMAIL_SHAPE = /^[^\s@<>"'`]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,63}$/;
  const isEmailAddress = text => typeof text === 'string' && text.length <= 254 && EMAIL_SHAPE.test(text);

  // The email a session's access token (a JWT) carries, read locally; '' when none.
  function emailFromToken(accessToken) {
    try {
      const claims = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof claims.email === 'string' ? claims.email : '';
    } catch {
      return '';
    }
  }

  window.AccountPage = { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MIN_LENGTH, readAccountLink, readThisLink, isFramed, iconNode, renderIcons, showStatus, setBusyLabel, emailFromToken, isEmailAddress };
})();
