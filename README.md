# tabsidecar-website

The published tabsidecar.com and account.tabsidecar.com. Every file here except this
README, `CNAME`, `design-philosophy.md` and `icons/render-*.html` is written by
`TabSentry/website/build_site.py`; change the prototypes there and rebuild.

## Cloudflare Pages (TabSentry#554)

Two Pages projects build from this repo's `main`. Each runs `deploy_check.py` as its
build command: it checks the headers the site will send (`_headers`) and refuses the
deploy if a check fails, then stages only the files `publish.txt` lists.

| Project | Domain | Build command | Build output directory |
|---|---|---|---|
| tabsidecar | tabsidecar.com (`www` redirects to it) | `python3 deploy_check.py main _site` | `_site` |
| tabsidecar-account | account.tabsidecar.com | `python3 deploy_check.py account _account` | `_account` |

`python3 deploy_check.py main --check` runs the checks without staging.
