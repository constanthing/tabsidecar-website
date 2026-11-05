"""Check a built TabSidecar site, then stage exactly what Cloudflare Pages publishes (TabSentry#554).

    python3 deploy_check.py main <out>      tabsidecar.com: the folder this file is in
    python3 deploy_check.py account <out>   account.tabsidecar.com: its account/ folder
    python3 deploy_check.py main --check    check only, stage nothing
    python3 deploy_check.py main --headers /a /b ...   the headers Pages would send on
                                            each path, as JSON (website-check.mjs serves them)
    python3 deploy_check.py main --redirects   the _redirects rules, as JSON
                                            {source: [destination, status]}

Each Cloudflare Pages project runs this as its build command and publishes <out>, so a
site that fails a check is never deployed. build_site.py (TabSentry/website) copies this
file into the website repo and runs the same checks before it writes anything.

The checks, on the headers Pages will send (_headers, merged as Pages merges them):
  - every page: HSTS (max-age of at least HSTS_MIN_AGE, includeSubDomains, no preload),
    X-Content-Type-Options: nosniff, a Referrer-Policy, a Permissions-Policy with the
    camera, microphone and geolocation off, and a CSP with SITE_POLICY;
  - every account page (all pages of the account site; on the main site the pages
    publish.txt marks "account", and any page with a password field, a CSP meta tag or
    the account pages' script): ACCOUNT_POLICY (frame-ancestors 'none' among it),
    Cache-Control: no-store (except on a 404 answer, where Pages removes it),
    Referrer-Policy: no-referrer, and no Access-Control-Allow-Origin (Pages sends "*"
    unless _headers removes it). A page that looks like an account page and isn't
    marked is refused;
  - no header set twice for a page (Pages would join the values with a comma), and no
    path with two rules;
  - the account site names no extension ID but TabSidecar's store IDs (STORE_EXTENSION_IDS,
    TabSentry#578): its pages hand a signed-in session to the ID they name, and an
    unpacked extension's ID comes from its folder path, so anyone can make one. An
    unpacked extension can also claim any ID, the store's included, through its
    manifest's "key" (this needs Developer mode): the list stops the site talking to an
    unknown ID, not a Developer-mode copy that claims the store's;
  - on the account site, the hand-over script's EXTENSION_IDS is exactly those IDs, no
    other file calls runtime.sendMessage or runtime.connect, and every page's first
    script is the plain hand-over tag (HANDOVER_TAG), with only <html>, <head>, <meta>,
    comments, <noscript> and <template> before it: it takes the one-time code out of the
    address before any other script can read it;
  - every account page's scripts (TabSentry#579): each a <script src> of a file the site
    publishes under assets/ (with ?v=N), or exactly TURNSTILE_SCRIPT; no inline script,
    event handler attribute or javascript: address. A page that loads Turnstile has its
    origin in script-src and frame-src, exactly; any other account page has neither. A
    page's CSP meta tag says what its header says, frame-ancestors aside (a meta tag
    can't carry it);
  - the account site's pages and scripts keep nothing and never refresh a session: no
    localStorage, sessionStorage, indexedDB, document.cookie or Cache Storage, no
    refresh-token grant or refreshSession, and a supabase-js createClient only with
    persistSession, autoRefreshToken and detectSessionInUrl false. A page that hands a
    session to TabSidecar (its scripts name handOver) never signs it out: no signOut(),
    and /logout only as /logout?scope=others. The page and TabSidecar share that
    session (docs: sign-in-hand-over.md, "The shared session");
  - only the delete page (delete-account.html) and its scripts name delete_my_account
    (TabSentry#580);
  - _redirects (TabSentry#186): the main site publishes one with REQUIRED_REDIRECTS,
    each old account page address to the same page on the account site, and the
    account site publishes none. Every rule is a plain path (no splat, placeholder,
    query or fragment) to a page on ACCOUNT_ORIGIN with no query or fragment of its own,
    so the browser keeps the link's #fragment, where Supabase puts the token; its status
    is a redirect (301, 302, 303, 307 or 308; none is 302), never a 200 rewrite; no
    path has two rules; and no published page answers at a redirected path (Pages
    follows a redirect even where a file matches).
The allow-list: publish.txt names every file the site publishes, and only those are
staged. A listed file that is missing, a dot file and a path outside the site are refused.
"""
import json
import pathlib
import re
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
SITES = {'main': HERE, 'account': HERE / 'account'}
MANIFEST = 'publish.txt'
HEADERS_FILE = '_headers'
REDIRECTS_FILE = '_redirects'
ACCOUNT_MARK = 'account'

