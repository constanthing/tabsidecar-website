// The sign-in document's words (TabSentry#579): a fixed sentence for each answer, the
// problem views' words, and which sentence a refused Supabase call gets. Nothing from
// Supabase or the address is ever shown, and an address with an account reads the same
// as one without. account-sign-in.js (sign in, forgot password, the hand-over) and
// account-sign-up.js (create account) use them.
(() => {
  const { MIN_LENGTH } = AccountPage;

  // Fixed words for each answer.
  const WORDS = Object.freeze({
    incorrect: 'Email or password is incorrect.',
    unreachable: 'We couldn’t reach TabSidecar’s server. Check your connection and try again.',
    tooMany: 'Too many tries. Wait a few minutes and try again.',
    checkFailed: 'The security check didn’t finish. Try again.',
    enterEmail: 'Enter a valid email.',
    enterPassword: 'Enter your password.',
    notConfirmed: 'This email isn’t confirmed yet. Choose Create an account to get a code and finish setting up.',
    codeSent: 'If that address can be used, a code is on its way. It can take a minute to arrive.',
    codeWrong: 'That code is wrong or has expired. Use the newest email, or resend the code.',
    codeShape: 'Enter the code from the email.',
    codeTooOld: 'This code is too old to set a password. Choose Use a different email and start again.',
    tooShort: `Use at least ${MIN_LENGTH} characters.`,
    mismatch: 'The passwords don’t match.',
    samePassword: 'Choose a password different from your current one.',
    weakPassword: 'Choose a stronger password.',
    notSaved: 'Your password wasn’t saved. Try again.',
    passwordSavedSignIn: 'Your password is saved. Sign in with it to finish.',
    resetSent: 'If that address has an account, a reset link is on its way. It opens a page where you choose a new password.',
    resent: 'If that address can be used, a new code is on its way.',
    othersNotSignedOut: 'We couldn’t sign out your other devices. Sign out and back in there, or change your password in TabSidecar.',
    crashSafe: 'TabSidecar started in Crash-Safe mode. Choose Try normal startup in TabSidecar, then try again.'
  });

  // What the page says when it can't hand a sign-in to TabSidecar, by whoami's answer.
  const PROBLEMS = Object.freeze({
    'no-code': { title: 'Open this page from TabSidecar', copy: 'This page signs TabSidecar in, so it has to be opened from TabSidecar.', retry: false },
    'not-installed': { title: 'TabSidecar isn’t answering', copy: 'Check that TabSidecar is installed and turned on in this browser, then open this page from it again.', retry: false },
    refused: { title: 'This page has expired', copy: 'Pages opened from TabSidecar work once, for about an hour. Open it from TabSidecar again.', retry: false },
    unavailable: { title: 'TabSidecar is busy', copy: 'TabSidecar is starting or busy. Try again in a moment.', retry: true },
    'crash-safe': { title: 'TabSidecar is in Crash-Safe mode', copy: WORDS.crashSafe, retry: true },
    framed: { title: 'Open this page in its own tab', copy: 'For your safety, TabSidecar’s account pages don’t work inside another page.', retry: false }
  });

  const unreachable = answer => answer.status === 0 || answer.status >= 500;

  // The words for a refused call that sends an email (sign-up code, reset link). Any
  // answer about the address itself reads as sent (null), so none tells whether it has
  // an account.
  function emailRefusal(answer) {
    if (unreachable(answer)) return WORDS.unreachable;
    if (answer.status === 429) return WORDS.tooMany;
    if (answer.code === 'captcha_failed') return WORDS.checkFailed;
    if (answer.code === 'email_address_invalid' || answer.code === 'validation_failed') return WORDS.enterEmail;
    return null;
  }

  function signInRefusal(answer) {
    if (unreachable(answer)) return WORDS.unreachable;
    if (answer.status === 429) return WORDS.tooMany;
    if (answer.code === 'captcha_failed') return WORDS.checkFailed;
    // Supabase says this only once the password is right, so it tells nothing about
    // whether an address has an account: an unconfirmed sign-up from before #171.
    if (answer.code === 'email_not_confirmed') return WORDS.notConfirmed;
    return WORDS.incorrect;
  }

  function codeRefusal(answer) {
    return unreachable(answer) ? WORDS.unreachable : WORDS.codeWrong;
  }

  // The words for a refused password, by Supabase's code.
  function passwordRefusal(answer) {
    if (unreachable(answer)) return WORDS.unreachable;
    if (answer.code === 'reauthentication_needed') return WORDS.codeTooOld;
    if (answer.code === 'same_password') return WORDS.samePassword;
    if (answer.code === 'weak_password') return WORDS.weakPassword;
    return WORDS.notSaved;
  }

  window.AccountSignInWords = Object.freeze({ WORDS, PROBLEMS, emailRefusal, signInRefusal, codeRefusal, passwordRefusal });
})();
