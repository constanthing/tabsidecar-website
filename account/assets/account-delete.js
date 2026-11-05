// account.tabsidecar.com/delete-account (TabSentry#580): permanently deletes the account
// TabSidecar is signed in to. In order:
//   1. sign in again with the password (with Turnstile), as TabSidecar's account only
//      (account-manage.js);
//   2. delete_my_account with that fresh session: the database deletes only the
//      session's own account, and only after a password sign-in within the last 5
//      minutes (supabase/migrations/20260927_delete_my_account_recent_*.sql);
//   3. account-forget: TabSidecar signs out once Supabase confirms the account is gone.
//      If that fails (TabSidecar closed, or it couldn't ask Supabase), TabSidecar's next
//      refresh is refused and it signs out then.
// The page never hands a session over, signs nothing out, and keeps nothing.
document.addEventListener('DOMContentLoaded', () => {
  const { WORDS, problems, deleteRefusal } = AccountManageWords;
  const VIEWS = ['Loading', 'Problem', 'Form', 'Deleted'];

  AccountManage.start({ views: VIEWS, problems: problems('deletes your TabSidecar account'), ready: wire });

  // Deletes the session's own account and cloud data. The database refuses it
  // (reauthentication_required) unless the session signed in with a password within the
  // last 5 minutes. Only this page may name it (deploy_check.py), and it is one fetch
  // here so tests/supabase-grants.test.js reads its role.
  function deleteAccount(accessToken) {
    return AccountAuth.read(fetch(`${AccountPage.SUPABASE_URL}/rest/v1/rpc/delete_my_account`, {
      ...AccountAuth.requestOptions(),
      method: 'POST',
      headers: { apikey: AccountPage.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}'
    }));
  }

  function wire(page) {
    const { $, status, show, whileBusy } = page;
    const form = $('deleteForm');
    if (form.dataset.wired) return;
    form.dataset.wired = '1';
    const password = $('deletePassword');

    form.addEventListener('submit', event => {
      event.preventDefault();
      whileBusy(form, { busy: 'Deleting…', idle: 'Delete account permanently' }, async () => {
        if (!password.value) return status('err', WORDS.enterPassword);
        const session = await page.reauthenticate(password.value, WORDS.wrongPassword);
        if (!session) return;
        const deleted = await deleteAccount(session.access_token);
        if (!deleted.ok) return status('err', deleteRefusal(deleted));
        form.reset();
        const forgotten = await TabSidecarHandover.forget();
        $('deletedText').textContent = forgotten.ok ? WORDS.forgotten : WORDS.notForgotten;
        show('Deleted');
      });
    });
  }
});
