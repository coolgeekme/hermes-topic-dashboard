#!/usr/bin/env python3
"""
Hermes topic exporter — reads state.db and writes the per-session topics file
consumed by github_merge.py.

Produces:
  data/hermes_topics.json                     (committed to repo)
  ~/.hermes/topic_dashboard_data/topics.json  (consumed by github_merge.py)
"""
import sqlite3
import json
import os
import sys
import time
import hashlib
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from github_merge import redact_text  # single source of truth for secret redaction

DB_PATH = os.path.expanduser("~/.hermes/state.db")
REPO_DIR = "/root/projects/hermes-topic-dashboard"
OUT_REPO = os.path.join(REPO_DIR, "data", "hermes_topics.json")
OUT_HERMES = os.path.expanduser("~/.hermes/topic_dashboard_data/topics.json")

MAX_MSGS_PER_TOPIC = 50


def iso(ts):
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM sessions WHERE archived=0 "
        "ORDER BY COALESCE(last_activity_at, started_at) DESC"
    )
    sessions = cur.fetchall()

    topics = []
    for s in sessions:
        sid = s["id"]
        title = (s["title"] or "").strip()
        name = title or f"Session {sid}"[:24]
        tid = hashlib.md5((title or sid).encode("utf-8")).hexdigest()[:12]

        cur.execute(
            "SELECT id, session_id, role, content, tool_name, display_kind, timestamp "
            "FROM messages WHERE session_id=? AND role IN ('user','assistant') "
            "AND active=1 ORDER BY timestamp ASC, id ASC",
            (sid,),
        )
        rows = cur.fetchall()[-MAX_MSGS_PER_TOPIC:]

        messages = []
        for m in rows:
            ts = m["timestamp"]
            messages.append({
                "id": m["id"],
                "session_id": m["session_id"],
                "role": m["role"],
                "content": redact_text(m["content"] or ""),
                "timestamp": ts,
                "tool_name": m["tool_name"],
                "display_kind": m["display_kind"],
                "timestamp_iso": iso(ts),
            })

        last_active = s["last_activity_at"] or s["started_at"]
        if title:
            preview = title
        elif messages:
            preview = messages[0]["content"][:100]
        else:
            preview = ""

        topics.append({
            "id": tid,
            "name": name,
            "sessions": [sid],
            "message_count": s["message_count"],
            "session_count": 1,
            "last_active": last_active,
            "last_active_iso": iso(last_active),
            "preview": preview,
            "is_cron": s["source"] == "cron",
            "messages": messages,
        })

    conn.close()

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_at_ts": time.time(),
        "total_sessions": len(topics),
        "total_messages_approx": sum(t["message_count"] for t in topics),
        "topics": topics,
    }

    os.makedirs(os.path.dirname(OUT_REPO), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_HERMES), exist_ok=True)
    for path in (OUT_REPO, OUT_HERMES):
        with open(path, "w") as f:
            json.dump(output, f, ensure_ascii=False)

    print(f"Exported {len(topics)} topics / {len(topics)} sessions "
          f"({output['total_messages_approx']} msgs)")
    print(f"  -> {OUT_REPO}")
    print(f"  -> {OUT_HERMES}")


if __name__ == "__main__":
    main()
