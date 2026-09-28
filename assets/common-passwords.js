// Checks a new password against common-passwords.txt, the same list as the
// extension's background/common-passwords.txt (built by TabSentry's
// scripts/build-common-passwords.mjs). The ~450 KB list loads on the first
// check. If it can't load, the password is allowed.
(() => {
  let pending = null;
  window.isCommonPassword = async password => {
    pending ??= fetch('assets/common-passwords.txt?v=202609281')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(text => new Set(text.split(/\r?\n/).filter(Boolean)));
    try {
      return (await pending).has(String(password || '').toLowerCase());
    } catch {
      pending = null;
      return false;
    }
  };
  window.COMMON_PASSWORD_MESSAGE = 'That password is too common. Choose one that’s harder to guess.';
})();