HSTS_MIN_AGE = 300  # seconds: the first deploy's value (docs: the move checklist)
SITE_POLICY = {
    'default-src': "'self'",
    'script-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'none'",
}
FRAME_ANCESTORS_SITE = ("'self'", "'none'")
ACCOUNT_POLICY = dict(SITE_POLICY, **{'form-action': "'none'", 'frame-ancestors': "'none'"})
SITE_REFERRER = ('strict-origin-when-cross-origin', 'strict-origin', 'same-origin', 'no-referrer')
FEATURES_OFF = ('camera=()', 'microphone=()', 'geolocation=()')
# What makes a page an account page, whatever publish.txt says.
ACCOUNT_SIGNS = [
    re.compile(r'<input[^>]*\stype=["\']?password', re.I),
    re.compile(r'http-equiv=["\']?Content-Security-Policy', re.I),
    re.compile(r'account-page\.js'),
]
# An address no page has: the 404 page's headers are those Pages sends there.
UNKNOWN_PATH = '/no-such-page-554'
# What Pages sends on every answer before _headers applies (its attachHeaders).
PAGES_DEFAULTS = {'access-control-allow-origin': '*'}
# TabSidecar's IDs in the browsers' stores, the only ones the account site may talk to:
# the Chrome Web Store's, its only store. A listing in another store (Edge Add-ons) adds
# its ID here and in account-handover.js.
STORE_EXTENSION_IDS = ('fcgiclcbpjeccamoihlbhcihommdfame',)
# An extension ID: 32 letters a to p, standing alone.
EXTENSION_ID = re.compile(r'(?<![A-Za-z0-9_-])[a-p]{32}(?![A-Za-z0-9_-])')
# The hand-over script (TabSentry#578), the only account site file that talks to the
# extension, and its list of the IDs it talks to, as the source writes it.
HANDOVER_FILE = 'assets/account-handover.js'
EXTENSION_IDS_LIST = re.compile(r'\bconst\s+EXTENSION_IDS\s*=\s*\[([^\]]*)\]')
QUOTED = re.compile(r"""'([^'\\]*)'|"([^"\\]*)\"""")
# Talking to the extension, however it is written: any use of the runtime API
# (chrome.runtime, chrome?.runtime, chrome['runtime'], api.runtime after an alias), and
# sendMessage by name (destructured, or as a string key). Words in a page's text don't
# match: "runtime" must follow a dot or be a quoted key.
EXTENSION_API = re.compile(r'''(?:\?\.|\.)runtime\b|\[\s*['"`]runtime['"`]\s*\]|\bsendMessage\b''')
# An account page's start: what may come before the hand-over tag, which must follow.
# Anything else there (another script, defer or async, a <title>, <style> or attribute
# the tag could hide in, which would keep it from running first) is refused. Comments,
# <noscript> and <template> (none nested) never run, so they may hold anything. Each part
# ends where the browser ends it (a comment at its first --> or --!>), and only one way
# of reading the start fits, so a page that fails is refused at once.
PAGE_START_PARTS = [
    r'<!doctype html>',
    r'<!--(?:-?>|(?:(?!--!?>).)*--!?>)',
    r'<noscript\b[^>]*>(?:(?!<noscript\b|</noscript\b).)*</noscript\s*>',
    r'<template\b[^>]*>(?:(?!<template\b|</template\b).)*</template\s*>',
    r'</?(?:html|head|meta)(?:\s+[a-z-]+(?:="[^"<>]*")?)*\s*/?>',
]
# A page's link to one of the site's own files under assets/ (from the root or the page).
ASSET_LINK = re.compile(r'''(?:src|href)=["']/?(assets/[^"'?#]+)''', re.I)
HANDOVER_TAG = r'<script src="/assets/account-handover\.js\?v=\d+"></script>'
# Cloudflare Turnstile (TabSentry#579): the one script an account page may load from
# elsewhere, exactly this tag's src, and the origin its CSP then allows.
TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'
TURNSTILE_SCRIPT = f'{TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit'
# An account page's scripts: every <script> tag, and the srcs it may have (a file of the
# site's own, from the root or the page, with its build version).
SCRIPT_TAG = re.compile(r'<script\b[^>]*>', re.I)
SCRIPT_SRC = re.compile(r'''\ssrc\s*=\s*["']([^"']*)["']''', re.I)
OWN_SCRIPT = re.compile(r'/?(assets/[\w.-]+\.js)\?v=\d+')
INLINE_HANDLER = re.compile(r'<[^>]+\son[a-z]+\s*=', re.I)
SCRIPT_URL = re.compile(r'''(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:''', re.I)
CSP_META = re.compile(r'''<meta\s+http-equiv=["']?Content-Security-Policy["']?\s+content="([^"]*)"''', re.I)
# What would keep something on the device, or refresh the shared session.
STORAGE = re.compile(r'\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\s*\.\s*cookie\b|\bcaches\s*\.')
REFRESH = re.compile(r'grant_type=refresh_token|\brefreshSession\b')
CREATE_CLIENT = re.compile(r'\bcreateClient\s*\(')
CLIENT_SETTINGS = ('persistSession', 'autoRefreshToken', 'detectSessionInUrl')
# On a page that hands a session over: a sign-out of it.
HANDS_OVER = re.compile(r'\bhandOver\b')
SIGN_OUT = re.compile(r'(?<![\w$])signOut\s*\(|/logout(?!\?scope=others(?![\w&=]))')
# Deleting the account (TabSentry#580): only the delete page's scripts may name it, so a
# bug or a stray script on any other account page can't reach it.
DELETES_ACCOUNT = re.compile(r'\bdelete_my_account\b')
DELETE_PAGE = 'delete-account.html'
# The old tabsidecar.com account pages' addresses (TabSentry#186), with and without
# .html and a trailing slash, and where each now answers. Links in emails sent before
# TabSentry#578, and older TabSidecar versions' resets, still open them.
ACCOUNT_ORIGIN = 'https://account.tabsidecar.com'
REQUIRED_REDIRECTS = {f'/{page}{ending}': f'{ACCOUNT_ORIGIN}/{page}'
                      for page in ('reset-password', 'email-confirmed') for ending in ('', '.html', '/')}
