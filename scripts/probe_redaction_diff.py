#!/usr/bin/env python3
"""Differential probe: OLD vs NEW redaction over the RAW Hermes export.

Method required by SKILL.md pitfall 11/12/13: before landing a redaction change,
run old and new rules over the raw exports and inspect every string that the new
rule changes — it must be explained by the intended fix, never by collateral.

Usage: python3 scripts/probe_redaction_diff.py
"""
import importlib.util
import json
import os
import subprocess
import sys

REPO = '/root/projects/hermes-topic-dashboard'
RAW = os.path.expanduser('~/.hermes/topic_dashboard_data/topics.json')
TMP = '/root/.hermes/cache/scratch/gm_old.py'
EXPLAINED_VALUES = ['Phil2026', 'CoS2026!', 'nextcap2026', 'WNFFP7HAKD']


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def main():
    os.makedirs(os.path.dirname(TMP), exist_ok=True)
    with open(TMP, 'w') as fh:
        fh.write(subprocess.run(['git', 'show', 'HEAD:scripts/github_merge.py'],
                                cwd=REPO, capture_output=True, text=True, check=True).stdout)
    old = load('gm_old', TMP)
    new = load('gm_new', os.path.join(REPO, 'scripts', 'github_merge.py'))
    print(f"old values: {len(old._env_values)}  new values: {len(new._env_values)}")

    data = json.load(open(RAW, encoding='utf-8', errors='replace'))
    strings = []

    def walk(node):
        if isinstance(node, str):
            if node:
                strings.append(node)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)

    walk(data)
    print(f"walked {len(strings)} raw strings")

    changed = unexplained = 0
    unexplained_samples = []
    for s in strings:
        o, n = old.redact_text(s), new.redact_text(s)
        if o == n:
            continue
        changed += 1
        # explain: a value that the new rule redacts, or a newly-covered NAME=
        ok = any(o.count(v) > n.count(v) for v in EXPLAINED_VALUES)
        if not ok:
            for probe in ('PASSCODE', 'ACCESS_CODE', 'INVITE_CODE'):
                if probe in o.upper() and probe in n.upper():
                    ok = True
        if not ok:
            unexplained += 1
            if len(unexplained_samples) < 8:
                unexplained_samples.append((o[:400], n[:400]))

    print(f"\nstrings changed by the new rules: {changed}")
    print(f"unexplained changes            : {unexplained}")
    for o, n in unexplained_samples:
        print("\n--- OLD ---\n" + o + "\n--- NEW ---\n" + n)
    return 1 if unexplained else 0


if __name__ == '__main__':
    sys.exit(main())
