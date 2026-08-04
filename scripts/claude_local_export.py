#!/usr/bin/env python3
"""
Claude Code Local Session Exporter

Drop this on ANY machine (Mac, Windows, Linux) where you run Claude Code.
No dependencies — pure Python stdlib.

Usage:
  python3 claude_local_export.py            # exports to claude_sessions.json
  python3 claude_local_export.py --push     # exports + commits + pushes to GitHub
"""

import json
import os
import sys
import re
import subprocess
import argparse
from datetime import datetime, timezone
from pathlib import Path

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
    (re.compile(r'amzn\.m\.[0-9a-f]{32,}'), '[AMAZON_TOKEN]'),
    (re.compile(r'ya29\.[0-9A-Za-z\-_]+'), '[GOOGLE_OAUTH_TOKEN]'),
    (re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I), '[UUID]'),
]

def redact(text: str) -> str:
    if not text:
        return text
    for pattern, replacement in _SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    return text

CLAUDE_DIR = os.path.expanduser("~/.claude")
PROJECTS_DIR = os.path.join(CLAUDE_DIR, "projects")
OUTPUT_FILE = "claude_local_sessions.json"
GITHUB_REPO = "coolgeekme/hermes-topic-dashboard"
GITHUB_FILE = "public/claude_local_sessions.json"

# ── Helpers ──────────────────────────────────────────────────────────

def decode_project_name(dirname: str) -> str:
    """Convert Claude's directory encoding back to a path.
    '-Users-john-projects-myapp' → '/Users/john/projects/myapp'"""
    if dirname.startswith('-'):
        # Handle Windows paths too (C:-Users-...)
        parts = dirname[1:].split('-')
        if len(parts) > 0 and len(parts[0]) == 1:  # Drive letter like 'C:'
            return parts[0] + '\\' + '\\'.join(parts[1:])
        return '/' + '/'.join(parts)
    return dirname

def extract_text_content(content_blocks):
    """Extract readable text from Claude's content blocks."""
    if isinstance(content_blocks, str):
        return content_blocks
    if isinstance(content_blocks, list):
        texts = []
        for block in content_blocks:
            if not isinstance(block, dict):
                continue
            t = block.get('type', '')
            if t == 'text':
                texts.append(block.get('text', ''))
            elif t == 'tool_use':
                name = block.get('name', 'tool')
                inp = json.dumps(block.get('input', {}))
                texts.append(f'[{name}: {inp[:200]}]')
            elif t == 'tool_result':
                content = block.get('content', '')
                if isinstance(content, list):
                    content = ' '.join(
                        c.get('text', '') if isinstance(c, dict) else str(c)
                        for c in content
                    )
                texts.append(f'[Result: {str(content)[:200]}]')
            elif t == 'thinking':
                texts.append(f'[Thinking: {block.get("thinking", "")[:200]}]')
        return '\n'.join(texts) if texts else ''
    return str(content_blocks)

# ── Session Parser ───────────────────────────────────────────────────

def parse_session(filepath: str) -> dict | None:
    """Parse a single Claude Code JSONL session file."""
    try:
        with open(filepath, encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"  ⚠ Could not read {filepath}: {e}", file=sys.stderr)
        return None
    
    if not lines:
        return None
    
    session_id = None
    messages = []
    title = None
    project = None
    branch = None
    first_ts = None
    last_ts = None
    user_messages_seen = set()
    
    for line in lines:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        
        t = entry.get('type', '')
        
        # Metadata
        if not session_id:
            session_id = entry.get('sessionId', '')
        if not project and entry.get('cwd'):
            project = entry.get('cwd', '')
        if not branch and entry.get('gitBranch'):
            branch = entry.get('gitBranch', '')
        if t == 'ai-title':
            title = redact(entry.get('aiTitle') or title)
        
        # User messages
        if t == 'user':
            content = entry.get('message', {}).get('content', '')
            text = extract_text_content(content)
            ts = entry.get('timestamp', '')
            if text.strip():
                text = redact(text)
                # Deduplicate (queue-operation may duplicate the first prompt)
                dedup_key = text.strip()[:80]
                if dedup_key not in user_messages_seen:
                    user_messages_seen.add(dedup_key)
                    messages.append({'role': 'user', 'content': text, 'timestamp': ts})
                if not first_ts:
                    first_ts = ts
                last_ts = ts
        
        # Assistant messages
        if t == 'assistant':
            content = entry.get('message', {}).get('content', [])
            text = extract_text_content(content)
            ts = entry.get('timestamp', '')
            if text.strip():
                text = redact(text)
                messages.append({'role': 'assistant', 'content': text, 'timestamp': ts})
                if not first_ts:
                    first_ts = ts
                last_ts = ts
        
        # Queue operations (capture initial prompts)
        if t == 'queue-operation' and entry.get('operation') == 'enqueue':
            text = entry.get('content', '')
            ts = entry.get('timestamp', '')
            if text.strip():
                dedup_key = text.strip()[:80]
                if dedup_key not in user_messages_seen:
                    user_messages_seen.add(dedup_key)
                    messages.insert(0, {'role': 'user', 'content': redact(text), 'timestamp': ts})
                    if not first_ts:
                        first_ts = ts
    
    if not messages:
        return None
    
    return {
        'id': session_id or os.path.basename(filepath).replace('.jsonl', ''),
        'title': title or 'Untitled',
        'project': project or '',
        'branch': branch or '',
        'started_at': first_ts or '',
        'last_active': last_ts or first_ts or '',
        'message_count': len(messages),
        'messages': messages,
    }