REDIRECT_STATUS = 302
REDIRECT_STATUSES = (301, 302, 303, 307, 308)
PLAIN_SOURCE = re.compile(r'/[A-Za-z0-9._/-]*')
ACCOUNT_DESTINATION = re.compile(re.escape(ACCOUNT_ORIGIN) + r'/[A-Za-z0-9._/-]*')
HANDOVER_FIRST = re.compile(rf'(?i:\s*(?:{"|".join(PAGE_START_PARTS)}))*\s*{HANDOVER_TAG}', re.S)


def read_rules(text):
    """_headers as a list of (path pattern, {name: value} set, [names] unset), in file
    order. Refuses what this check can't evaluate as Pages does (placeholders, other hosts)."""
    rules, problems = [], []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if not line[0].isspace():
            if not line.startswith('/') or ':' in line:
                problems.append(f'_headers line {number}: "{line}" is not a path this check reads (a /path, * allowed)')
            if any(rule[0] == line.strip() for rule in rules):
                problems.append(f'_headers line {number}: "{line.strip()}" has a rule already; Pages keys rules by path')
            rules.append((line.strip(), {}, []))
            continue
        if not rules:
            problems.append(f'_headers line {number}: a header before any path')
            continue
        entry = line.strip()
        if entry.startswith('!'):
            rules[-1][2].append(entry[1:].strip().lower())
        elif ':' in entry:
            name, value = entry.split(':', 1)
            rules[-1][1][name.strip().lower()] = value.strip()
        else:
            problems.append(f'_headers line {number}: "{entry}" is not "Name: value" or "! Name"')
    return rules, problems


def matches(pattern, path):
    regex = '^' + '.*'.join(re.escape(part) for part in pattern.split('*')) + '$'
    return re.match(regex, path) is not None


