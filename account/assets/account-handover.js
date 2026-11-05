// The account pages' side of the sign-in hand-over to TabSidecar (TabSentry#578).
// TabSidecar opens an account page with a one-time code in the address fragment
// (#c=...). This script is the first script on every account page, so it:
//   - reads the code and clears it from the address at once (history.replaceState),
//     before any other script, Turnstile's included, loads; a code in the query string
//     is removed too and never used;
//   - talks only to TabSidecar's store IDs below, never to an ID from the address;
//   - sends a session only to the copy of TabSidecar that accepted the code
//     (account-whoami), and keeps neither the session nor the code afterwards; on
//     pagehide it drops the code.
// Pages call window.TabSidecarHandover (whoami, handOver, forget). Text from TabSidecar
// is only ever set as text (textContent). docs: sign-in-hand-over.md.
(() => {
  // TabSidecar's store IDs: the Chrome Web Store's, its only store. A listing in another
  // store (Edge Add-ons) adds its ID here and in deploy_check.py. deploy_check.py refuses
  // to publish the account site with any other ID; build_site.py --test-extension-id adds
  // an unpacked copy's ID to a local test build only.
  const EXTENSION_IDS = ['fcgiclcbpjeccamoihlbhcihommdfame'];
  const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
  const CODE_PARAM = 'c';
  // Longer than one hand-over can take: three Supabase requests of up to 10 s each, one
  // after another (HANDOVER_LONGEST_MS in TabSidecar's cloud-auth.js), with room for
  // TabSidecar starting. One queued behind another tab's hand-over can take longer.
  const REPLY_TIMEOUT_MS = 45000;
  const WORDING = Object.freeze({
    signedIn: 'You’re signed in. You can close this tab.',
    alreadySignedIn: email => `TabSidecar is already signed in as ${email}.`
  });

  let code = null;
  // The ID of the TabSidecar that accepted the code.
  let extensionId = null;

  // Whether one part of a fragment or query ("c=...", "%63=...") is the code's, read as
  // URLSearchParams reads it.
  const isCodePart = part => new URLSearchParams(part).keys().next().value === CODE_PARAM;
  // A fragment or query (without # or ?) less the code's parts, the rest as written.
  const withoutCode = text => text.split('&').filter(part => !isCodePart(part)).join('&');

  // Reads the code, then rewrites the address without it, keeping everything else. If
  // the address can't be rewritten, the code isn't used: it would stay in the address.
  function takeCodeFromAddress() {
    const address = new URL(location.href);
    const fragment = address.hash.replace(/^#/, '');
    const query = address.search.replace(/^\?/, '');
    const found = new URLSearchParams(fragment).get(CODE_PARAM);
    if (found === null && !new URLSearchParams(query).has(CODE_PARAM)) return;
    address.hash = withoutCode(fragment);
    if (withoutCode(query) !== query) address.search = withoutCode(query);
    try {
      // The whole address, not a path: a path such as "//other.example/" would name
      // another site, and the browser would refuse it.
      history.replaceState(history.state, '', address.href);
    } catch {
      return;
    }
    if (found && CODE_PATTERN.test(found)) code = found;
  }

  // One message to one ID: its reply, or null (not installed, no answer, an error).
  function send(id, message) {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), REPLY_TIMEOUT_MS);
      const done = reply => { clearTimeout(timer); resolve(reply ?? null); };
      try {
        sendMessage(id, message, reply => done(runtime.lastError ? null : reply));
      } catch {
        done(null);
      }
    });
  }

  // The browser's own sendMessage, taken now: a script that loads later and replaces
  // chrome.runtime.sendMessage never sees the code.
  const runtime = globalThis.chrome?.runtime;
  const sendMessage = typeof runtime?.sendMessage === 'function' ? runtime.sendMessage.bind(runtime) : null;
  const canTalk = () => !!sendMessage;

  // Who TabSidecar is signed in as: { ok: true, signedIn, email? }, or { ok: false,
  // error } with error "no-code" (the page wasn't opened by TabSidecar), "not-installed"
  // "refused", "unavailable" (TabSidecar is starting or busy: asking again may work) or
  // "crash-safe" (TabSidecar started in Crash-Safe mode: it answers once the user picks
  // Try normal startup in TabSidecar).
  async function whoami() {
    if (!code) return { ok: false, error: 'no-code' };
    if (!canTalk()) return { ok: false, error: 'not-installed' };
    let answered = false;
    let unavailable = false;
    let crashSafe = false;
    for (const id of EXTENSION_IDS) {
      const reply = await send(id, { type: 'account-whoami', code });
      if (reply?.ok === true) {
        extensionId = id;
        return { ok: true, signedIn: reply.signedIn === true, email: typeof reply.email === 'string' ? reply.email : undefined };
      }
      answered ||= !!reply;
      unavailable ||= reply?.error === 'unavailable';
      crashSafe ||= reply?.error === 'crash-safe';
    }
    if (crashSafe) return { ok: false, error: 'crash-safe' };
    if (unavailable) return { ok: false, error: 'unavailable' };
    return { ok: false, error: answered ? 'refused' : 'not-installed' };
  }

  // Sends one message that spends the code (account-handover, account-forget) to the
  // TabSidecar that accepted it. The code is dropped whatever the answer: TabSidecar
  // spends it once it reads the message (one it can't read, say a session too long, is
  // refused unread), so asking again isn't tried and the page is opened again from
  // TabSidecar. In Crash-Safe mode the code is kept: TabSidecar read nothing.
  // "unavailable" means the outcome isn't known: TabSidecar or Supabase failed, or no
  // answer came in time (TabSidecar may still have finished).
  async function spend(message) {
    if (!code) return { ok: false, error: 'no-code' };
    if (!extensionId) {
      const who = await whoami();
      if (!who.ok) {
        if (who.error !== 'unavailable' && who.error !== 'crash-safe') code = null;
        return who;
      }
    }
    const reply = await send(extensionId, { ...message, code });
    // In Crash-Safe mode TabSidecar read nothing, so the code is still good for asking
    // again once the user picks Try normal startup.
    if (reply?.error !== 'crash-safe') code = null;
    if (reply?.ok === true) return { ok: true };
    const known = ['refused', 'crash-safe'];
    return { ok: false, error: known.includes(reply?.error) ? reply.error : 'unavailable' };
  }

  // Hands a Supabase session ({ access_token, refresh_token }) to TabSidecar. Only
  // those two fields are sent; the caller drops its own copy after this answers.
  function handOver(session) {
    const tokens = { access_token: String(session?.access_token || ''), refresh_token: String(session?.refresh_token || '') };
    return spend({ type: 'account-handover', session: tokens });
  }

  // After the account was deleted: TabSidecar signs out once Supabase confirms it.
  function forget() {
    return spend({ type: 'account-forget' });
  }

  takeCodeFromAddress();
  addEventListener('pagehide', () => { code = null; extensionId = null; });

  window.TabSidecarHandover = Object.freeze({
    hasCode: () => !!code,
    whoami,
    handOver,
    forget,
    WORDING,
    // The words for after a hand-over, and for TabSidecar already signed in, as text.
    showSignedIn: element => { element.textContent = WORDING.signedIn; },
    showAlreadySignedIn: (element, email) => { element.textContent = WORDING.alreadySignedIn(String(email || '')); }
  });
})();
