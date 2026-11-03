"""Check a built TabSidecar site, then stage exactly what Cloudflare Pages publishes (TabSentry#554).

    python3 deploy_check.py main <out>      tabsidecar.com: the folder this file is in
    python3 deploy_check.py account <out>   account.tabsidecar.com: its account/ folder
    python3 deploy_check.py main --check    check only, stage nothing
    python3 deploy_check.py main --headers /a /b ...   the headers Pages would send on
                                            each path, as JSON (website-check.mjs serves them)

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
    Cache-Control: no-store and Referrer-Policy: no-referrer. A page that looks like an
    account page and isn't marked is refused;
  - no header set twice for a page (Pages would join the values with a comma).
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


def headers_for(rules, path):
    """The headers Pages sends on a path, and the names more than one rule set (which Pages
    joins with a comma). Mirrors Pages' attachHeaders: matching rules in file order, each
    removing its "! Name" headers, then setting its own (appending to one already set)."""
    headers, set_once, twice = {}, set(), set()
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
    return headers, twice


def policy(value):
    """A CSP header as {directive: sources}."""
    directives = (d.strip().split(None, 1) for d in value.split(';') if d.strip())
    return {d[0].lower(): (d[1] if len(d) > 1 else '') for d in directives}


def connect_problems(csp):
    loose = [s for s in csp.get('connect-src', '').split() if s != "'self'" and not re.match(r'^https://[a-z0-9.-]+$', s, re.I)]
    return [f'CSP connect-src allows {" ".join(loose)}; only \'self\' and https origins'] if loose else []


def page_problems(headers, twice, account):
    """What one page's headers lack, as Pages would send them."""
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
    for name, value in wanted.items():
        if csp.get(name) != value:
            problems.append(f'CSP {name} is "{csp.get(name, "missing")}", wanted "{value}"')
    if not account and csp.get('frame-ancestors') not in FRAME_ANCESTORS_SITE:
        problems.append(f'CSP frame-ancestors is "{csp.get("frame-ancestors", "missing")}", wanted one of {", ".join(FRAME_ANCESTORS_SITE)}')
    problems += connect_problems(csp)
    referrer = headers.get('referrer-policy', '')
    if account:
        if referrer != 'no-referrer':
            problems.append(f'Referrer-Policy is "{referrer}", wanted "no-referrer"')
        if 'no-store' not in headers.get('cache-control', '').lower():
            problems.append(f'Cache-Control is "{headers.get("cache-control", "")}", wanted no-store')
    elif referrer not in SITE_REFERRER:
        problems.append(f'Referrer-Policy is "{referrer}", wanted one of {", ".join(SITE_REFERRER)}')
    return problems


def page_paths(name):
    """The addresses Pages answers a page at: /x.html redirects to /x, both carry headers."""
    stem = name[:-len('.html')]
    paths = [f'/{name}', f'/{stem}']
    if name == 'index.html':
        paths = ['/', '/index.html']
    elif name.endswith('/index.html'):
        paths = [f'/{name}', f'/{stem[:-len("index")]}']
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


def check(site, read):
    """Every problem with a site, where read(path) gives a file's text (None when missing).
    site is 'main' or 'account'."""
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
        if not path.endswith('.html'):
            continue
        looks_account = any(sign.search(text) for sign in ACCOUNT_SIGNS)
        if looks_account and not marked and site == 'main':
            problems.append(f'{path}: an account page (password field, CSP meta tag or account-page.js) that {MANIFEST} does not mark "{ACCOUNT_MARK}"')
        account = marked or looks_account or site == 'account'
        for address in page_paths(path):
            headers, twice = headers_for(rules, address)
            problems += [f'{address}: {p}' for p in page_problems(headers, twice, account)]
    if site == 'account' and '404.html' not in files:
        problems.append('no 404.html: Pages would answer every unknown address with index.html')
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
    problems = check(site, disk_reader(root))
    if problems:
        sys.exit(f'Refused: the {site} site fails its checks:\n  ' + '\n  '.join(problems))
    print(f'The {site} site passes its checks.')
    if args[1] != '--check':
        stage(root, pathlib.Path(args[1]).resolve())


if __name__ == '__main__':
    main()