def headers_for(rules, path, not_found=False):
    """The headers Pages sends on a path, and the names more than one rule set (which Pages
    joins with a comma). Mirrors Pages' attachHeaders: its defaults, then matching rules in
    file order, each removing its "! Name" headers, then setting its own (appending to one
    already set); on a 404 answer it removes Cache-Control."""
    headers, set_once, twice = dict(PAGES_DEFAULTS), set(), set()
    for pattern, set_headers, unset in rules:
        if not matches(pattern, path):
            continue
        for name in unset:
            headers.pop(name, None)
        for name, value in set_headers.items():
            if name in set_once and name in headers:
                headers[name] += ', ' + value
                twice.add(name)
            else:
                headers[name] = value
                set_once.add(name)
    if not_found:
        headers.pop('cache-control', None)
    return headers, twice


def policy(value):
    """A CSP header as {directive: sources}."""
    directives = (d.strip().split(None, 1) for d in value.split(';') if d.strip())
    return {d[0].lower(): (d[1] if len(d) > 1 else '') for d in directives}


def connect_problems(csp):
    loose = [s for s in csp.get('connect-src', '').split() if s != "'self'" and not re.match(r'^https://[a-z0-9.-]+$', s, re.I)]
    return [f'CSP connect-src allows {" ".join(loose)}; only \'self\' and https origins'] if loose else []


def page_problems(headers, twice, account, not_found=False, turnstile=False):
    """What one page's headers lack, as Pages would send them (not_found: a 404 answer;
    turnstile: an account page that loads Turnstile)."""
    problems = [f'{name} is set by more than one rule' for name in sorted(twice)]
    hsts = headers.get('strict-transport-security', '')
    age = re.search(r'max-age=(\d+)', hsts)
    if not age or int(age.group(1)) < HSTS_MIN_AGE or 'includesubdomains' not in hsts.lower():
        problems.append(f'HSTS is "{hsts}", wanted max-age of at least {HSTS_MIN_AGE} and includeSubDomains')
    if 'preload' in hsts.lower():
        problems.append('HSTS has preload, not wanted yet')
    if headers.get('x-content-type-options', '').lower() != 'nosniff':
        problems.append('no X-Content-Type-Options: nosniff')
    features = headers.get('permissions-policy', '').replace(' ', '')
    problems += [f'Permissions-Policy lacks {f}' for f in FEATURES_OFF if f not in features]
    csp_header = headers.get('content-security-policy', '')
    if not csp_header:
        return problems + ['no Content-Security-Policy']
    csp = policy(csp_header)
    wanted = ACCOUNT_POLICY if account else SITE_POLICY
    if account:
        wanted = account_policy(turnstile)
    for name, value in wanted.items():
        if csp.get(name) != value:
            problems.append(f'CSP {name} is "{csp.get(name, "missing")}", wanted "{value}"')
    if account and not turnstile and 'frame-src' in csp:
        problems.append(f'CSP frame-src is "{csp["frame-src"]}" on a page that loads no Turnstile, wanted none')
    if not account and csp.get('frame-ancestors') not in FRAME_ANCESTORS_SITE:
        problems.append(f'CSP frame-ancestors is "{csp.get("frame-ancestors", "missing")}", wanted one of {", ".join(FRAME_ANCESTORS_SITE)}')
    problems += connect_problems(csp)
    referrer = headers.get('referrer-policy', '')
    if account:
        if referrer != 'no-referrer':
            problems.append(f'Referrer-Policy is "{referrer}", wanted "no-referrer"')
        if not not_found and 'no-store' not in headers.get('cache-control', '').lower():
            problems.append(f'Cache-Control is "{headers.get("cache-control", "")}", wanted no-store')
        if 'access-control-allow-origin' in headers:
            problems.append(f'Access-Control-Allow-Origin is "{headers["access-control-allow-origin"]}", wanted none ("! Access-Control-Allow-Origin")')
    elif referrer not in SITE_REFERRER:
        problems.append(f'Referrer-Policy is "{referrer}", wanted one of {", ".join(SITE_REFERRER)}')
    return problems


def account_policy(turnstile):
    """ACCOUNT_POLICY, with Turnstile's origin in script-src and frame-src for a page
    that loads it."""
    if not turnstile:
        return ACCOUNT_POLICY
    return dict(ACCOUNT_POLICY, **{'script-src': f"'self' {TURNSTILE_ORIGIN}", 'frame-src': TURNSTILE_ORIGIN})


def loads_turnstile(text):
    return any(SCRIPT_SRC.search(tag) and SCRIPT_SRC.search(tag).group(1) == TURNSTILE_SCRIPT
               for tag in SCRIPT_TAG.findall(text))


