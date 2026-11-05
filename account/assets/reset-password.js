// account-reset-password.html: choose a new password after the Cloud Sync "Forgot password?"
// email (TabSentry#171, #178, #192). Loaded as a file, not inline, so the page's CSP
// can allow only the site's own scripts.
document.addEventListener('DOMContentLoaded', () => {
  AccountPage.renderIcons();  // on tabsidecar.com mock.js has drawn them already
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MIN_LENGTH } = AccountPage;
  const LINK_TYPES = ['recovery'];  // what Supabase's reset email sends
  const $ = id => document.getElementById(id);
  const form = $('reset-form'), submit = $('reset-submit'), statusEl = $('status');
  const pw = $('new-password'), confirm = $('confirm-password');

  // Supabase puts the recovery token in the link's #fragment. Drop it (and any
  // token or error in the address) from the address bar.
  const link = AccountPage.readThisLink(LINK_TYPES);
  const accessToken = link.kind === 'token' ? link.accessToken : null;
  if (link.clearAddress) history.replaceState(null, document.title, location.pathname);

  const view = name => ['Form', 'Done', 'Expired'].forEach(v => { $('view' + v).hidden = v !== name; });
  const status = (type, text) => AccountPage.showStatus(statusEl, type, text);
  const busy = on => {
    submit.disabled = on;
    AccountPage.setBusyLabel(submit, on, 'Updating…', 'Update password');
    form.querySelectorAll('input').forEach(i => { i.disabled = on; });
  };
  const checkReqs = () => {
    $('reqLen').classList.toggle('met', pw.value.length >= MIN_LENGTH);
    const match = confirm.value.length > 0 && pw.value === confirm.value;
    $('reqMatch').classList.toggle('met', match);
    $('confirmBox').classList.toggle('bad', confirm.value.length >= pw.value.length && confirm.value.length > 0 && !match);
  };
  [pw, confirm].forEach(i => i.addEventListener('input', () => { checkReqs(); status(null); }));
  document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => {
    const input = $(b.dataset.show), hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    b.textContent = hidden ? 'Hide' : 'Show';
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (pw.value.length < MIN_LENGTH) return status('err', `Use at least ${MIN_LENGTH} characters for your new password.`);
    if (pw.value !== confirm.value) return status('err', 'The passwords don’t match.');
    // Busy while the list loads, so a second Enter or click can't submit twice.
    busy(true); const common = await isCommonPassword(pw.value); busy(false);
    if (common) return status('err', COMMON_PASSWORD_MESSAGE);
    if (!accessToken) return view('Expired');  // no link this page may use: send nothing
    busy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw.value })
      });
      const text = await res.text();
      const body = text ? JSON.parse(text) : null;
      if (res.status === 401 || res.status === 403) return view('Expired');
      if (!res.ok) throw new Error(body?.msg || body?.message || body?.error_description || body?.error || 'Could not update your password.');
      // A changed password signs out every session (#171, #178).
      let othersOut = true;
      try {
        // Every session, this link's included: the user signs in again with
        // the new password, and the link's session could otherwise set
        // another password without the current one (#178).
        othersOut = (await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=global`, {
          method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` }
        })).ok;
      } catch { othersOut = false; }
      $('othersCopy').textContent = othersOut
        ? 'You’re also signed out on your other devices, so anyone using the old password loses access.'
        : 'We couldn’t sign you out on your other devices. Sign out there if you need to.';
      form.reset(); checkReqs(); view('Done');
    } catch (err) {
      status('err', `${err.message || 'Could not update your password.'} Try again, or ask for a new link.`);
    } finally {
      busy(false);
    }
  });

  // A real reset link opens the form; anything else (no link, an expired one, a
  // link of another type, or the page inside a frame) means the link is missing or
  // expired.
  view(accessToken ? 'Form' : 'Expired');
  if (accessToken) isCommonPassword('');  // start loading the list

});
