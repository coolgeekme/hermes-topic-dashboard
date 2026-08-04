#!/usr/bin/env python3
"""
GitHub Actions Topic Merger

Runs in CI — merges pre-exported Hermes + Claude VPS + Claude Local data
into the unified topics.json without needing access to state.db.
"""

import json
import os
import re
import sys
import base64
import hashlib
from datetime import datetime, timezone
from collections import defaultdict

HERMES_FILE = os.path.expanduser("~/.hermes/topic_dashboard_data/topics.json")
CLAUDE_VPS_FILE = os.path.expanduser("~/.hermes/claude_dashboard_data/claude_sessions.json")
CLAUDE_LOCAL_FILE = os.path.expanduser("~/.hermes/claude_dashboard_data/claude_local_sessions.json")
OUTPUT_DIR = os.path.expanduser("~/.hermes/unified_dashboard_data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "unified_topics.json")

# ── Secret Redaction ──────────────────────────────────────────────────

_SECRET_PATTERNS = [
    (re.compile(r'\d+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com'), '[GOOGLE_CLIENT_ID]'),
    (re.compile(r'GOCSPX-[a-zA-Z0-9_-]+'), '[GOOGLE_CLIENT_SECRET]'),
    (re.compile(r'sk-[a-zA-Z0-9]{32,}'), '[OPENAI_API_KEY]'),
    (re.compile(r'sk-ant-[a-zA-Z0-9_-]{32,}'), '[ANTHROPIC_API_KEY]'),
    (re.compile(r'ghp_[a-zA-Z0-9]{36}'), '[GITHUB_TOKEN]'),
    (re.compile(r'github_pat_[a-zA-Z0-9_]{36,}'), '[GITHUB_TOKEN]'),
    (re.compile(r'gho_[a-zA-Z0-9]{36,}'), '[GITHUB_OAUTH_TOKEN]'),
    (re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'), '[EMAIL]'),
    (re.compile(r'\+1?\d{10,}'), '[PHONE]'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), '[AWS_ACCESS_KEY]'),
    (re.compile(r'Bearer\s+[a-zA-Z0-9._\-]{20,}'), 'Bearer [REDACTED]'),
    (re.compile(r'AIza[0-9A-Za-z\-_]{35}'), '[GOOGLE_API_KEY]'),
    (re.compile(r'ya29\.[0-9A-Za-z\-_]+'), '[GOOGLE_OAUTH_TOKEN]'),
]

def redact(text: str) -> str:
    """Decode base64 content from local exports, passthrough otherwise."""
    if not text:
        return text
    if text.startswith('[B64]'):
        try:
            return base64.b64decode(text[5:]).decode('utf-8')
        except:
            return text
    return text

# ── Loaders ───────────────────────────────────────────────────────────

def load_hermes_data() -> list[dict]:
    if not os.path.exists(HERMES_FILE):
        return []
    with open(HERMES_FILE) as f:
        return json.load(f).get('topics', [])

def load_sessions(path: str, label: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path) as f:
        data = json.load(f)
    sessions = data.get('sessions', [])
    # If it's the local export format, normalize
    return sessions

# ── Normalize ─────────────────────────────────────────────────────────

def normalize_hermes_topic(topic: dict) -> list[dict]:
    sessions = []
    for sid in topic.get('sessions', []):
        sessions.append({
            'id': sid, 'platform': 'hermes', 'title': topic.get('name', ''),
            'project': None, 'branch': None, 'started_at': None,
            'last_active': None, 'message_count': 0, 'messages': [],
            'resume_command': f'hermes --resume {sid}', 'is_cron': sid.startswith('cron_'),
        })
    return sessions

def normalize_claude(s: dict) -> dict:
    return {
        'id': s.get('id', ''), 'platform': 'claude-code',
        'title': s.get('title', ''), 'project': s.get('project', ''),
        'branch': s.get('branch', ''), 'started_at': s.get('started_at', ''),
        'last_active': s.get('last_active', ''), 'message_count': s.get('message_count', 0),
        'messages': s.get('messages', []),
        'resume_command': f'claude --resume {s.get("id", "")}', 'is_cron': False,
    }

# ── Merge ─────────────────────────────────────────────────────────────

def extract_keywords(text: str) -> set[str]:
    if not text: return set()
    stop = {'this','that','with','from','have','been','what','when','where','which',
            'there','their','about','would','could','should','your','they','them',
            'then','than','some','just','like','also','very','only','other','more',
            'here','does','doing','being','will'}
    return {w for w in re.findall(r'[a-z]{4,}', text.lower()) if w not in stop}

def merge_all(hermes_topics: list[dict], vps_claude: list[dict], local_claude: list[dict]) -> list[dict]:
    all_groups = []
    
    # Hermes topics
    for topic in hermes_topics:
        sessions = normalize_hermes_topic(topic)
        msgs = []
        for m in topic.get('messages', []):
            role = m.get('role', '')
            if role in ('user', 'assistant'):
                msgs.append({
                    'role': role, 'content': redact(m.get('content', '') or ''),
                    'timestamp': m.get('timestamp_iso', ''),
                    'session_id': m.get('session_id', ''), 'platform': 'hermes',
                })
        all_groups.append({
            'name': topic.get('name', ''), 'platforms': {'hermes'},
            'sessions': sessions, 'messages': msgs,
            'is_cron': topic.get('is_cron', False),
        })
    
    # Claude VPS
    for s in vps_claude:
        norm = normalize_claude(s)
        msgs = [{'role': m.get('role',''), 'content': redact(m.get('content','') or ''),
                 'timestamp': m.get('timestamp',''), 'session_id': norm['id'],
                 'platform': 'claude-code'} for m in norm.get('messages', [])]
        all_groups.append({
            'name': norm['title'] or 'Untitled', 'platforms': {'claude-code'},
            'sessions': [norm], 'messages': msgs, 'is_cron': False,
        })
    
    # Claude Local
    for s in local_claude:
        norm = normalize_claude(s)
        msgs = [{'role': m.get('role',''), 'content': redact(m.get('content','') or ''),
                 'timestamp': m.get('timestamp',''), 'session_id': norm['id'],
                 'platform': 'claude-code'} for m in norm.get('messages', [])]
        all_groups.append({
            'name': norm['title'] or 'Untitled', 'platforms': {'claude-code'},
            'sessions': [norm], 'messages': msgs, 'is_cron': False,
        })
    
    # Merge Claude sessions by project
    claude_by_project = defaultdict(list)
    for i, g in enumerate(all_groups):
        if 'claude-code' in g['platforms'] and g['sessions']:
            proj = g['sessions'][0].get('project', '') or ''
            if proj:
                claude_by_project[proj].append(i)
    
    used = set()
    merged_groups = []
    
    for proj, indices in claude_by_project.items():
        if len(indices) > 1:
            merged = _merge_group_list([all_groups[i] for i in indices])
            proj_name = proj.replace('\\', '/').split('/')[-1] or proj
            merged['name'] = f'Claude: {proj_name}'
            merged_groups.append(merged)
            used.update(indices)
    
    # Also include single-session Claude projects
    for proj, indices in claude_by_project.items():
        if len(indices) == 1 and indices[0] not in used:
            g = all_groups[indices[0]]
            proj_name = proj.replace('\\', '/').split('/')[-1] or proj
            g['name'] = f'Claude: {proj_name}'
            merged_groups.append(g)
            used.add(indices[0])
    
    # Cross-platform matching
    remaining_hermes = [i for i, g in enumerate(all_groups) if 'hermes' in g['platforms'] and i not in used]
    remaining_claude = [i for i, g in enumerate(all_groups) if 'claude-code' in g['platforms'] and i not in used]
    
    for hi in remaining_hermes:
        hg = all_groups[hi]
        h_kw = extract_keywords(hg['name'])
        best, best_score = None, 0
        for ci in remaining_claude:
            if ci in used: continue
            c_kw = extract_keywords(all_groups[ci]['name'])
            if not h_kw or not c_kw: continue
            score = len(h_kw & c_kw) / max(len(h_kw | c_kw), 1)
            if score > best_score and score >= 0.3:
                best_score, best = score, ci
        if best is not None:
            merged_groups.append(_merge_group_list([hg, all_groups[best]]))
            used.add(hi); used.add(best)
    
    for i, g in enumerate(all_groups):
        if i not in used:
            merged_groups.append(g)
    
    # Build final topics
    topics = []
    for g in merged_groups:
        total_msgs = sum(s['message_count'] for s in g['sessions'])
        all_ts = []
        for m in g['messages']:
            try:
                ts = datetime.fromisoformat(m['timestamp'].replace('Z','+00:00'))
                all_ts.append(ts.timestamp())
            except: pass
        last_active = max(all_ts) if all_ts else 0
        
        g['messages'].sort(key=lambda m: m.get('timestamp',''))
        msgs = g['messages'][-500:]
        
        topics.append({
            'id': hashlib.md5(g['name'].encode()).hexdigest()[:12],
            'name': g['name'][:80],
            'platforms': sorted(g['platforms']),
            'sessions': g['sessions'],
            'session_count': len(g['sessions']),
            'message_count': total_msgs,
            'message_count_exported': len(msgs),
            'last_active': last_active,
            'last_active_iso': datetime.fromtimestamp(last_active, tz=timezone.utc).isoformat() if last_active else None,
            'messages': msgs,
            'is_cron': g.get('is_cron', False),
        })
    
    topics.sort(key=lambda t: t['last_active'], reverse=True)
    return topics

def _merge_group_list(gs):
    all_s, all_m, all_p, names = [], [], set(), []
    for g in gs:
        all_s.extend(g['sessions']); all_m.extend(g['messages'])
        all_p.update(g['platforms'])
        if g['name']: names.append(g['name'])
    return {
        'name': (max(names, key=len) if names else 'Merged')[:80],
        'platforms': all_p, 'sessions': all_s, 'messages': all_m,
        'is_cron': all(g.get('is_cron', False) for g in gs),
    }

# ── Main ──────────────────────────────────────────────────────────────

def main():
    hermes = load_hermes_data()
    vps = load_sessions(CLAUDE_VPS_FILE, 'VPS')
    local = load_sessions(CLAUDE_LOCAL_FILE, 'local')
    
    print(f"Hermes topics: {len(hermes)}")
    print(f"Claude VPS: {len(vps)} sessions")
    print(f"Claude Local: {len(local)} sessions")
    
    topics = merge_all(hermes, vps, local)
    
    output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'platforms': ['hermes', 'claude-code'],
        'total_sessions': sum(t['session_count'] for t in topics),
        'total_messages_approx': sum(t['message_count_exported'] for t in topics),
        'topics': topics,
    }
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, ensure_ascii=False)
    
    print(f"\nOutput: {OUTPUT_FILE}")
    print(f"Topics: {len(topics)} | Sessions: {output['total_sessions']}")

if __name__ == '__main__':
    main()
