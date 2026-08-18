# Security

ReproMin is a local CLI. It runs Playwright against whatever site your test already hits. It does not upload traces, tests, or credentials.

## Report a vulnerability

Please **do not** open a public issue for a leak or exploit.

Email the maintainer via GitHub: [robbyczgw-cla](https://github.com/robbyczgw-cla), or use [GitHub private vulnerability reporting](https://github.com/robbyczgw-cla/repromin/security/advisories/new) if it is enabled.

Include:

- what is exposed (token, file, unexpected network call)
- a minimal reproduction
- whether the secret is already in git history

## What not to commit

- `.env`, API keys, `*.pem`, `credentials.json`, npm tokens
- Playwright traces or screenshots from a real logged-in session
- minimized specs that still contain session cookies or customer data

`npm run check:leaks` is a cheap scan, not a substitute for review before you flip the repo to public.
