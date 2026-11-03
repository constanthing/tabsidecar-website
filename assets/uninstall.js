// The uninstall page's feedback form: sends the picked reasons and the note to
// Supabase's uninstall_feedback table (moved out of uninstall.html so the site-wide
// CSP can allow only the site's own script files, TabSentry#554).
const SUPABASE_URL = 'https://quqhdnkypnuxvmibnzhn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2O_Jk16JhJLmK7bFtLHsNQ_ifUzkz1Z';
// Keep in step with the table's checks (supabase/migrations/20261030_uninstall_feedback.sql).
const NOTE_MAX = 500;
const VERSION_PATTERN = /^[0-9]{1,5}(\.[0-9]{1,5}){0,3}$/;
const SENT_KEY = 'uninstallFeedbackSent';  // this tab's session storage: a reload can't send it twice

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const form = $('feedback-form'), send = $('send'), statusEl = $('status'), note = $('note');
  const reasonButtons = [...document.querySelectorAll('[data-reason]')];
  const icon = n => window.TS ? TS.icon(n) : '';

  // The version the extension put in the address, if it looks like one.
  const asked = new URLSearchParams(location.search).get('v');
  const version = asked && asked.length <= 20 && VERSION_PATTERN.test(asked) ? asked : null;

  const view = name => ['Form', 'Sent'].forEach(v => { $('view' + v).hidden = v !== name; });
  const status = text => {
    if (!text) { statusEl.hidden = true; return; }
    statusEl.className = 'status err';
    statusEl.innerHTML = `${icon('x')}<span></span>`;
    statusEl.querySelector('span').innerHTML = text;
    statusEl.hidden = false;
  };
  const busy = on => {
    send.disabled = on;
    send.innerHTML = on ? '<span class="spin"></span>Sending…' : 'Send';
    note.disabled = on;
    reasonButtons.forEach(b => { b.disabled = on; });
  };
  const sentView = again => {
    $('sentTitle').textContent = again ? 'Already sent' : 'Thanks for telling us';
    $('sentCopy').textContent = again ? 'Your answer from this page was already sent, so it isn’t sent twice. Thanks again.' : 'Your answer was sent.';
    view('Sent');
  };
  const picked = () => reasonButtons.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.reason);
  const countNote = () => { $('noteCount').textContent = `${note.value.length}/${NOTE_MAX}`; };
  const alreadySent = () => { try { return sessionStorage.getItem(SENT_KEY) === '1'; } catch { return false; } };
  const markSent = () => { try { sessionStorage.setItem(SENT_KEY, '1'); } catch { /* the page still refuses until it reloads */ } };

  reasonButtons.forEach(b => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    status(null);
  }));
  note.addEventListener('input', () => { countNote(); status(null); });

  let sending = false, sent = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    if (sent || alreadySent()) return sentView(true);
    const reasons = picked();
    const text = note.value.trim().slice(0, NOTE_MAX);
    if (!reasons.length && !text) return status('Pick a reason or write a note first.');
    sending = true; busy(true); status(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/uninstall_feedback`, {
        method: 'POST',
        referrerPolicy: 'no-referrer',
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ reasons, note: text || null, extension_version: version })
      });
      if (!res.ok) {
        const body = await res.text();
        if (body.includes('uninstall_feedback_rate_limited')) {
          return status('A lot of answers arrived in the last hour, so we couldn’t take yours. Please try again later, or email <a href="mailto:support@tabsidecar.com">support@tabsidecar.com</a>.');
        }
        throw new Error(`HTTP ${res.status}`);
      }
      sent = true; markSent(); sentView(false);
    } catch (err) {
      console.warn('[TabSidecar] Could not send uninstall feedback:', err);
      status('We couldn’t send that. Try again, or email <a href="mailto:support@tabsidecar.com">support@tabsidecar.com</a>.');
    } finally {
      sending = false; busy(false);
    }
  });

  countNote();
  if (alreadySent()) sentView(true); else view('Form');

});