def script_problems(path, text, files):
    """An account page's scripts that aren't the site's own published files or Turnstile's,
    and anything that runs script inline."""
    problems = []
    for tag in SCRIPT_TAG.findall(text):
        src = SCRIPT_SRC.search(tag)
        if not src:
            problems.append(f'{path}: an inline <script>; an account page runs only files')
            continue
        own = OWN_SCRIPT.fullmatch(src.group(1))
        if src.group(1) != TURNSTILE_SCRIPT and not (own and own.group(1) in files):
            problems.append(f'{path}: loads the script "{src.group(1)}", neither a published assets/ file (?v=N) nor {TURNSTILE_SCRIPT}')
    if INLINE_HANDLER.search(text):
        problems.append(f'{path}: an inline event handler attribute (on...=)')
    if SCRIPT_URL.search(text):
        problems.append(f'{path}: a javascript: address')
    return problems


def meta_problems(path, text, header_csp):
    """A page's CSP meta tag, unless it says what its header says (frame-ancestors aside)."""
    metas = CSP_META.findall(text)
    if not metas:
        return []
    wanted = {name: value for name, value in policy(header_csp).items() if name != 'frame-ancestors'}
    if len(metas) > 1 or policy(metas[0]) != wanted:
        return [f'{path}: its CSP meta tag says "{"; ".join(metas)}", not what its header says']
    return []


def keeping_problems(path, text):
    """An account site file that keeps something or refreshes a session."""
    problems = []
    if STORAGE.search(text):
        problems.append(f'{path}: uses storage ({STORAGE.search(text).group(0)}); an account page keeps nothing')
    if REFRESH.search(text):
        problems.append(f'{path}: refreshes a session ({REFRESH.search(text).group(0)}); TabSidecar refreshes the shared session')
    for call in CREATE_CLIENT.finditer(text):
        settings = text[call.end():call.end() + 600]
        unset = [name for name in CLIENT_SETTINGS if not re.search(rf'\b{name}\s*:\s*false\b', settings)]
        if unset:
            problems.append(f'{path}: createClient without {", ".join(unset)} false')
    return problems


def handover_problems(path, scripts):
    """A page that hands a session over (scripts: {path: text} of the page and its own
    scripts, the hand-over script aside) and signs a session out."""
    if not any(HANDS_OVER.search(text) for text in scripts.values()):
        return []
    return [f'{path}: hands a session to TabSidecar, and {name} signs out ({SIGN_OUT.search(text).group(0)}); '
            'only /logout?scope=others before the hand-over'
            for name, text in sorted(scripts.items()) if SIGN_OUT.search(text)]


def delete_problems(path, scripts):
    """A page other than the delete page whose own text or scripts name the account
    deletion (scripts: {path: text})."""
    if path == DELETE_PAGE:
        return []
    return [f'{path}: {name} names delete_my_account; only {DELETE_PAGE} may'
            for name, text in sorted(scripts.items()) if DELETES_ACCOUNT.search(text)]


def account_page_problems(path, text, read, files):
    """An account page's scripts, on a hand-over page its sign-outs, and the account
    deletion anywhere but the delete page."""
    problems = script_problems(path, text, files)
    scripts = {path: text}
    for tag in SCRIPT_TAG.findall(text):
        src = SCRIPT_SRC.search(tag)
        own = src and OWN_SCRIPT.fullmatch(src.group(1))
        if own and own.group(1) in files and own.group(1) != HANDOVER_FILE:
            scripts[own.group(1)] = read(own.group(1)) or ''
    return problems + handover_problems(path, scripts) + delete_problems(path, scripts)


def page_paths(name):
    """The addresses Pages answers a page at: /x.html redirects to /x, both carry headers."""
    stem = name[:-len('.html')]
    paths = [f'/{name}', f'/{stem}']
    if name == 'index.html':
        paths = ['/', '/index.html']
    if name == '404.html':
        paths.append(UNKNOWN_PATH)
    return paths