# ── Main Export ───────────────────────────────────────────────────────

def export_all() -> list[dict]:
    """Export all Claude Code sessions from all projects."""
    sessions = []
    
    if not os.path.isdir(PROJECTS_DIR):
        print(f"\n❌ No Claude projects directory found at:\n   {PROJECTS_DIR}")
        print("\n   Make sure Claude Code is installed and has been used on this machine.")
        print("   Expected location: ~/.claude/projects/")
        return sessions
    
    print(f"\nScanning: {PROJECTS_DIR}")
    
    for proj_dir in sorted(os.listdir(PROJECTS_DIR)):
        proj_path = os.path.join(PROJECTS_DIR, proj_dir)
        if not os.path.isdir(proj_path):
            continue
        
        project_name = decode_project_name(proj_dir)
        jsonl_files = [f for f in os.listdir(proj_path) if f.endswith('.jsonl')]
        
        print(f"\n  📁 {project_name} ({len(jsonl_files)} sessions)")
        
        for fname in sorted(jsonl_files):
            filepath = os.path.join(proj_path, fname)
            # Skip subagent sessions
            if '/subagents/' in filepath.replace('\\', '/'):
                continue
            try:
                session = parse_session(filepath)
                if session:
                    session['project'] = session['project'] or project_name
                    sessions.append(session)
                    print(f"     ✅ {session['title'][:50]} ({session['message_count']} msgs)")
                else:
                    print(f"     ⚠ {fname[:30]}... (empty)")
            except Exception as e:
                print(f"     ❌ {fname[:30]}... ({e})")
    
    return sessions

def main():
    parser = argparse.ArgumentParser(description='Export Claude Code sessions')
    parser.add_argument('--push', action='store_true', help='Commit and push to GitHub after export')
    parser.add_argument('--output', default=OUTPUT_FILE, help=f'Output file (default: {OUTPUT_FILE})')
    args = parser.parse_args()
    
    sessions = export_all()
    
    if not sessions:
        print("\nNo sessions found. Nothing to export.")
        sys.exit(0)
    
    output = {
        'platform': 'claude-code',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'exported_from': os.uname().nodename if hasattr(os, 'uname') else 'unknown',
        'total_sessions': len(sessions),
        'total_messages': sum(s['message_count'] for s in sessions),
        'sessions': sessions,
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ Exported {len(sessions)} sessions ({output['total_messages']} messages)")
    print(f"📄 {args.output}")
    
    if args.push:
        print(f"\n📤 Pushing to GitHub...")
        push_to_github(args.output)
    else:
        print(f"\n💡 To push to GitHub, run:")
        print(f"   python3 {sys.argv[0]} --push")
        print(f"\n   Or manually:")
        print(f"   1. Copy {args.output} to your hermes-topic-dashboard repo")
        print(f"   2. git add public/claude_local_sessions.json")
        print(f"   3. git commit -m 'data: local Claude Code sessions'")
        print(f"   4. git push")

def push_to_github(filepath: str):
    """Copy the export to the repo and push to GitHub."""
    # Find the repo
    repo_dir = None
    for search in [
        os.path.expanduser("~/hermes-topic-dashboard"),
        os.path.expanduser("~/projects/hermes-topic-dashboard"),
        os.path.expanduser("~/Documents/hermes-topic-dashboard"),
    ]:
        if os.path.isdir(os.path.join(search, '.git')):
            repo_dir = search
            break
    
    if not repo_dir:
        print("⚠ Could not find hermes-topic-dashboard repo.")
        print("  Clone it first: git clone https://github.com/coolgeekme/hermes-topic-dashboard.git")
        return
    
    # Copy file
    import shutil
    dest = os.path.join(repo_dir, GITHUB_FILE)
    shutil.copy(filepath, dest)
    print(f"   Copied to {dest}")
    
    # Commit and push
    os.chdir(repo_dir)
    subprocess.run(['git', 'add', GITHUB_FILE], check=True)
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    subprocess.run(['git', 'commit', '-m', f'data: Claude Code sessions from local machine [{ts}]'], check=True)
    subprocess.run(['git', 'push'], check=True)
    print("   ✅ Pushed to GitHub")

if __name__ == '__main__':
    main()
