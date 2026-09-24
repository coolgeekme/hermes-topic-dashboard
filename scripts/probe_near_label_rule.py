#!/usr/bin/env python3
"""Probe: `_redact_tokens_near_label()` over-redacts — measure a candidate fix.

THE BUG (found 2026-09-24, cron run, NOT fixed yet)
---------------------------------------------------
`_redact_tokens_near_label()` (github_merge.py) redacts a quoted / backticked /
bold token when it sits within **80 chars after** any credential label
(`password|passcode|credentials|access code|pwd`). The window reaches into
ordinary prose, so a cron report that says

    "... the verification pass caught a real credential leak, which is now
     closed.\\n\\n**Refresh**\\n\\n| Item | Value |"

publishes as `**[REDACTED]**` — a mangled report heading in the PUBLIC
`data/*.json` and on the served `dist/topics.json`.

Scale, measured over `~/.hermes/topic_dashboard_data/topics.json`: the rule
redacts **639 token occurrences / 198 distinct tokens** per build. The volume is
dominated by non-credentials: `<account>` (114), `Post` (84),
`social-media-creative-production` (45), `browser_navigate` (39), `Sites` (30),
`[REDACTED]` (15), `/api/insights` (12), `file:///...`, `data/`,
`public/topics.json`, `.env`, `.gitignore` — i.e. code spans and markdown
emphasis that merely share a paragraph with the words "credential(s)" or
"password".

WHY IT ISN'T FIXED
------------------
Every tightening probed here republishes a live credential, because the loose
window is a deliberate backstop. The worst case is a *real* client admin
password sitting in prose as

    "**known password** already (`<secret>`, from the seed)"

gap = `** already (` — any rule that requires a separator-only or clause-local
gap drops it, and it is in no `.env` and no shape rule. Same for
`` passcode `Phil2026` `` / `` Access code: **CoS2026!** `` forms. So a fix has to
keep a *word-tolerant* window and can only exempt token SHAPES (e.g. `*`-only
emphasis around a pure-alphabetic word) — and that only reclaims ~60 of the 639
occurrences. Do the design work + this probe before landing anything.

Measured with this probe (whole `redact_text()` pipeline, so tokens already
covered by the value-store / shape layers are not misreported as risky):

    variant            strings changed   tokens newly published   real credentials exposed
    win=24 words-ok          305              121 (307 occ)        yes (see above)
    win=40 sep-only          340              154 (411 occ)        yes (see above)
    win=24 sep-only          340              154 (411 occ)        yes (see above)

SAFE MITIGATION ALREADY APPLIED
-------------------------------
Any credential protected *only* by this rule is fragile, so the values it is
currently covering belong in `~/.hermes/redaction-values.env` (value matching
needs no proximity). One such value was added there on 2026-09-24.

Usage: python3 scripts/probe_near_label_rule.py [raw_export.json]
"""
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import github_merge as gm  # noqa: E402

RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    "~/.hermes/topic_dashboard_data/topics.json")

TOK = gm._QUOTED_TOKEN
LABEL = gm._CRED_LABEL_CTX
ORIG = gm._redact_tokens_near_label

# gap = separators only (no words, no sentence-ending punctuation)
SEP_ONLY = re.compile(r'^[\s:=\-><*`\'"\/,|()\[\]]*$')


def build(window, sep_only):
    """A replacement `_redact_tokens_near_label` with a tighter window."""
    def fn(text):
        ends = [m.end() for m in LABEL.finditer(text)]
        if not ends:
            return text

        def repl(m):
            for e in ends:
                gap = m.start() - e
                if 0 <= gap <= window and (not sep_only or SEP_ONLY.match(text[e:m.start()])):
                    return m.group(0)[0] + '[REDACTED]' + m.group(0)[-1]
            return m.group(0)

        return TOK.sub(repl, text)
    return fn


def load_strings(path):
    out = []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    def walk(n):
        if isinstance(n, str):
            out.append(n)
        elif isinstance(n, list):
            for v in n:
                walk(v)
        elif isinstance(n, dict):
            for v in n.values():
                walk(v)

    walk(data)
    return out


def load_value_store():
    vals = set()
    for f in ("~/.hermes/redaction-values.env", "~/.hermes/.env"):
        p = os.path.expanduser(f)
        if not os.path.exists(p):
            continue
        for line in open(p, encoding="utf-8", errors="replace"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            v = line.split("=", 1)[1].strip().strip('"').strip("'")
            if len(v) >= 4:
                vals.add(v)
    return vals


def toks(text):
    return {m.group(1) for m in TOK.finditer(text)}


def main():
    strings = load_strings(RAW)
    store = load_value_store()
    print(f"raw strings {len(strings)}   value-store/.env values {len(store)}")

    gm._redact_tokens_near_label = ORIG
    base = [gm.redact_text(s) if s else s for s in strings]

    for name, win, sep in [
        ("win=24 words allowed", 24, False),
        ("win=40 sep-only", 40, True),
        ("win=24 sep-only", 24, True),
    ]:
        gm._redact_tokens_near_label = build(win, sep)
        newly = Counter()
        ctx = {}
        changed = 0
        for s, b in zip(strings, base):
            n = gm.redact_text(s) if s else s
            if n != b:
                changed += 1
                for t in toks(n) - toks(b):
                    newly[t] += 1
                    ctx.setdefault(t, s)
        risky = sorted(
            t for t in newly
            if t in store or (len(t) >= 6 and any(c.isdigit() for c in t)))
        print("\n" + "=" * 74)
        print(f"### {name}:  strings changed={changed}  "
              f"tokens newly published={len(newly)} ({sum(newly.values())} occ)")
        print(f"    RISKY newly published (value-store hit or secret-shaped): {len(risky)}")
        for t in risky:
            s = ctx[t]
            i = s.find(t)
            print(f"      [{newly[t]:3d}x] {t!r}   in_store={t in store}")
            print(f"            …{s[max(0, i - 100):i + len(t) + 25]!r}")
        if newly:
            print("    sample: " + ", ".join(repr(t) for t, _ in newly.most_common(12)))

    gm._redact_tokens_near_label = ORIG


if __name__ == "__main__":
    main()
