#!/usr/bin/env python3
"""
GitHub Actions Topic Merger

Runs in CI — merges pre-exported Hermes + Claude VPS + Claude Local data
into the unified topics.json without needing access to state.db.
"""

import json
import os
import urllib.request
import re
import sys
import base64
import hashlib
from datetime import datetime, timezone
from collections import defaultdict

# ── Secret Redaction ──────────────────────────────────────────────────

_SECRET_PATTERNS = [
    (re.compile(r'sk_liv\w*'), '[STRIPE_LIVE_KEY]'),
    (re.compile(r'sk_live\w*'), '[STRIPE_LIVE_KEY]'),
    (re.compile(r'sk_test\w*'), '[STRIPE_TEST_KEY]'),
    (re.compile(r'rk_live\w*'), '[STRIPE_RESTRICTED_KEY]'),
    (re.compile(r'sk-ant\S*'), '[ANTHROPIC_API_KEY]'),
    (re.compile(r'\d+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com'), '[GOOGLE_CLIENT_ID]'),
    (re.compile(r'GOCSPX-[a-zA-Z0-9_-]+'), '[GOOGLE_CLIENT_SECRET]'),
    (re.compile(r'ghp_[a-zA-Z0-9]{36}'), '[GITHUB_TOKEN]'),
    (re.compile(r'github_pat_[a-zA-Z0-9_]{36,}'), '[GITHUB_TOKEN]'),
    (re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'), '[EMAIL]'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), '[AWS_ACCESS_KEY]'),
    (re.compile(r'Bearer\s+[a-zA-Z0-9._\-]{20,}'), 'Bearer [REDACTED]'),
    (re.compile(r'AIza[0-9A-Za-z\-_]{35}'), '[GOOGLE_API_KEY]'),
    (re.compile(r'ya29\.[0-9A-Za-z\-_]+'), '[GOOGLE_OAUTH_TOKEN]'),
    (re.compile(r'vcp_[A-Za-z0-9]{40,}'), '[VERCEL_TOKEN]'),
    (re.compile(r'VERCEL_TOKEN=\S+'), '[VERCEL_TOKEN]'),
    (re.compile(r'pypi-[A-Za-z0-9._\-]{40,}'), '[PYPI_API_TOKEN]'),
    (re.compile(r'ntn_[A-Za-z0-9]{10,}'), '[NOTION_API_TOKEN]'),
    (re.compile(r'secret_[A-Za-z0-9]{20,}'), '[NOTION_API_TOKEN]'),
    (re.compile(r'sbp_[a-zA-Z0-9]{20,}'), '[SUPABASE_TOKEN]'),
    (re.compile(r'gsk_[A-Za-z0-9._\-]+'), '[GROQ_API_KEY]'),
    (re.compile(r're_[A-Za-z0-9_]{16,}'), '[RESEND_API_KEY]'),
    (re.compile(r'sk-[A-Za-z0-9]{20,}'), '[OPENAI_API_KEY]'),
    (re.compile(r'whsec_[A-Za-z0-9]+'), '[STRIPE_WEBHOOK_SECRET]'),
    (re.compile(r'xox[baprs]-[A-Za-z0-9-]{10,}'), '[SLACK_TOKEN]'),
]

def redact_text(text: str) -> str:
    if not text:
        return text
    for p, r in _SECRET_PATTERNS:
        text = p.sub(r, text)
    return text

HERMES_FILE = os.path.expanduser("~/.hermes/topic_dashboard_data/topics.json")
CLAUDE_VPS_FILE = os.path.expanduser("~/.hermes/claude_dashboard_data/claude_sessions.json")
CLAUDE_LOCAL_FILE = os.path.expanduser("~/.hermes/claude_dashboard_data/claude_local_sessions.json")
CLAUDE_LOCAL_TAR = os.path.expanduser("~/.hermes/claude_dashboard_data/claude_local_sessions.tar.gz")
OUTPUT_DIR = os.path.expanduser("~/.hermes/unified_dashboard_data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "unified_topics.json")

def redact(text: str) -> str:
    """Decode base64 content from local exports, then redact secrets."""
    if not text:
        return text
    # First decode base64 if present
    if text.startswith('[B64]'):
        try:
            text = base64.b64decode(text[5:]).decode('utf-8')
        except:
            pass
    # Then redact secrets
    return redact_text(text)

# ── Loaders ───────────────────────────────────────────────────────────

def load_hermes_data() -> list[dict]:
    if not os.path.exists(HERMES_FILE):
        return []
    with open(HERMES_FILE) as f:
        return json.load(f).get('topics', [])

def load_sessions(path: str, label: str) -> list[dict]:
    """Load sessions from JSON or compressed tar.gz."""
    if not os.path.exists(path):
        return []
    
    # Check if it's a tar.gz
    if path.endswith('.tar.gz'):
        import tarfile
        with tarfile.open(path, 'r:gz') as tar:
            member = tar.getmember('claude_local_sessions.json')
            f = tar.extractfile(member)
            if f:
                data = json.loads(f.read().decode('utf-8'))
            else:
                return []
    else:
        with open(path) as f:
            data = json.load(f)
    
    sessions = data.get('sessions', [])
    if sessions:
        msgs = sum(s.get('message_count', 0) for s in sessions)
        print(f"Loaded {len(sessions)} {label} sessions ({msgs} msgs)")
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

def cluster_by_title(groups: list[dict]) -> list[list[dict]]:
    """Cluster Claude session groups by title similarity.
    Uses proper nouns and project names as primary signals, keywords as secondary."""
    if len(groups) <= 1:
        return [groups]
    
    # Phase 1: Extract proper nouns and project-like names from titles
    # These are strong contextual signals (e.g., "soulprintpro", "DisciplinedOS")
    def extract_proper_nouns(text: str) -> set[str]:
        """Extract capitalized words, CamelCase, and repo-like names."""
        if not text:
            return set()
        nouns = set()
        # CamelCase / PascalCase words (e.g., DisciplinedOS, VisionKinetix)
        nouns.update(re.findall(r'[A-Z][a-z]+(?:[A-Z][a-z]+)+', text))
        # Lowercase project names (e.g., soulprintpro, bizgrowthai, dateniteai)
        nouns.update(re.findall(r'\b([a-z]{4,}(?:[a-z]{4,}){1,})\b', text.lower()))
        # Capitalized single words (proper nouns)
        nouns.update(w for w in re.findall(r'\b[A-Z][a-z]{3,}\b', text) 
                    if w.lower() not in {'Claude', 'Code', 'This', 'That', 'What', 'When', 
                                         'Where', 'Which', 'There', 'Their', 'About', 'Would',
                                         'Could', 'Should', 'Your', 'They', 'Some', 'Just',
                                         'Like', 'Also', 'Very', 'Only', 'Other', 'More', 'Here'})
        return nouns
    
    # Build proper noun sets
    pn_map = {}
    for i, g in enumerate(groups):
        text = (g.get('name', '') or '') + ' '
        if g.get('messages'):
            text += (g['messages'][0].get('content', '') or '')[:200]
        pn_map[i] = extract_proper_nouns(text)
    
    # Phase 2: Greedy clustering — first by proper nouns, then by keywords
    clustered = set()
    clusters = []
    
    for i in range(len(groups)):
        if i in clustered:
            continue
        cluster = [groups[i]]
        cluster_pn = pn_map.get(i, set())
        clustered.add(i)
        
        # First pass: match by proper noun overlap (strong signal)
        for j in range(i + 1, len(groups)):
            if j in clustered:
                continue
            other_pn = pn_map.get(j, set())
            if cluster_pn and other_pn and (cluster_pn & other_pn):
                cluster.append(groups[j])
                cluster_pn |= other_pn
                clustered.add(j)
        
        # Second pass: match remaining by keyword overlap
        if len(cluster) == 1:
            cluster_kw = extract_keywords(
                (groups[i].get('name', '') or '') + ' ' +
                ((groups[i].get('messages') or [{}])[0].get('content', '') or '')[:200]
            )
            for j in range(i + 1, len(groups)):
                if j in clustered:
                    continue
                other_kw = extract_keywords(
                    (groups[j].get('name', '') or '') + ' ' +
                    ((groups[j].get('messages') or [{}])[0].get('content', '') or '')[:200]
                )
                if not cluster_kw or not other_kw:
                    continue
                overlap = len(cluster_kw & other_kw)
                union = len(cluster_kw | other_kw)
                if union > 0 and overlap / union >= 0.3:
                    cluster.append(groups[j])
                    clustered.add(j)
        
        clusters.append(cluster)
    
    return clusters

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
    
    # Merge Claude sessions: cluster by title within each project
    claude_by_project = defaultdict(list)
    for i, g in enumerate(all_groups):
        if 'claude-code' in g['platforms'] and g['sessions']:
            proj = g['sessions'][0].get('project', '') or ''
            if proj:
                claude_by_project[proj].append(i)
    
    used = set()
    merged_groups = []
    
    for proj, indices in claude_by_project.items():
        if len(indices) <= 1:
            continue
        
        proj_name = proj.replace('\\', '/').split('/')[-1] or proj
        
        # Cluster sessions within this project by title similarity
        clusters = cluster_by_title([all_groups[i] for i in indices])
        
        for cluster in clusters:
            if len(cluster) == 1:
                g = cluster[0]
                g['name'] = f'Claude: {g["name"][:60]}'
                merged_groups.append(g)
            else:
                merged = _merge_group_list(cluster)
                # Use the most descriptive title as the name
                best_name = max((g['name'] for g in cluster if g['name'] != 'Untitled'), key=len, default=f'Claude: {proj_name}')
                merged['name'] = f'Claude: {best_name[:60]}'
                merged_groups.append(merged)
        
        used.update(indices)
    
    # Single-session projects
    for proj, indices in claude_by_project.items():
        if len(indices) == 1 and indices[0] not in used:
            g = all_groups[indices[0]]
            proj_name = proj.replace('\\', '/').split('/')[-1] or proj
            g['name'] = f'Claude: {g["name"][:60]}'
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
        
        # Strip messages from embedded sessions to avoid leaking unredacted content
        clean_sessions = []
        for s in g['sessions']:
            clean = {k: v for k, v in s.items() if k != 'messages'}
            clean_sessions.append(clean)
        
        topics.append({
            'id': hashlib.md5(g['name'].encode()).hexdigest()[:12],
            'name': g['name'][:80],
            'platforms': sorted(g['platforms']),
            'sessions': clean_sessions,
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
    # Try tar.gz first, then JSON
    if os.path.exists(CLAUDE_LOCAL_TAR):
        local = load_sessions(CLAUDE_LOCAL_TAR, 'local')
    else:
        local = load_sessions(CLAUDE_LOCAL_FILE, 'local')
    
    print(f"Hermes topics: {len(hermes)}")
    print(f"Claude VPS: {len(vps)} sessions")
    print(f"Claude Local: {len(local)} sessions")
    
    # Load ChatGPT and Claude web sessions (download from GitHub if not local)
    web_sessions = []
    cwd = os.getcwd()
    for name, gh_name in [('chatgpt-web', 'chatgpt-web_sessions.json'), ('claude-web', 'claude-web_sessions.json')]:
        local_path = os.path.join(cwd, 'public', gh_name)
        if not os.path.exists(local_path):
            try:
                url = f"https://raw.githubusercontent.com/coolgeekme/hermes-topic-dashboard/main/public/{gh_name}"
                urllib.request.urlretrieve(url, local_path)
            except: pass
        if os.path.exists(local_path):
            web = load_sessions(local_path, name)
            print(f"  {name}: {len(web)} sessions")
            web_sessions.extend(web)
    
    topics = merge_all(hermes, vps, local)
    
    # Convert web sessions to topics (one topic per session)
    for s in web_sessions:
        topics.append({
            'id': f"web-{s.get('id', '')}",
            'name': s.get('title', 'Untitled')[:100],
            'platforms': [s.get('platform', 'chatgpt-web')],
            'session_count': 1,
            'message_count': s.get('message_count', 0),
            'message_count_exported': len(s.get('messages', [])),
            'last_active': (lambda ts: datetime.fromisoformat(str(ts).replace('Z','+00:00')).timestamp() if ts else 0)(s.get('last_active') or s.get('started_at')),
            'messages': s.get('messages', []),
            'is_cron': False,
        })
    
    # Collect all platforms
    all_platforms = set()
    for t in topics:
        for p in (t.get('platforms') or []):
            all_platforms.add(p)
    
    output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'platforms': sorted(all_platforms),
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
