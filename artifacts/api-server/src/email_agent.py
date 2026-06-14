#!/usr/bin/env python3
"""
AgentHub — Email Lead Classifier Agent
=======================================
מנטר תיקיה, קורא מיילים חדשים, שולח לשרת AgentHub לסיווג,
ושומר JSON מסווג לתיקיית הפלט.

שימוש:
    python email_agent.py \
        --inbox ~/Desktop/email-inbox \
        --output ~/Desktop/classified-leads \
        --server https://agenthub.guru

התקנה:
    pip install watchdog requests
"""

import argparse
import json
import os
import sys
import time
import email
import email.policy
import hashlib
import logging
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌ חסר: pip install requests watchdog")
    sys.exit(1)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False

# ── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("email-agent")

SUPPORTED_EXTENSIONS = {".eml", ".txt", ".msg"}


# ── Email parsing ─────────────────────────────────────────

def parse_eml(path: Path) -> dict:
    """Parse .eml file, return dict with from/subject/body."""
    try:
        raw = path.read_bytes()
        msg = email.message_from_bytes(raw, policy=email.policy.default)
        from_addr = msg.get("From", "")
        subject = msg.get("Subject", "")

        # Extract plain-text body
        body_parts = []
        if msg.is_multipart():
            for part in msg.walk():
                ct = part.get_content_type()
                if ct == "text/plain":
                    try:
                        body_parts.append(part.get_content())
                    except Exception:
                        pass
        else:
            try:
                body_parts.append(msg.get_content())
            except Exception:
                body_parts.append(str(msg.get_payload(decode=True), "utf-8", errors="replace"))

        body = "\n".join(body_parts).strip()

        # Parse from name/address
        from_name, from_address = email.utils.parseaddr(from_addr)
        return {
            "fromName": from_name or "",
            "fromAddress": from_address or from_addr,
            "subject": subject,
            "bodyText": body,
        }
    except Exception as e:
        log.warning(f"parse_eml error for {path.name}: {e}")
        return {"fromName": "", "fromAddress": "", "subject": path.stem, "bodyText": path.read_text(errors="replace")}


def parse_txt(path: Path) -> dict:
    """Parse plain text file as email body."""
    text = path.read_text(errors="replace")
    lines = text.splitlines()
    # Try to detect From: / Subject: headers at top
    from_address, from_name, subject = "", "", path.stem
    body_start = 0
    for i, line in enumerate(lines[:10]):
        if line.lower().startswith("from:"):
            raw = line[5:].strip()
            from_name, from_address = email.utils.parseaddr(raw)
        elif line.lower().startswith("subject:"):
            subject = line[8:].strip()
        elif line.strip() == "" and i > 0:
            body_start = i + 1
            break
    body = "\n".join(lines[body_start:]).strip() or text
    return {"fromName": from_name, "fromAddress": from_address, "subject": subject, "bodyText": body}


def parse_file(path: Path) -> dict:
    ext = path.suffix.lower()
    if ext == ".eml" or ext == ".msg":
        return parse_eml(path)
    return parse_txt(path)


# ── Dedup ─────────────────────────────────────────────────

def file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


# ── Classify via AgentHub API ─────────────────────────────

def classify(server: str, file_path: Path, parsed: dict) -> dict | None:
    url = server.rstrip("/") + "/api/email-classifier/classify"
    payload = {
        "sourceFile": file_path.name,
        "fromAddress": parsed.get("fromAddress", ""),
        "fromName": parsed.get("fromName", ""),
        "subject": parsed.get("subject", ""),
        "bodyText": parsed.get("bodyText", ""),
    }
    try:
        resp = requests.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        if data.get("ok"):
            return data.get("lead")
        log.error(f"Server error: {data}")
        return None
    except requests.exceptions.ConnectionError:
        log.error(f"❌ לא ניתן להתחבר לשרת: {server}")
        return None
    except Exception as e:
        log.error(f"classify error: {e}")
        return None


# ── Save result JSON ──────────────────────────────────────

def save_result(output_dir: Path, file_path: Path, lead: dict):
    stem = file_path.stem
    out_file = output_dir / f"{stem}_classified.json"
    # Pretty, RTL-friendly JSON
    result = {
        "classified_at": datetime.now().isoformat(),
        "source_file": lead.get("sourceFile", file_path.name),
        "from_name": lead.get("fromName", ""),
        "from_address": lead.get("fromAddress", ""),
        "subject": lead.get("subject", ""),
        "category": lead.get("category", ""),
        "category_slug": lead.get("categorySlug", ""),
        "lead_score": lead.get("leadScore", ""),
        "confidence_pct": round((lead.get("confidence") or 0) * 100),
        "summary_he": lead.get("summaryHe", ""),
        "recommended_package": lead.get("recommendedPackage", ""),
        "key_signals": lead.get("keySignals", []),
        "next_action": lead.get("nextAction", ""),
        "telegram_sent": bool(lead.get("telegramSent")),
        "agenthub_id": lead.get("id"),
    }
    out_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info(f"💾 שמור: {out_file.name}")
    return out_file


