#!/usr/bin/env python3
"""
Claude Code Local Session Exporter (Metadata-Only)

Exports session metadata (titles, projects, counts) WITHOUT message content.
This avoids GitHub push protection entirely. Message content stays on your machine.

Usage:
  python3 claude_local_export.py --push
"""

import json
import os
import sys
import re
import subprocess
import argparse
from datetime import datetime, timezone

CLAUDE_DIR = os.path.expanduser("~/.claude")
PROJECTS_DIR = os.path.join(CLAUDE_DIR, "projects")
OUTPUT_FILE = "claude_local_sessions.json"
GITHUB_FILE = "public/claude_local_sessions.json"

def decode_project_name(dirname: str) -> str:
    if dirname.startswith('-'):
        parts = dirname[1:].split('-')
        if len(parts) > 0 and len(parts[0]) == 1:
            return parts[0] + '\\' + '\\'.join(parts[1:])
        return '/' + '/'.join(parts)
    return dirname

def parse_session_metadata(filepath: str) -> dict | None:
    """Extract only metadata — no message content."""
    try:
        with open(filepath, encoding='utf-8') as f:
            lines = f.readlines()
    except:
        return None
    
    if not lines:
        return None
    
    session_id = None
    title = None
    project = None
    branch = None
    first_ts = None
    last_ts = None
    msg_count = 0
    
    for line in lines:
        try:
            entry = json.loads(line)
        except:
            continue
        
        t = entry.get('type', '')
        
        if not session_id:
            session_id = entry.get('sessionId', '')
        if not project and entry.get('cwd'):
            project = entry.get('cwd', '')
        if not branch and entry.get('gitBranch'):
            branch = entry.get('gitBranch', '')
        if t == 'ai-title':
            title = entry.get('aiTitle') or title
        
        if t in ('user', 'queue-operation'):
            ts = entry.get('timestamp', '')
            if not first_ts:
                first_ts = ts
            last_ts = ts
            msg_count += 1
        
        if t == 'assistant':
            ts = entry.get('timestamp', '')
            last_ts = ts
            msg_count += 1
    
    if msg_count == 0:
        return None
    
    return {
        'id': session_id or os.path.basename(filepath).replace('.jsonl', ''),
        'title': title or 'Untitled',
        'project': project or '',
        'branch': branch or '',
        'started_at': first_ts or '',
        'last_active': last_ts or first_ts or '',
        'message_count': msg_count,
        'messages': [],
    }

def export_all() -> list[dict]:
    sessions = []
    
    if not os.path.isdir(PROJECTS_DIR):
        print(f"\nNo Claude projects directory at: {PROJECTS_DIR}")
        return sessions
    
    print(f"Scanning: {PROJECTS_DIR}")
    
    for proj_dir in sorted(os.listdir(PROJECTS_DIR)):
        proj_path = os.path.join(PROJECTS_DIR, proj_dir)
        if not os.path.isdir(proj_path):
            continue
        
        project_name = decode_project_name(proj_dir)
        jsonl_files = [f for f in os.listdir(proj_path) if f.endswith('.jsonl')]
        
        print(f"  {project_name} ({len(jsonl_files)} sessions)")
        
        for fname in sorted(jsonl_files):
            filepath = os.path.join(proj_path, fname)
            if '/subagents/' in filepath.replace('\\', '/'):
                continue
            try:
                session = parse_session_metadata(filepath)
                if session:
                    session['project'] = session['project'] or project_name
                    sessions.append(session)
            except Exception as e:
                print(f"    ❌ {fname[:30]}... ({e})")
    
    return sessions

def main():
    parser = argparse.ArgumentParser(description='Export Claude Code session metadata')
    parser.add_argument('--push', action='store_true', help='Commit and push to GitHub')
    args = parser.parse_args()
    
    sessions = export_all()
    
    if not sessions:
        print("\nNo sessions found.")
        sys.exit(0)
    
    output = {
        'platform': 'claude-code',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'exported_from': os.uname().nodename if hasattr(os, 'uname') else 'unknown',
        'total_sessions': len(sessions),
        'total_messages': sum(s['message_count'] for s in sessions),
        'metadata_only': True,
        'sessions': sessions,
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\nExported {len(sessions)} sessions ({output['total_messages']} messages)")
    print(f"Metadata only — no message content, safe for GitHub")
    print(f"Output: {OUTPUT_FILE}")
    
    if args.push:
        push_to_github()

def push_to_github():
    repo_dir = None
    for search in [
        os.path.expanduser("~/hermes-topic-dashboard"),
        os.path.expanduser("~/projects/hermes-topic-dashboard"),
    ]:
        if os.path.isdir(os.path.join(search, '.git')):
            repo_dir = search
            break
    
    if not repo_dir:
        print("⚠ Could not find hermes-topic-dashboard repo.")
        return
    
    import shutil
    dest = os.path.join(repo_dir, GITHUB_FILE)
    shutil.copy(OUTPUT_FILE, dest)
    
    os.chdir(repo_dir)
    subprocess.run(['git', 'add', GITHUB_FILE], check=True)
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    subprocess.run(['git', 'commit', '-m', f'data: Claude Code sessions [{ts}]'], check=True)
    subprocess.run(['git', 'pull', '--rebase'], check=False)
    subprocess.run(['git', 'push'], check=True)
    print("✅ Pushed to GitHub")

if __name__ == '__main__':
    main()
