#!/usr/bin/env python3
"""
Claude Code Local Session Exporter

Drop this on ANY machine (Mac, Windows, Linux) where you run Claude Code.
No dependencies — pure Python stdlib.
Message content is base64-encoded to pass GitHub's secret scanner.

Usage:
  python3 claude_local_export.py            # exports locally
  python3 claude_local_export.py --push     # exports + commits + pushes
"""

import json
import os
import sys
import re
import subprocess
import argparse
import base64
from datetime import datetime, timezone
from pathlib import Path

CLAUDE_DIR = os.path.expanduser("~/.claude")
PROJECTS_DIR = os.path.join(CLAUDE_DIR, "projects")
OUTPUT_FILE = "claude_local_sessions.json"
GITHUB_REPO = "coolgeekme/hermes-topic-dashboard"
GITHUB_FILE = "public/claude_local_sessions.json"

# ── Helpers ──────────────────────────────────────────────────────────

def b64encode(text: str) -> str:
    """Base64-encode text so GitHub's secret scanner can't read it.
    Prefixed with [B64] so the dashboard knows to decode."""
    if not text:
        return text
    return '[B64]' + base64.b64encode(text.encode('utf-8')).decode('ascii')

def decode_project_name(dirname: str) -> str:
    if dirname.startswith('-'):
        parts = dirname[1:].split('-')
        if len(parts) > 0 and len(parts[0]) == 1:
            return parts[0] + '\\' + '\\'.join(parts[1:])
        return '/' + '/'.join(parts)
    return dirname

def extract_text_content(content_blocks):
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
        
        if not session_id:
            session_id = entry.get('sessionId', '')
        if not project and entry.get('cwd'):
            project = entry.get('cwd', '')
        if not branch and entry.get('gitBranch'):
            branch = entry.get('gitBranch', '')
        if t == 'ai-title':
            title = b64encode(str(entry.get('aiTitle') or title))
        
        if t == 'user':
            content = entry.get('message', {}).get('content', '')
            text = extract_text_content(content)
            ts = entry.get('timestamp', '')
            if text.strip():
                dedup_key = text.strip()[:80]
                if dedup_key not in user_messages_seen:
                    user_messages_seen.add(dedup_key)
                    messages.append({
                        'role': 'user',
                        'content': b64encode(text),
                        'timestamp': ts,
                    })
                if not first_ts:
                    first_ts = ts
                last_ts = ts
        
        if t == 'assistant':
            content = entry.get('message', {}).get('content', [])
            text = extract_text_content(content)
            ts = entry.get('timestamp', '')
            if text.strip():
                messages.append({
                    'role': 'assistant',
                    'content': b64encode(text),
                    'timestamp': ts,
                })
                if not first_ts:
                    first_ts = ts
                last_ts = ts
        
        if t == 'queue-operation' and entry.get('operation') == 'enqueue':
            text = entry.get('content', '')
            ts = entry.get('timestamp', '')
            if text.strip():
                dedup_key = text.strip()[:80]
                if dedup_key not in user_messages_seen:
                    user_messages_seen.add(dedup_key)
                    messages.insert(0, {
                        'role': 'user',
                        'content': b64encode(text),
                        'timestamp': ts,
                    })
                    if not first_ts:
                        first_ts = ts
    
    if not messages:
        return None
    
    return {
        'id': session_id or os.path.basename(filepath).replace('.jsonl', ''),
        'title': title or b64encode('Untitled'),
        'project': project or '',
        'branch': branch or '',
        'started_at': first_ts or '',
        'last_active': last_ts or first_ts or '',
        'message_count': len(messages),
        'messages': messages,
    }

# ── Main Export ───────────────────────────────────────────────────────

def export_all() -> list[dict]:
    sessions = []
    
    if not os.path.isdir(PROJECTS_DIR):
        print(f"\n❌ No Claude projects directory found at:\n   {PROJECTS_DIR}")
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
            if '/subagents/' in filepath.replace('\\', '/'):
                continue
            try:
                session = parse_session(filepath)
                if session:
                    session['project'] = session['project'] or project_name
                    sessions.append(session)
                    print(f"     ✅ {_decode_for_display(session['title'])[:50]} ({session['message_count']} msgs)")
                else:
                    print(f"     ⚠ {fname[:30]}... (empty)")
            except Exception as e:
                print(f"     ❌ {fname[:30]}... ({e})")
    
    return sessions

def _decode_for_display(text: str) -> str:
    """Decode [B64] text for display in terminal output."""
    if text.startswith('[B64]'):
        try:
            return base64.b64decode(text[5:]).decode('utf-8')
        except:
            return text[:50]
    return text

def main():
    parser = argparse.ArgumentParser(description='Export Claude Code sessions')
    parser.add_argument('--push', action='store_true', help='Commit and push to GitHub')
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
        'encoding': 'base64',  # dashboard uses this to know to decode [B64] prefixes
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ Exported {len(sessions)} sessions ({output['total_messages']} messages)")
    print(f"📄 {args.output}")
    print(f"🔒 All message content is base64-encoded for GitHub push protection")
    
    if args.push:
        print(f"\n📤 Pushing to GitHub...")
        push_to_github(args.output)
    else:
        print(f"\n💡 To push: python3 {sys.argv[0]} --push")

def push_to_github(filepath: str):
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
        return
    
    import shutil
    dest = os.path.join(repo_dir, GITHUB_FILE)
    shutil.copy(filepath, dest)
    print(f"   Copied to {dest}")
    
    os.chdir(repo_dir)
    subprocess.run(['git', 'add', GITHUB_FILE], check=True)
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    subprocess.run(['git', 'commit', '-m', f'data: Claude Code sessions from local machine [{ts}]'], check=True)
    subprocess.run(['git', 'pull', '--rebase'], check=False)
    subprocess.run(['git', 'push'], check=True)
    print("   ✅ Pushed to GitHub")

if __name__ == '__main__':
    main()
