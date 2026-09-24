"""Regression check for the [ACCESS_CODE] shape rule (2026-09-24)."""
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
    # conservative behaviour: the run isn't a hex id, so the pair is treated as
    # a code). Kept as a documented expectation, not a regression.
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

print(f"\n{len(MUST_SURVIVE)} survive-checks, {len(MUST_REDACT)} redact-checks, {fails} failures")
sys.exit(1 if fails else 0)
