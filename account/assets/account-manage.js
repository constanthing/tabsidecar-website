// What the change-password and delete-account pages share (TabSentry#580): asking
// TabSidecar which account it is signed in to, showing one view at a time, the busy
// form, and signing in again with that account's password. Each page acts only on the
// account TabSidecar is signed in to:
//   - the page signs in with the address TabSidecar gave (account-whoami), never one
//     typed on the page;
//   - right before signing in it asks TabSidecar again, and stops if TabSidecar signed
//     out or another account is signed in by then;
//   - it stops if Supabase's session is for another address.
// The session lives only in the caller's variable (account-supabase.js), and nothing is
// shown from the address. account-change-password.js and account-delete.js call start().
(() => {
  const Handover = window.TabSidecarHandover;
  const { WORDS } = AccountManageWords;
  const $ = id => document.getElementById(id);
  const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== '';

  // `views`: the page's view names (each an element #view<Name>), Loading, Problem and
  // Form among them. `problems`: AccountManageWords.problems(...). `ready(page)` runs
  // once TabSidecar has said which account is signed in, before the form shows.
  function start({ views, problems, ready }) {
    const statusEl = $('status');
    const page = {
      $,
      email: '',   // the address TabSidecar is signed in as
      status: (type, text) => AccountPage.showStatus(statusEl, type, text),
      show: name => {
        views.forEach(v => { $('view' + v).hidden = v !== name; });
        page.status(null);
        $('view' + name).querySelector('input:not([type="hidden"]):not([readonly])')?.focus();
      },
      showProblem: error => {
        const problem = problems[error] || problems.unavailable;
        $('problemTitle').textContent = problem.title;
        $('problemCopy').textContent = problem.copy;
        $('problemRetry').hidden = !problem.retry;
        page.show('Problem');
      },
      whileBusy,
      reauthenticate: (password, wrong) => reauthenticate(page, password, wrong)
    };
    AccountPage.renderIcons();
    wireShowButtons();
    // In a frame the page reads nothing and offers nothing (the header refuses frames too).
    if (AccountPage.isFramed()) return page.showProblem('framed');
    if (!Handover.hasCode()) return page.showProblem('no-code');
    $('problemRetry').addEventListener('click', () => askWhoIsSignedIn(page, ready));
    askWhoIsSignedIn(page, ready);
  }

  async function askWhoIsSignedIn(page, ready) {
    page.show('Loading');
    const who = await Handover.whoami();
    if (!who.ok) return page.showProblem(who.error);
    if (!who.signedIn || !AccountPage.isEmailAddress(who.email)) return page.showProblem('signed-out');
    page.email = who.email;
    document.querySelectorAll('[data-signed-in-as]').forEach(el => { el.textContent = WORDS.signedInAs(who.email); });
    document.querySelectorAll('[data-username]').forEach(input => { input.value = who.email; });
    ready(page);
    page.show('Form');
  }

  // Signs in again as TabSidecar's account with `password`: the fresh session, or null
  // once the page has said why not (`wrong`: the words for a wrong password).
  async function reauthenticate(page, password, wrong) {
    const who = await Handover.whoami();
    if (!who.ok) {
      page.showProblem(who.error);
      return null;
    }
    if (!who.signedIn) {
      page.showProblem('signed-out');
      return null;
    }
    if (!sameAddress(who.email, page.email)) {
      page.status('err', WORDS.otherAccount);
      return null;
    }
    const captchaToken = await AccountCheck.token($('humanCheck'));
    if (!captchaToken) {
      page.status('err', WORDS.checkFailed);
      return null;
    }
    const answer = await AccountAuth.signInWithPassword({ email: page.email, password, captchaToken });
    if (!answer.ok) {
      page.status('err', AccountManageWords.passwordSignInRefusal(answer, wrong));
      return null;
    }
    if (!sameAddress(answer.session.user?.email, page.email)) {
      page.status('err', WORDS.otherAccount);
      return null;
    }
    return answer.session;
  }

  function busy(form, on, label) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = on;
    AccountPage.setBusyLabel(button, on, label.busy, label.idle);
    form.querySelectorAll('input, button').forEach(control => { if (control !== button) control.disabled = on; });
  }

  // Runs `work` with the form busy; a second submit while it runs does nothing.
  async function whileBusy(form, label, work) {
    if (form.dataset.busy) return;
    form.dataset.busy = '1';
    busy(form, true, label);
    try {
      await work();
    } finally {
      delete form.dataset.busy;
      busy(form, false, label);
    }
  }

  function wireShowButtons() {
    document.querySelectorAll('[data-show]').forEach(button => button.addEventListener('click', () => {
      const input = $(button.dataset.show), hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      button.textContent = hidden ? 'Hide' : 'Show';
    }));
  }

  window.AccountManage = Object.freeze({ start });
})();
