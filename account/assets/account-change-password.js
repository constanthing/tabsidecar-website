// account.tabsidecar.com/change-password (TabSentry#580): changes the password of the
// account TabSidecar is signed in to. In order:
//   1. sign in again with the current password (with Turnstile), as TabSidecar's account
//      only (account-manage.js);
//   2. PUT /user with the new password and current_password, so Supabase's "Require
//      current password" and its password rules apply (no database function writes
//      passwords);
//   3. end the account's other sessions (/logout?scope=others), while the fresh session
//      is still the page's alone;
//   4. hand the fresh session to TabSidecar (account-handover, action change-password:
//      TabSidecar takes it only for the same user, and ends the session it replaces).
// The page never signs out the session it hands over, and keeps nothing afterwards
// (docs: sign-in-hand-over.md, "The shared session").
document.addEventListener('DOMContentLoaded', () => {
  const { MIN_LENGTH } = AccountPage;
  const { WORDS, problems, changeRefusal } = AccountManageWords;
  const VIEWS = ['Loading', 'Problem', 'Form', 'Changed', 'Failed'];

  AccountManage.start({ views: VIEWS, problems: problems('changes your TabSidecar password'), ready: wire });

  function wire(page) {
    const { $, status, show, whileBusy } = page;
    const form = $('changeForm');
    if (form.dataset.wired) return;
    form.dataset.wired = '1';
    const current = $('currentPassword'), next = $('newPassword'), confirm = $('confirmPassword');

    function checkReqs() {
      $('reqLen').classList.toggle('met', next.value.length >= MIN_LENGTH);
      const match = confirm.value.length > 0 && next.value === confirm.value;
      $('reqMatch').classList.toggle('met', match);
      $('confirmBox').classList.toggle('bad', confirm.value.length >= next.value.length && confirm.value.length > 0 && !match);
    }
    [next, confirm].forEach(input => input.addEventListener('input', () => { checkReqs(); status(null); }));

    // The words for a new password the page refuses before asking anyone, or null.
    async function localRefusal() {
      if (!current.value) return WORDS.enterCurrent;
      if (next.value.length < MIN_LENGTH) return WORDS.tooShort;
      if (next.value !== confirm.value) return WORDS.mismatch;
      if (next.value === current.value) return WORDS.sameAsCurrent;
      if (await isCommonPassword(next.value)) return COMMON_PASSWORD_MESSAGE;
      return null;
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      whileBusy(form, { busy: 'Changing…', idle: 'Change password' }, async () => {
        const refusal = await localRefusal();
        if (refusal) return status('err', refusal);
        const session = await page.reauthenticate(current.value, WORDS.wrongCurrent);
        if (!session) return;
        const changed = await AccountAuth.changePassword({ accessToken: session.access_token, password: next.value, currentPassword: current.value });
        if (!changed.ok) return status('err', changeRefusal(changed));
        form.reset();
        checkReqs();
        const others = await AccountAuth.signOutOthers({ accessToken: session.access_token });
        const result = await TabSidecarHandover.handOver(session);
        if (!result.ok) return show('Failed');
        show('Changed');
        if (!others.ok) status('warn', WORDS.othersNotSignedOut);
      });
    });
  }
});
