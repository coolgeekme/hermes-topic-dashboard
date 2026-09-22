#!/usr/bin/env python3
"""Pre/post-publish leak sweep for the Hermes Topic Dashboard public repo.

Loads every secret-named var from ~/.hermes/.env and the repo .env.local,
then scans the files that land in the PUBLIC repo for any of those literal
values. Prints counts only — never the values themselves.
"""
import os, re, sys, json

REPO = os.path.expanduser("~/projects/hermes-topic-dashboard")
TARGETS = [
    os.path.join(REPO, "data", "hermes_topics.json"),
    os.path.join(REPO, "data", "claude_vps_sessions.json"),
    os.path.join(REPO, "data", "topics.json"),
    os.path.join(REPO, "public", "topics.json"),
]
ENV_SECRET_NAME = re.compile(r"(KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|CREDENTIAL|API|AUTH)", re.I)
# ...but *HOST/PORT/URL-shaped values are addresses, not secrets. API_SERVER_HOST=127.0.0.1
# matches the name rule above and produced a permanent false positive that would mask a
# real leak. Skip values that are just an IP / localhost / bind-all address (optionally :port).
ADDRESS_ONLY = re.compile(r"^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|localhost|0\.0\.0\.0)(:\d{1,5})?$", re.I)
ENV_FILES = [os.path.expanduser("~/.hermes/.env"), os.path.join(REPO, ".env.local")]


def load_values():
    vals = {}
    for path in ENV_FILES:
        if not os.path.exists(path):
            continue
        for line in open(path, encoding="utf-8", errors="replace"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip().removeprefix("export ").strip(), v.strip().strip('"').strip("'")
            if ENV_SECRET_NAME.search(k) and len(v) >= 8 and not ADDRESS_ONLY.match(v):
                vals[v] = k
    return vals


def main():
    vals = load_values()
    print(f"Loaded {len(vals)} secret-shaped values from {len(ENV_FILES)} env files")
    total_hits = 0
    for t in TARGETS:
        if not os.path.exists(t):
            print(f"  MISSING  {os.path.relpath(t, REPO)}")
            continue
        blob = open(t, encoding="utf-8", errors="replace").read()
        hits = [(k, name) for k, name in vals.items() if k in blob]
        tag = "CLEAN" if not hits else f"{len(hits)} HIT(S)"
        print(f"  {tag:10} {os.path.relpath(t, REPO):32} {len(blob):,} chars")
        for k, name in hits:
            print(f"      !! {name} -> mask {k[:4]}…{k[-4:]} (len {len(k)})")
        total_hits += len(hits)

    # Shape sweep on the text payloads (generic credential assignment shapes)
    shape = re.compile(
        r"(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
        r"|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|dos_mcp_[0-9a-f]{16,}"
        r"|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)"
    )
    print("\nShape scan (token literals):")
    for t in TARGETS:
        if not os.path.exists(t):
            continue
        found = shape.findall(open(t, encoding="utf-8", errors="replace").read())
        print(f"  {os.path.relpath(t, REPO):32} {len(found)} match(es)")
        total_hits += len(found)

    print(f"\nTOTAL FINDINGS: {total_hits}")
    return 1 if total_hits else 0


if __name__ == "__main__":
    sys.exit(main())
