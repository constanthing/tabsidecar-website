// Section windows collapse like the popup's window cards; ⋮ lists them all.
document.addEventListener('DOMContentLoaded', () => {
  const wins = [...document.querySelectorAll('.swin')];
  document.addEventListener('click', e => {
    const caret = e.target.closest('.swin-head .caret');
    if (caret) caret.closest('.swin').classList.toggle('closed');
    const all = e.target.closest('[data-all]');
    if (all) wins.forEach(w => w.classList.toggle('closed', all.dataset.all === 'close'));
  });
  const links = '<div class="hdr">Jump to</div>' + wins.map(w =>
    `<a href="#${w.id}" style="--c:${w.classList.contains('neutral') ? 'var(--border-strong)' : getComputedStyle(w).getPropertyValue('--wc')}"><i></i>${w.querySelector('.swin-title').textContent}</a>`).join('');
  document.querySelectorAll('[data-jump]').forEach(n => { n.innerHTML = links; });
  // Opening a collapsed section from a link expands it.
  addEventListener('hashchange', () => document.querySelector(location.hash)?.classList.remove('closed'));
});
