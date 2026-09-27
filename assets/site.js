// Page background and the nav's scrolled state. In the prototypes it also adds
// the prototype switcher bar (the parts between proto markers, which
// website/build_site.py strips when it builds the live site).
// Load in <head> (not deferred) so the background is set before first paint.
// Each page names its layout and default background on <html>:
//   <html data-variant="paper" data-bg="paper">
// and ?bg=<name> tries any background with any layout.
(function () {
  const BGS = {
    paper: ['#f6f7f9', 'light', 'Paper'],
    white: ['#ffffff', 'light', 'White'],
    fog: ['#eef0f3', 'light', 'Fog'],
    graphite: ['#111317', 'dark', 'Graphite'],
    ink: ['#0b0c0f', 'dark', 'Ink'],
  };
  const root = document.documentElement;
  let asked = null;
  const bg = BGS[asked] ? asked : root.dataset.bg in BGS ? root.dataset.bg : 'paper';
  const [color, theme] = BGS[bg];
  root.dataset.bg = bg;
  root.dataset.theme = theme;
  root.style.setProperty('--bg', color);

  document.addEventListener('DOMContentLoaded', () => {

    const nav = document.querySelector('.site-nav.lined');
    if (nav) {
      const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });
})();
