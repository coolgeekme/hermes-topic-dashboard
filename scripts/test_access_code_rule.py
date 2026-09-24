"""Regression check for the redaction shape rules.

Covers:
  * [ACCESS_CODE] rule (2026-09-24) — must not eat session UUIDs / U+ ranges.
  * admin|user|root|login pair rule (2026-09-24) — must not eat file paths.
"""
import os
import sys
sys.path.insert(0, '/root/projects/hermes-topic-dashboard/scripts')
from github_merge import redact_text  # noqa: E402

MUST_SURVIVE = [
    # Claude session UUIDs (numeric adjacent groups = the old false positive)
    "5c452665-866c-4486-9888-1a4f5b654b6c",
    "--resume 5c452665-866c-4486-9888-1a4f5b654b6c",
    "id: 11111111-2222-3333-4444-555555555555",
    "0a1b2c3d-4e5f-6789-abcd-ef0123456789",
    "UUID at start abcd-ef12-3456-7890-abcdef123456 end",

    # Unicode ranges
    "LATIN U+0152-0153, U+0131",
    "font range U+2014-2015 and U+00A0",
    # bare 4-4 that is part of a path-ish run — still redacted (pre-existing
    # conservative behavior: the run isn't a hex id, so the pair is treated as
    # a code). Kept as a documented expectation, not a regression.

    # Absolute/relative file paths — the admin|user|root|login pair rule used to
    # mangle every `/root/…` path in the corpus (6,633 of them on the live
    # dashboard). `…/root/…` is a path, never a credential pair.
    "/root/projects/cos-forge/bundles/quick-flow-plumbing-chief-of-staff/claude-code",
    "python3 /root/.hermes/scripts/topic_dashboard_refresh.py",
    "/root/.hermes/topic_dashboard_data/topics.json",
    "cd /root/projects/reggie-command-center && npx vercel --prod --yes",
    "files: /root/.hermes/cache/business-insights.json",
    "root/.hermes/state.db",
    "allowed_users: root/admin, deploy/user",
    "static/js/admin/section-headers.tsx",
    "public/img/user/red32.png",
]
MUST_REDACT_EXTRA = [
    "/backups/db-2026-0912-file",
]

MUST_REDACT = [
    "access code: YMNC-85HC",
    "test-drive code 77WH-NW9J",
    "your code is QDGX-5PH8.",
    "codes: YMNC-85HC and 77WH-NW9J",
    "\t1234-5678",
    "(ABCD-EFGH)",
    "[ABCD-EFGH]",
    "code=1234-5678",
    # admin|user|root|login credential pairs must STILL redact (whitespace form).
    "Login: admin / hunter2",
    "(admin / nextcap2026)",
    "creds → admin / test-only-change-me-1234",
    "root / hunter2-secret",
]


# standalone all-digit pair: kept redacted on purpose (indistinguishable from an
# all-numeric access code); only *embedded* pairs (in a UUID / after '+') survive.
MUST_REDACT_MARKER = ('[ACCESS_CODE]', '[REDACTED]')

fails = 0
for s in MUST_SURVIVE:
    out = redact_text(s)
    if out != s:
        fails += 1
        print(f"FAIL survive: {s!r} -> {out!r}")
for s in MUST_REDACT + MUST_REDACT_EXTRA:
    out = redact_text(s)
    if not any(m in out for m in MUST_REDACT_MARKER):
        fails += 1
        print(f"FAIL redact:  {s!r} -> {out!r}")
    elif redact_text(out) != out:
        fails += 1
        print(f"FAIL idempotent: {s!r}")

# ── Value-loader check (2026-09-24, 3rd pass) ─────────────────────────
# Live passcodes / invite codes that only appear in PROSE or markdown table
# cells are redacted by VALUE, from ~/.hermes/redaction-values.env via
# _load_env_secret_values(). That file is private and absent in CI, so this
# check self-skips when it isn't readable — the mechanism (not the secret) is
# what the test guards.
_RV = os.path.expanduser('~/.hermes/redaction-values.env')
rv_checked = 0
if os.path.exists(_RV):
    for line in open(_RV, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, val = line.split('=', 1)
        val = val.strip().strip('"').strip("'")
        rv_checked += 1
        for probe in (val, f'| Access code | {val} |', f'sha256("{val}")',
                      f'passcode gate ({val}) shipped'):
            out = redact_text(probe)
            if val in out:
                fails += 1
                print(f"FAIL value-loader: {probe!r} -> {out!r} (name={name})")
    print(f"{rv_checked} redaction-values entries checked")
else:
    print(f"note: {_RV} not present — value-loader check skipped")

print(f"\n{len(MUST_SURVIVE)} survive-checks, {len(MUST_REDACT)} redact-checks, {fails} failures")
sys.exit(1 if fails else 0)
