// The Cloudflare Turnstile check on the sign-in pages (TabSentry#579): one fresh token
// for each Supabase call that its CAPTCHA protection guards.
// Turnstile's own script (challenges.cloudflare.com/turnstile/v0/api.js?render=explicit)
// loads after the hand-over script has taken TabSidecar's code out of the address, and
// only on the sign-in document: never on the reset and confirm pages, which hold a
// recovery or sign-up session. It shares the document with the password field and the
// session in memory: an accepted risk (docs: account-pages.md, "Turnstile").
// The widget runs in execute mode: nothing is checked until a step asks for a token,
// and each token is used once, then the widget is reset for the next.
(() => {
  // Public: the widget "TabSidecar auth", limited to account.tabsidecar.com (#577).
  const SITE_KEY = '0x4AAAAAAFy5iSrUm8DAXx8g';

  let widgetId = null;
  let used = false;
  let waiting = null;

  const settle = token => {
    const resolve = waiting;
    waiting = null;
    used = true;
    resolve?.(typeof token === 'string' && token ? token : null);
  };

  function render(container) {
    widgetId = window.turnstile.render(container, {
      sitekey: SITE_KEY,
      action: 'account',
      execution: 'execute',
      appearance: 'interaction-only',
      'refresh-expired': 'manual',
      callback: token => settle(token),
      'error-callback': () => { settle(null); return true; },
      'expired-callback': () => { used = true; },
      'timeout-callback': () => settle(null)
    });
  }

  // A fresh token, or null when the check couldn't run or failed (Turnstile didn't load,
  // an error, a challenge left unanswered). `container` is where an interactive
  // challenge shows, if Turnstile asks for one.
  function token(container) {
    if (typeof window.turnstile?.render !== 'function') return Promise.resolve(null);
    if (waiting) return Promise.resolve(null);
    return new Promise(resolve => {
      waiting = resolve;
      try {
        if (widgetId === null) render(container);
        else if (used) window.turnstile.reset(widgetId);
        used = false;
        window.turnstile.execute(widgetId);
      } catch {
        settle(null);
      }
    });
  }

  window.AccountCheck = Object.freeze({ token });
})();