def read_manifest(text):
    """publish.txt as {path: marked account}, and its problems."""
    files, problems = {}, []
    for number, line in enumerate(text.splitlines(), 1):
        words = line.split('#', 1)[0].split()
        if not words:
            continue
        path, marks = words[0], words[1:]
        parts = path.split('/')
        if path.startswith('/') or any(p in ('', '..') or p.startswith('.') for p in parts):
            problems.append(f'publish.txt line {number}: "{path}" is not a plain path inside the site')
        elif marks not in ([], [ACCOUNT_MARK]):
            problems.append(f'publish.txt line {number}: unknown mark "{" ".join(marks)}"')
        files[path] = bool(marks)
    return files, problems


def extension_id_problems(path, text, test_ids):
    """The extension IDs in one account site file that aren't TabSidecar's store IDs."""
    allowed = set(STORE_EXTENSION_IDS) | set(test_ids)
    found = sorted(set(EXTENSION_ID.findall(text)) - allowed)
    return [f'{path}: names the extension ID {found_id}, not one of TabSidecar\'s store IDs' for found_id in found]


def extension_list_problems(text, test_ids):
    """The hand-over script's EXTENSION_IDS, unless it is one list of exactly the store IDs
    (and test_ids), each quoted: the ID scan can't see one built some other way."""
    lists = EXTENSION_IDS_LIST.findall(text)
    if len(lists) != 1:
        return [f'{HANDOVER_FILE}: has {len(lists)} "const EXTENSION_IDS = [...]" lists, wanted exactly one']
    ids = {single or double for single, double in QUOTED.findall(lists[0])}
    unquoted = QUOTED.sub('', lists[0]).replace(',', '').strip()
    wanted = set(STORE_EXTENSION_IDS) | set(test_ids)
    if unquoted or ids != wanted:
        return [f'{HANDOVER_FILE}: EXTENSION_IDS is [{lists[0].strip()}], wanted the quoted IDs {", ".join(sorted(wanted))}']
    return []


def account_file_problems(path, text, test_ids):
    """One account site file: the extension IDs it names, whether it talks to the extension
    though it isn't the hand-over script, and for a page whether that script runs first."""
    problems = extension_id_problems(path, text, test_ids)
    if path == HANDOVER_FILE:
        return problems + extension_list_problems(text, test_ids)
    problems += keeping_problems(path, text)
    if EXTENSION_API.search(text):
        problems.append(f'{path}: talks to the extension (the runtime API or sendMessage); only {HANDOVER_FILE} may')
    if path.endswith('.html') and not HANDOVER_FIRST.match(text):
        problems.append(f'{path}: its first script must be account-handover.js, as <script src="/assets/account-handover.js?v=N"></script> '
                        'with only <html>, <head>, <meta>, comments, <noscript> and <template> before it, '
                        'so the code leaves the address before any other script runs')
    return problems


def read_redirects(text):
    """_redirects as {source: (destination, status)}, and its problems."""
    rules, problems = {}, []
    for number, line in enumerate(text.splitlines(), 1):
        words = line.split()
        if not words or words[0].startswith('#'):
            continue
        if len(words) not in (2, 3):
            problems.append(f'_redirects line {number}: "{line.strip()}" is not "source destination [status]"')
            continue
        source, destination = words[0], words[1]
        status = words[2] if len(words) == 3 else str(REDIRECT_STATUS)
        if not PLAIN_SOURCE.fullmatch(source):
            problems.append(f'_redirects line {number}: "{source}" is not a plain path (no splat, placeholder, query or fragment)')
        if not ACCOUNT_DESTINATION.fullmatch(destination):
            problems.append(f'_redirects line {number}: "{destination}" is not a page on {ACCOUNT_ORIGIN} without a query or fragment')
        if not status.isdigit() or int(status) not in REDIRECT_STATUSES:
            problems.append(f'_redirects line {number}: status "{status}" is not a redirect ({", ".join(map(str, REDIRECT_STATUSES))})')
        if source in rules:
            problems.append(f'_redirects line {number}: "{source}" has a rule already; the first one wins')
            continue
        rules[source] = (destination, int(status) if status.isdigit() else status)
    return rules, problems