# ── Move processed file ───────────────────────────────────

def move_to_processed(file_path: Path, processed_dir: Path):
    processed_dir.mkdir(parents=True, exist_ok=True)
    dest = processed_dir / file_path.name
    # Avoid collision
    if dest.exists():
        ts = datetime.now().strftime("%H%M%S")
        dest = processed_dir / f"{file_path.stem}_{ts}{file_path.suffix}"
    file_path.rename(dest)
    log.info(f"📦 הועבר לעיבוד: {dest.name}")


# ── Process a single file ─────────────────────────────────

def process_file(path: Path, output_dir: Path, processed_dir: Path, server: str, seen_hashes: set):
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return
    if not path.exists():
        return

    h = file_hash(path)
    if h in seen_hashes:
        log.debug(f"דילוג (כבר עובד): {path.name}")
        return
    seen_hashes.add(h)

    log.info(f"📨 מעבד: {path.name}")
    parsed = parse_file(path)
    log.info(f"   נושא: {parsed.get('subject', '—')}")

    lead = classify(server, path, parsed)
    if lead is None:
        log.error(f"   ❌ סיווג נכשל עבור {path.name}")
        seen_hashes.discard(h)
        return

    score_icon = {"HOT": "🔥", "WARM": "🟡", "COLD": "🧊"}.get(lead.get("leadScore", ""), "❓")
    log.info(f"   {score_icon} {lead.get('category')} ({round((lead.get('confidence') or 0)*100)}%)")

    save_result(output_dir, path, lead)
    move_to_processed(path, processed_dir)


# ── Watchdog handler ──────────────────────────────────────

class InboxHandler(FileSystemEventHandler):
    def __init__(self, output_dir, processed_dir, server, seen_hashes):
        self.output_dir = output_dir
        self.processed_dir = processed_dir
        self.server = server
        self.seen_hashes = seen_hashes

    def on_created(self, event):
        if event.is_directory:
            return
        time.sleep(0.5)  # Wait for file write to complete
        process_file(Path(event.src_path), self.output_dir, self.processed_dir, self.server, self.seen_hashes)

    def on_moved(self, event):
        if event.is_directory:
            return
        time.sleep(0.3)
        process_file(Path(event.dest_path), self.output_dir, self.processed_dir, self.server, self.seen_hashes)


# ── Main ──────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="AgentHub Email Lead Classifier")
    parser.add_argument("--inbox", default=str(Path.home() / "Desktop" / "email-inbox"),
                        help="תיקיית מקור — גרור לכאן מיילים")
    parser.add_argument("--output", default=str(Path.home() / "Desktop" / "classified-leads"),
                        help="תיקיית פלט — JSON מסווג נשמר כאן")
    parser.add_argument("--server", default="https://agenthub.guru",
                        help="כתובת שרת AgentHub")
    parser.add_argument("--interval", type=int, default=3,
                        help="תדירות סריקה בשניות (fallback ללא watchdog)")
    args = parser.parse_args()

    inbox_dir = Path(args.inbox).expanduser()
    output_dir = Path(args.output).expanduser()
    processed_dir = inbox_dir / "processed"

    inbox_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("\n" + "="*55)
    print("  AgentHub — Email Lead Classifier Agent")
    print("="*55)
    print(f"  📁 תיקיית קלט:   {inbox_dir}")
    print(f"  💾 תיקיית פלט:   {output_dir}")
    print(f"  🌐 שרת:          {args.server}")
    print(f"  🔍 מצב:          {'watchdog (מיידי)' if HAS_WATCHDOG else 'polling'}")
    print("="*55)
    print("\n  גרור קבצי .eml / .txt לתיקיית הקלט")
    print("  לעצירה: Ctrl+C\n")

    # Process any existing files first
    seen_hashes: set = set()
    existing = [f for f in inbox_dir.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS]
    if existing:
        log.info(f"מעבד {len(existing)} קבצים קיימים...")
        for f in existing:
            process_file(f, output_dir, processed_dir, args.server, seen_hashes)

    if HAS_WATCHDOG:
        handler = InboxHandler(output_dir, processed_dir, args.server, seen_hashes)
        observer = Observer()
        observer.schedule(handler, str(inbox_dir), recursive=False)
        observer.start()
        log.info("👀 מנטר תיקיה (watchdog)...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()
    else:
        log.warning("watchdog לא מותקן — משתמש ב-polling כל %ds", args.interval)
        while True:
            try:
                for f in inbox_dir.iterdir():
                    if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
                        process_file(f, output_dir, processed_dir, args.server, seen_hashes)
                time.sleep(args.interval)
            except KeyboardInterrupt:
                break

    print("\n👋 הסוכן נסגר.")


if __name__ == "__main__":
    main()
