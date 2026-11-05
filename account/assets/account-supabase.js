// The account site's own small Supabase client (TabSentry#579, #580): the calls the
// sign-in, create-account, forgot-password, change-password and delete-account pages
// make, with nothing kept anywhere.
//   - A session lives only in the variable the caller holds. Nothing is written to any
//     storage, nothing is read from the address, and no session is ever refreshed: the
//     page hands its session to TabSidecar, which refreshes it (twice) itself, and the
//     two share one Supabase session (docs: sign-in-hand-over.md, "The shared session").
//     A page refreshing it, or signing it out, would sign TabSidecar out.
//   - The only sign-out is signOutOthers (scope=others), before a hand-over: it ends the
//     account's other sessions and keeps the one being handed over.
//   - Every call that Supabase's CAPTCHA protection guards sends the Turnstile token
//     (gotrue_meta_security.captcha_token).
//   - Each request waits at most REQUEST_TIMEOUT_MS, and sends no cookies or referrer.
// read() and requestOptions() are for a page's own request with the same rules (the
// delete page's account deletion, written there so only it names it).
// Every answer is { ok: true, body } or { ok: false, status, code }: status 0 means
// Supabase couldn't be reached. Callers turn these into fixed words; Supabase's own
// message is never shown, so no answer can tell an existing address from a missing one.
(() => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.AccountPage;
  const ACCOUNT_ORIGIN = 'https://account.tabsidecar.com';
  // Where the emails' links land: Supabase's redirect allow-list has exactly these (#577).
  const RESET_REDIRECT = `${ACCOUNT_ORIGIN}/reset-password`;
  const CONFIRM_REDIRECT = `${ACCOUNT_ORIGIN}/email-confirmed`;
  const REQUEST_TIMEOUT_MS = 10000;

  // What every request sends besides its own method, headers and body: no cookies, no
  // referrer, nothing cached, and at most REQUEST_TIMEOUT_MS.
  const requestOptions = () => ({
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  // A request's answer as { ok: true, body } or { ok: false, status, code }.
  async function read(request) {
    let response;
    try {
      response = await request;
    } catch {
      return { ok: false, status: 0, code: 'unreachable' };
    }
    let parsed = null;
    try {
      const text = await response.text();
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (response.ok) return { ok: true, body: parsed };
    return { ok: false, status: response.status, code: errorCode(parsed) };
  }

  // One request to Supabase Auth. `accessToken` signs it as that session.
  function call(path, { method = 'POST', body, accessToken } = {}) {
    const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return read(fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      ...requestOptions(),
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }));
  }

  // Supabase's code for a refusal: Auth's error_code, a database function's own exception
  // (raise ... using errcode 'P0001' answers its message, such as reauthentication_required),
  // or the API's code.
  function errorCode(parsed) {
    if (typeof parsed?.error_code === 'string') return parsed.error_code;
    if (parsed?.code === 'P0001' && typeof parsed?.message === 'string') return parsed.message;
    return typeof parsed?.code === 'string' ? parsed.code : '';
  }

  const security = captchaToken => ({ captcha_token: String(captchaToken || '') });
  // A session from Supabase's answer, as the hand-over takes it; null when it has none.
  const sessionFrom = body => (body?.access_token && body?.refresh_token
    ? { access_token: body.access_token, refresh_token: body.refresh_token, user: body.user || null }
    : null);

  // POST /token?grant_type=password: a session, or the refusal.
  async function signInWithPassword({ email, password, captchaToken }) {
    const answer = await call('/token?grant_type=password', { body: { email, password, gotrue_meta_security: security(captchaToken) } });
    if (!answer.ok) return answer;
    const session = sessionFrom(answer.body);
    return session ? { ok: true, session } : { ok: false, status: 502, code: 'no_session' };
  }

  // POST /otp: emails a sign-up code to a new address (or a sign-in code to an existing
  // one). Supabase answers the same either way.
  function sendSignupCode({ email, captchaToken }) {
    const query = new URLSearchParams({ redirect_to: CONFIRM_REDIRECT });
    return call(`/otp?${query}`, { body: { email, create_user: true, gotrue_meta_security: security(captchaToken) } });
  }

  // POST /verify: the emailed code for a session (the code's session).
  async function verifySignupCode({ email, code }) {
    const answer = await call('/verify', { body: { type: 'email', email, token: code } });
    if (!answer.ok) return answer;
    const session = sessionFrom(answer.body);
    return session ? { ok: true, session } : { ok: false, status: 502, code: 'no_session' };
  }

  // PUT /user: sets the password with the code's session.
  function setPassword({ accessToken, password }) {
    return call('/user', { method: 'PUT', accessToken, body: { password } });
  }

  // PUT /user with the current password (#580): Supabase's "Require current password"
  // checks it, and its password rules apply. Refused with current_password_mismatch,
  // same_password, weak_password or reauthentication_needed.
  function changePassword({ accessToken, password, currentPassword }) {
    return call('/user', { method: 'PUT', accessToken, body: { password, current_password: currentPassword } });
  }

  // POST /logout?scope=others: ends every session of the account but `accessToken`'s.
  function signOutOthers({ accessToken }) {
    return call('/logout?scope=others', { accessToken });
  }

  // POST /recover: emails a reset link that lands on the account site. Supabase answers
  // the same for an address with or without an account.
  function sendPasswordReset({ email, captchaToken }) {
    const query = new URLSearchParams({ redirect_to: RESET_REDIRECT });
    return call(`/recover?${query}`, { body: { email, gotrue_meta_security: security(captchaToken) } });
  }

  window.AccountAuth = Object.freeze({ signInWithPassword, sendSignupCode, verifySignupCode, setPassword, changePassword, signOutOthers, sendPasswordReset, read, requestOptions });
})();
