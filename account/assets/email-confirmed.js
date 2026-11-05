// account-email-confirmed.html: choose the account's first password after the link in the
// signup (or existing-account) code email (TabSentry#171, #192). Loaded as a file,
// not inline, so the page's CSP can allow only the site's own scripts.
document.addEventListener('DOMContentLoaded', () => {
  AccountPage.renderIcons();  // on tabsidecar.com mock.js has drawn them already
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MIN_LENGTH } = AccountPage;
  // The link types the code email sends here: "signup" for a new (or not yet
  // confirmed) address, "magiclink" for an account that already exists.
  const LINK_TYPES = ['signup', 'magiclink'];
  const $ = id => document.getElementById(id);
  const form = $('password-form'), submit = $('password-submit'), statusEl = $('status');
  const pw = $('new-password'), confirm = $('confirm-password');

  // The link lands here with a session in the #fragment. The account has no
  // password until one is set here or in the extension (#171). Drop the tokens
  // from the address bar.
  const link = AccountPage.readThisLink(LINK_TYPES);
  const accessToken = link.kind === 'token' ? link.accessToken : null;
  if (link.clearAddress) history.replaceState(null, document.title, location.pathname);

  const view = name => ['Form', 'Done', 'Expired', 'Empty'].forEach(v => { $('view' + v).hidden = v !== name; });
  const status = (type, text) => AccountPage.showStatus(statusEl, type, text);
  const busy = on => {
    submit.disabled = on;
    AccountPage.setBusyLabel(submit, on, 'Saving…', 'Set password');
    form.querySelectorAll('input').forEach(i => { i.disabled = on; });
  };
  const checkReqs = () => {
    $('reqLen').classList.toggle('met', pw.value.length >= MIN_LENGTH);
    const match = confirm.value.length > 0 && pw.value === confirm.value;
    $('reqMatch').classList.toggle('met', match);
    $('confirmBox').classList.toggle('bad', confirm.value.length >= pw.value.length && confirm.value.length > 0 && !match);
  };
  // What a failed link says, by Supabase's error_code. Nothing from the address is ever
  // shown (the security scan's F9, #579): a crafted link's error_description could
  // otherwise put any sentence on this page.
  const LINK_ERRORS = {
    otp_expired: { title: 'This link has expired', detail: '' }
  };
  const UNKNOWN_LINK_ERROR = { title: 'We couldn’t confirm your email', detail: 'The link didn’t work.' };
  const expired = code => {
    const { title, detail } = Object.hasOwn(LINK_ERRORS, code) ? LINK_ERRORS[code] : UNKNOWN_LINK_ERROR;
    $('expiredTitle').textContent = title;
    $('expiredDetail').textContent = detail;
    $('expiredDetail').hidden = !detail;
    view('Expired');
  };
  [pw, confirm].forEach(i => i.addEventListener('input', () => { checkReqs(); status(null); }));
  document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => {
    const input = $(b.dataset.show), hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    b.textContent = hidden ? 'Hide' : 'Show';
  }));

  async function supabase(path, options) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(body?.msg || body?.message || body?.error_description || body?.error || 'Something went wrong.');
    return body;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (pw.value.length < MIN_LENGTH) return status('err', `Use at least ${MIN_LENGTH} characters.`);
    if (pw.value !== confirm.value) return status('err', 'The passwords don’t match.');
    // Busy while the list loads, so a second Enter or click can't submit twice.
    busy(true); const common = await isCommonPassword(pw.value); busy(false);
    if (common) return status('err', COMMON_PASSWORD_MESSAGE);
    if (!accessToken) return view('Empty');  // no link this page may use: send nothing
    busy(true);
    try {
      await supabase('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: pw.value }) });
      // Sign out every session, this link's included: the user signs in with
      // the new password in TabSidecar, and the link's session could otherwise
      // set another password without the current one (#178).
      try { await supabase('/auth/v1/logout?scope=global', { method: 'POST' }); } catch { /* best effort */ }
      form.reset(); checkReqs(); view('Done');
    } catch (err) {
      status('err', err.message || 'Could not set your password.');
    } finally {
      busy(false);
    }
  });

  if (link.kind === 'error') expired(link.code);
  else if (accessToken) {
    view('Form');
    isCommonPassword('');  // start loading the list
    // The access token is a JWT; its payload carries the email. Read it locally, no
    // extra request, and shown only when it has an address's shape: the token isn't
    // checked here, so its payload could hold any sentence (F9, #579).
    const email = AccountPage.emailFromToken(accessToken);
    if (AccountPage.isEmailAddress(email)) $('emailOut').textContent = email;
  } else view('Empty');

});