def redirect_problems(site, read, files):
    """The site's _redirects: required on the main site with REQUIRED_REDIRECTS, refused on
    the account site, and no published page at an address it redirects."""
    if site == 'account':
        return [f'the account site publishes {REDIRECTS_FILE}; it has no redirects'] if REDIRECTS_FILE in files else []
    text = read(REDIRECTS_FILE)
    if REDIRECTS_FILE not in files or text is None:
        return [f'{MANIFEST} does not publish {REDIRECTS_FILE}, so the old account page addresses answer 404']
    rules, problems = read_redirects(text)
    for source, destination in REQUIRED_REDIRECTS.items():
        found = rules.get(source, (None,))[0]
        if found != destination:
            problems.append(f'{REDIRECTS_FILE}: {source} goes to {found or "nowhere"}, wanted {destination}')
    pages = {address: path for path in files if path.endswith('.html') for address in page_paths(path)}
    problems += [f'{REDIRECTS_FILE}: {source} redirects, and {pages[source]} is published there'
                 for source in rules if source in pages]
    return problems


def check(site, read, test_ids=()):
    """Every problem with a site, where read(path) gives a file's text (None when missing).
    site is 'main' or 'account'. test_ids: extension IDs a local test build may name
    (build_site.py --test-extension-id); the Pages build command never passes any."""
    manifest, headers_text = read(MANIFEST), read(HEADERS_FILE)
    if manifest is None or headers_text is None:
        return [f'no {MANIFEST} or {HEADERS_FILE}: not a built site']
    files, problems = read_manifest(manifest)
    rules, rule_problems = read_rules(headers_text)
    problems += rule_problems
    if HEADERS_FILE not in files:
        problems.append(f'{MANIFEST} does not list {HEADERS_FILE}')
    for path, marked in files.items():
        text = read(path)
        if text is None:
            problems.append(f'{path}: listed in {MANIFEST} and missing')
            continue
        if site == 'account':
            problems += account_file_problems(path, text, test_ids)
        if not path.endswith('.html'):
            continue
        problems += [f'{path}: links {asset}, which {MANIFEST} does not publish'
                     for asset in sorted(set(ASSET_LINK.findall(text))) if asset not in files]
        looks_account = any(sign.search(text) for sign in ACCOUNT_SIGNS)
        if looks_account and not marked and site == 'main':
            problems.append(f'{path}: an account page (password field, CSP meta tag or account-page.js) that {MANIFEST} does not mark "{ACCOUNT_MARK}"')
        account = marked or looks_account or site == 'account'
        turnstile = account and loads_turnstile(text)
        for address in page_paths(path):
            not_found = address == UNKNOWN_PATH
            headers, twice = headers_for(rules, address, not_found)
            problems += [f'{address}: {p}' for p in page_problems(headers, twice, account, not_found, turnstile)]
            if account:
                problems += [f'{address}: {p}' for p in meta_problems(path, text, headers.get('content-security-policy', ''))]
        if account:
            problems += account_page_problems(path, text, read, files)
    problems += redirect_problems(site, read, files)
    if site == 'account' and '404.html' not in files:
        problems.append('no 404.html: Pages would answer every unknown address with index.html')
    if site == 'account' and HANDOVER_FILE not in files:
        problems.append(f'{MANIFEST} does not list {HANDOVER_FILE}, which every account page loads first')
    return problems


def disk_reader(root):
    def read(path):
        file = root / path
        return file.read_text(encoding='utf-8', errors='replace') if file.is_file() else None
    return read


def stage(root, out):
    files, _ = read_manifest(disk_reader(root)(MANIFEST))
    if out.exists() and any(out.iterdir()):
        sys.exit(f'{out} is not empty; stage into a new folder.')
    for path in files:
        target = out / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / path, target)
    print(f'Staged {len(files)} files into {out}.')


def main():
    args = sys.argv[1:]
    if len(args) < 2 or args[0] not in SITES:
        sys.exit(__doc__)
    site, root = args[0], SITES[args[0]]
    if args[1] == '--headers':
        rules, _ = read_rules(disk_reader(root)(HEADERS_FILE) or '')
        print(json.dumps({path: headers_for(rules, path)[0] for path in args[2:]}))
        return
    if args[1] == '--redirects':
        rules, _ = read_redirects(disk_reader(root)(REDIRECTS_FILE) or '')
        print(json.dumps(rules))
        return
    problems = check(site, disk_reader(root))
    if problems:
        sys.exit(f'Refused: the {site} site fails its checks:\n  ' + '\n  '.join(problems))
    print(f'The {site} site passes its checks.')
    if args[1] != '--check':
        stage(root, pathlib.Path(args[1]).resolve())


if __name__ == '__main__':
    main()
