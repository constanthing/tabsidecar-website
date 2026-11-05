// account.tabsidecar.com's sign-in document (TabSentry#579): sign in, create an account
// and forgot password, one document at /sign-in, /sign-up and /forgot-password, so moving
// between them keeps TabSidecar's hand-over code in memory (account-handover.js).
// This file shows the steps, signs in, sends the reset link and hands sessions over;
// the create-account steps are in account-sign-up.js and the words in
// account-sign-in-words.js. The rules each step keeps:
//   - the same words for an address with an account and one without (sign-in: "Email or
//     password is incorrect"; create account and forgot password: "If that address …");
//   - a Turnstile token on each call Supabase's CAPTCHA protection guards
//     (account-turnstile.js), a fresh one each time;
//   - the session only in a variable, dropped once TabSidecar answers the hand-over, and
//     never refreshed or signed out after it (account-supabase.js);
//   - nothing shown from the address, nothing stored, nothing done inside a frame.
document.addEventListener('DOMContentLoaded', () => {
  const Handover = window.TabSidecarHandover;
  const { WORDS, PROBLEMS, emailRefusal, signInRefusal } = AccountSignInWords;
  const $ = id => document.getElementById(id);
  const VIEWS = ['Loading', 'Problem', 'Already', 'SignIn', 'SignUpEmail', 'SignUpCode', 'SignUpPassword', 'Forgot', 'ForgotSent', 'SignedIn', 'Failed'];
  // The address each step is at; the others keep the address they opened with.
  const STEP_PATHS = { SignIn: '/sign-in', SignUpEmail: '/sign-up', Forgot: '/forgot-password' };
  // The step each address opens at.
  const PATH_STEPS = { '/': 'SignIn', '/sign-in': 'SignIn', '/sign-up': 'SignUpEmail', '/forgot-password': 'Forgot' };

  let step = null;
  let who = null;          // whoami's answer, once asked

  const statusEl = $('status');
  const status = (type, text) => AccountPage.showStatus(statusEl, type, text);
  AccountPage.renderIcons();
  // In a frame the page reads nothing and offers nothing (the header refuses frames too).
  if (AccountPage.isFramed()) {
    $('problemForgot').hidden = true;
    return showProblem('framed', 'SignIn');
  }

  function show(name) {
    step = name;
    VIEWS.forEach(v => { $('view' + v).hidden = v !== name; });
    status(null);
    if (STEP_PATHS[name] && location.pathname !== STEP_PATHS[name]) history.replaceState(null, '', STEP_PATHS[name]);
    $('view' + name).querySelector('input:not([type="hidden"]):not([readonly])')?.focus();
  }

  function showProblem(error, action) {
    const problem = PROBLEMS[error] || PROBLEMS.unavailable;
    $('problemTitle').textContent = problem.title;
    $('problemCopy').textContent = problem.copy;
    $('problemAction').textContent = action === 'SignUpEmail' ? 'Create account' : 'Sign in';
    $('problemRetry').hidden = !problem.retry;
    $('problemRetry').dataset.step = action;
    show('Problem');
  }

  // A step that ends in a hand-over opens only once TabSidecar has said who it is
  // signed in as: signed out, or the page says who is signed in instead.
  async function openHandoverStep(name) {
    if (who?.ok && !who.signedIn) return show(name);
    show('Loading');
    who = await Handover.whoami();
    if (!who.ok) return showProblem(who.error, name);
    if (who.signedIn) {
      Handover.showAlreadySignedIn($('alreadyText'), who.email);
      return show('Already');
    }
    show(name);
  }

  const open = name => (name === 'Forgot' ? show('Forgot') : openHandoverStep(name));

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

  // A fresh Turnstile token, or null once the page has said the check didn't finish.
  async function humanCheck() {
    const token = await AccountCheck.token($('humanCheck'));
    if (!token) status('err', WORDS.checkFailed);
    return token;
  }

  const validEmail = input => input.value.trim() !== '' && input.checkValidity();

  // Hands `session` to TabSidecar, and says how it went. The session is dropped either way.
  // `othersSignedOut: false` adds that the account's other sessions are still signed in.
  async function handOver(session, { othersSignedOut = true } = {}) {
    const result = await Handover.handOver(session);
    if (result.ok) {
      Handover.showSignedIn($('signedInText'));
      show('SignedIn');
      if (!othersSignedOut) status('warn', WORDS.othersNotSignedOut);
      return;
    }
    if (result.error === 'crash-safe') return showProblem('crash-safe', 'SignIn');
    show('Failed');
  }

  // ---- Sign in ----
  const signInForm = $('signInForm');
  signInForm.addEventListener('submit', event => {
    event.preventDefault();
    whileBusy(signInForm, { busy: 'Signing in…', idle: 'Sign in' }, async () => {
      const email = $('signInEmail'), password = $('signInPassword');
      if (!validEmail(email)) return status('err', WORDS.enterEmail);
      if (!password.value) return status('err', WORDS.enterPassword);
      const captchaToken = await humanCheck();
      if (!captchaToken) return;
      const answer = await AccountAuth.signInWithPassword({ email: email.value.trim(), password: password.value, captchaToken });
      if (!answer.ok) return status('err', signInRefusal(answer));
      password.value = '';
      await handOver(answer.session);
    });
  });

  // ---- Create account: account-sign-up.js ----
  AccountSignUp.wire({ $, show, status, humanCheck, whileBusy, handOver, validEmail });

  // ---- Forgot password ----
  const forgotForm = $('forgotForm');
  forgotForm.addEventListener('submit', event => {
    event.preventDefault();
    whileBusy(forgotForm, { busy: 'Sending…', idle: 'Send reset link' }, async () => {
      const email = $('forgotEmail');
      if (!validEmail(email)) return status('err', WORDS.enterEmail);
      const captchaToken = await humanCheck();
      if (!captchaToken) return;
      const answer = await AccountAuth.sendPasswordReset({ email: email.value.trim(), captchaToken });
      const refusal = answer.ok ? null : emailRefusal(answer);
      if (refusal) return status('err', refusal);
      $('forgotSentText').textContent = WORDS.resetSent;
      show('ForgotSent');
    });
  });

  // ---- Moving between steps, and the show/hide buttons ----
  document.querySelectorAll('[data-go]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const email = document.querySelector(`#view${step} input[type="email"]`)?.value.trim() || '';
    const target = link.dataset.go;
    const field = { SignIn: 'signInEmail', SignUpEmail: 'signUpEmail', Forgot: 'forgotEmail' }[target];
    if (field && email && !$(field).value) $(field).value = email;
    open(target);
  }));
  $('problemRetry').addEventListener('click', () => { who = null; open($('problemRetry').dataset.step || 'SignIn'); });
  document.querySelectorAll('[data-show]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.show), hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    button.textContent = hidden ? 'Hide' : 'Show';
  }));

  const first = PATH_STEPS[location.pathname] || 'SignIn';
  if (first === 'SignUpEmail') isCommonPassword('');  // start loading the list
  if (first !== 'Forgot' && !Handover.hasCode()) return showProblem('no-code', first);
  open(first);
});