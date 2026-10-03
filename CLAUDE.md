# MyPsyApp

Private-clinic manager for Valerie (patients, sessions, payments, notes). The whole app is `index.html` — React from a pinned CDN, Hebrew RTL UI, data in localStorage/IndexedDB with optional Google Drive sync. Older `index_v*.html` files are past snapshots; don't edit them.

## Release rule — every PR bumps the version

- Every pull request bumps `APP_VERSION` in `index.html` (shown at the bottom of Settings as "גרסה X.Y"). Minor bump per PR: 3.7 → 3.8 → 3.9 …
- Make the bump in the branch **before** opening the PR, not after — a PR can be merged at any moment.
- Start the PR title and the main commit with the version: `v3.8 - short description`.

## Workflow

- Branch from `upstream/main`, push to the fork (`origin` = dansamak-perso/MyPsyApp), open the PR into `upstream` = valeriesamak/MyPsyApp `main`.
- Run the tests before pushing: `cd tests && npm install && npm test`. All must pass.
- Add a test under `tests/` for each bug fixed; check it fails on the old code.
- When changing the React CDN version, update the `integrity` hashes too.

## Product notes

- Payment reminders are opt-in (`settings.showPaymentReminders`, off by default) — Valerie doesn't want them. Don't turn them back on by default.
