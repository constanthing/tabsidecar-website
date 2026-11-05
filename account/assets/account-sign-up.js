// The sign-in document's create-account steps (TabSentry#579): the email, the code from
// the email, then the password, after which the page signs in and hands the session to
// TabSidecar. account-sign-in.js calls wire() with the document's shared helpers; the
// sign-up's own state (the address, the code's session) stays in here.
(() => {
  const { MIN_LENGTH } = AccountPage;
  const { WORDS, emailRefusal, codeRefusal, passwordRefusal } = AccountSignInWords;
  const RESEND_WAIT_SECONDS = 60;  // Supabase's minimum interval per user
  const CODE_PATTERN = /^\d{6,10}$/;
  // A confirmation from more than this long before the code was asked for marks the
  // address as an account from before this sign-up.
  const EXISTING_ACCOUNT_SLACK_MS = 60 * 1000;

  // `page`: { $, show, status, humanCheck, whileBusy, handOver, validEmail } from
  // account-sign-in.js.
  function wire(page) {
    const signup = {
      email: '',
      startedAt: 0,
      codeSession: null,    // the sign-up code's session, until the sign-up finishes
      savedPassword: null,  // the password PUT /user saved with it, while signing in
      resendTimer: null
    };
    wireEmailStep(page, signup);
    wireCodeStep(page, signup);
    wirePasswordStep(page, signup);
  }

  // Counts down until Resend code can be used again.
  function startResendWait(page, signup) {
    clearInterval(signup.resendTimer);
    const resend = page.$('resendCode');
    let left = RESEND_WAIT_SECONDS;
    const tick = () => {
      resend.disabled = left > 0;
      resend.textContent = left > 0 ? `Resend code (${left} s)` : 'Resend code';
      if (left-- <= 0) clearInterval(signup.resendTimer);
    };
    tick();
    signup.resendTimer = setInterval(tick, 1000);
  }

  // ---- 1: the email ----
  function wireEmailStep(page, signup) {
    const { $, show, status, humanCheck, whileBusy, validEmail } = page;
    const form = $('signUpEmailForm');
    form.addEventListener('submit', event => {
      event.preventDefault();
      whileBusy(form, { busy: 'Sending…', idle: 'Send code' }, async () => {
        const email = $('signUpEmail');
        if (!validEmail(email)) return status('err', WORDS.enterEmail);
        const captchaToken = await humanCheck();
        if (!captchaToken) return;
        const answer = await AccountAuth.sendSignupCode({ email: email.value.trim(), captchaToken });
        const refusal = answer.ok ? null : emailRefusal(answer);
        if (refusal) return status('err', refusal);
        signup.email = email.value.trim();
        signup.startedAt = Date.now();
        $('codeEmail').textContent = signup.email;
        $('signUpCode').value = '';
        show('SignUpCode');
        status('ok', WORDS.codeSent);
        startResendWait(page, signup);
      });
    });
  }

  // ---- 2: the code ----
  function wireCodeStep(page, signup) {
    const { $, show, status, humanCheck, whileBusy } = page;
    $('resendCode').addEventListener('click', async () => {
      const resend = $('resendCode');
      resend.disabled = true;
      const captchaToken = await humanCheck();
      if (!captchaToken) { resend.disabled = false; return; }
      const answer = await AccountAuth.sendSignupCode({ email: signup.email, captchaToken });
      const refusal = answer.ok ? null : emailRefusal(answer);
      if (refusal) { status('err', refusal); resend.disabled = false; return; }
      status('ok', WORDS.resent);
      startResendWait(page, signup);
    });

    $('otherEmail').addEventListener('click', () => {
      clearInterval(signup.resendTimer);
      signup.codeSession = null;
      signup.savedPassword = null;
      show('SignUpEmail');
    });

    const form = $('signUpCodeForm');
    form.addEventListener('submit', event => {
      event.preventDefault();
      whileBusy(form, { busy: 'Checking…', idle: 'Continue' }, async () => {
        const code = $('signUpCode').value.replace(/\s+/g, '');
        if (!CODE_PATTERN.test(code)) return status('err', WORDS.codeShape);
        const answer = await AccountAuth.verifySignupCode({ email: signup.email, code });
        if (!answer.ok) return status('err', codeRefusal(answer));
        signup.codeSession = answer.session;
        signup.savedPassword = null;
        clearInterval(signup.resendTimer);
        const confirmedAt = Date.parse(answer.session.user?.email_confirmed_at || answer.session.user?.confirmed_at || '');
        $('existingNote').hidden = !(Number.isFinite(confirmedAt) && confirmedAt < signup.startedAt - EXISTING_ACCOUNT_SLACK_MS);
        $('passwordUsername').value = signup.email;
        show('SignUpPassword');
      });
    });
  }

  // Saves `password` with the code's session, unless it is the one already saved (a
  // retry after the security check didn't finish). The words for a refusal, or null.
  async function savePassword(signup, password) {
    if (password === signup.savedPassword) return null;
    if (!signup.codeSession) return WORDS.codeTooOld;
    const answer = await AccountAuth.setPassword({ accessToken: signup.codeSession.access_token, password });
    if (!answer.ok) return passwordRefusal(answer);
    signup.savedPassword = password;
    return null;
  }

  // The password is set: sign in with it (a session that can't set a password without
  // the current one, #178), end the account's other sessions (the code's among them)
  // while this one is still the page's alone, then hand it over. False when the security
  // check didn't finish, so nothing happened and the step stays.
  async function finishSignUp(page, signup, password) {
    const { $, show, status, humanCheck, handOver } = page;
    const captchaToken = await humanCheck();
    if (!captchaToken) return false;
    const answer = await AccountAuth.signInWithPassword({ email: signup.email, password, captchaToken });
    signup.codeSession = null;
    signup.savedPassword = null;
    if (!answer.ok) {
      $('signInEmail').value = signup.email;
      show('SignIn');
      status('warn', WORDS.passwordSavedSignIn);
      return true;
    }
    const others = await AccountAuth.signOutOthers({ accessToken: answer.session.access_token });
    await handOver(answer.session, { othersSignedOut: others.ok });
    return true;
  }

  // ---- 3: the password ----
  function wirePasswordStep(page, signup) {
    const { $, status, whileBusy } = page;
    const newPassword = $('newPassword'), confirmPassword = $('confirmPassword');
    function checkReqs() {
      $('reqLen').classList.toggle('met', newPassword.value.length >= MIN_LENGTH);
      const match = confirmPassword.value.length > 0 && newPassword.value === confirmPassword.value;
      $('reqMatch').classList.toggle('met', match);
      $('confirmBox').classList.toggle('bad', confirmPassword.value.length >= newPassword.value.length && confirmPassword.value.length > 0 && !match);
    }
    [newPassword, confirmPassword].forEach(input => input.addEventListener('input', () => { checkReqs(); status(null); }));

    const form = $('signUpPasswordForm');
    form.addEventListener('submit', event => {
      event.preventDefault();
      whileBusy(form, { busy: 'Creating…', idle: 'Create account' }, async () => {
        const password = newPassword.value;
        if (password.length < MIN_LENGTH) return status('err', WORDS.tooShort);
        if (password !== confirmPassword.value) return status('err', WORDS.mismatch);
        if (await isCommonPassword(password)) return status('err', COMMON_PASSWORD_MESSAGE);
        const refusal = await savePassword(signup, password);
        if (refusal) return status('err', refusal);
        if (await finishSignUp(page, signup, password)) {
          form.reset();
          checkReqs();
        }
      });
    });
  }

  window.AccountSignUp = Object.freeze({ wire });
})();
