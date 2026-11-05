// The change-password and delete-account pages' words (TabSentry#580): a fixed sentence
// for each answer, the problem views' words, and which sentence a refused Supabase call
// gets. Nothing from Supabase or the address is ever shown. The sentences both these
// pages and the sign-in document say (unreachable, too many tries, the security check,
// the password rules) are account-sign-in-words.js's.
(() => {
  const SHARED = AccountSignInWords.WORDS;

  const WORDS = Object.freeze({
    ...SHARED,
    signedInAs: email => `Signed in to TabSidecar as ${email}.`,
    enterPassword: 'Enter your password.',
    enterCurrent: 'Enter your current password.',
    wrongPassword: 'That password is incorrect.',
    wrongCurrent: 'Your current password is incorrect.',
    sameAsCurrent: 'Choose a password different from your current one.',
    otherAccount: 'TabSidecar is signed in to another account now. Open this page from TabSidecar again.',
    signInAgain: 'For your security, enter your password again.',
    notChanged: 'Your password wasn’t changed. Try again.',
    notDeleted: 'Your account wasn’t deleted. Try again.',
    forgotten: 'TabSidecar is signed out. Your tabs and windows on this computer are kept. You can close this tab.',
    notForgotten: 'TabSidecar signs out the next time it checks your account, within the hour. Your tabs and windows on this computer are kept. You can close this tab.'
  });

  // What a page says when it can't act for TabSidecar, by whoami's answer. `what` is
  // the page's job in a sentence ("changes your password").
  const problems = what => Object.freeze({
    ...AccountSignInWords.PROBLEMS,
    'no-code': { title: 'Open this page from TabSidecar', copy: `This page ${what}, so it has to be opened from TabSidecar.`, retry: false },
    'signed-out': { title: 'TabSidecar isn’t signed in', copy: 'Sign in to TabSidecar first. Then open this page from its Account page again.', retry: false }
  });

  const unreachable = answer => answer.status === 0 || answer.status >= 500;

  // The words for a refused password sign-in with TabSidecar's own address: the password
  // is wrong (`wrong`), or a fixed sentence for the rest.
  function passwordSignInRefusal(answer, wrong) {
    if (unreachable(answer)) return WORDS.unreachable;
    if (answer.status === 429) return WORDS.tooMany;
    if (answer.code === 'captcha_failed') return WORDS.checkFailed;
    return wrong;
  }

  // The words for a refused PUT /user with the current password.
  function changeRefusal(answer) {
    if (unreachable(answer)) return WORDS.unreachable;
    if (answer.status === 429) return WORDS.tooMany;
    if (answer.code === 'current_password_mismatch') return WORDS.wrongCurrent;
    if (answer.code === 'same_password') return WORDS.sameAsCurrent;
    if (answer.code === 'weak_password') return WORDS.weakPassword;
    if (answer.code === 'reauthentication_needed') return WORDS.signInAgain;
    return WORDS.notChanged;
  }

  // The words for a refused account deletion.
  function deleteRefusal(answer) {
    if (unreachable(answer)) return WORDS.unreachable;
    if (answer.code === 'reauthentication_required') return WORDS.signInAgain;
    return WORDS.notDeleted;
  }

  window.AccountManageWords = Object.freeze({ WORDS, problems, passwordSignInRefusal, changeRefusal, deleteRefusal });
})();
