// Checks a new password against common-passwords.txt, the same list as the
// extension's background/common-passwords.txt (built by TabSentry's
// scripts/build-common-passwords.mjs). build_site.py copies that file next to
// this script, so the list loads from beside it with the script's own build
// version (serve.py serves it there in a prototype preview). The ~450 KB list
// loads on the first check. If it can't load, the password is allowed.
(() => {
  const src = document.currentScript?.src || location.href;
  const list = new URL(`common-passwords.txt${new URL(src).search}`, src);
  let pending = null;
  window.isCommonPassword = async password => {
    pending ??= fetch(list)
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
