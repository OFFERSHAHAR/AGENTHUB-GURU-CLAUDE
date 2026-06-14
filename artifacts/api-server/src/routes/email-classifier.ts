import { Router } from "express";
import { db } from "@workspace/db";
import { emailLeads } from "@workspace/db/schema";
import { desc, eq, count, sql } from "drizzle-orm";
import { classifyEmail } from "../services/email-classifier";
import { sendTelegramMessage } from "../lib/telegram-notify";

const router = Router();

function getOpsChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID || null;
}

function scoreEmoji(score: string): string {
  if (score === "HOT") return "🔥";
  if (score === "WARM") return "🟡";
  return "🧊";
}

async function notifyNewLead(lead: typeof emailLeads.$inferSelect) {
  const chatId = getOpsChatId();
  if (!chatId) return;
  const emoji = scoreEmoji(lead.leadScore);
  const signals = Array.isArray(lead.keySignals) && lead.keySignals.length
    ? lead.keySignals.join(", ")
    : "—";

  const text = [
    `${emoji} <b>ליד חדש מסווג</b>`,
    ``,
    `📨 <b>מאת:</b> ${lead.fromName || lead.fromAddress || "לא ידוע"}`,
    `📌 <b>נושא:</b> ${lead.subject || "—"}`,
    `🏷 <b>קטגוריה:</b> ${lead.category}`,
    `📦 <b>חבילה מומלצת:</b> ${lead.recommendedPackage || "—"}`,
    `✅ <b>ציון ביטחון:</b> ${Math.round((lead.confidence ?? 0) * 100)}%`,
    ``,
    `📝 <b>תמצית:</b>`,
    lead.summaryHe || "—",
    ``,
    `🔑 <b>אותות מפתח:</b> ${signals}`,
    ``,
    `⚡ <b>הצעד הבא:</b> ${lead.nextAction || "—"}`,
  ].join("\n");

  await sendTelegramMessage(chatId, text);
}

router.post("/email-classifier/classify", async (req, res) => {
  try {
    const {
      sourceFile = "unknown.eml",
      fromAddress = "",
      fromName = "",
      subject = "",
      bodyText = "",
      rawPayload,
    } = req.body as {
      sourceFile?: string;
      fromAddress?: string;
      fromName?: string;
      subject?: string;
      bodyText?: string;
      rawPayload?: unknown;
    };

    if (!bodyText && !subject) {
      return res.status(400).json({ error: "subject or bodyText required" });
    }

    const classification = await classifyEmail(subject, bodyText, fromAddress);

    const [inserted] = await db
      .insert(emailLeads)
      .values({
        sourceFile,
        fromAddress: fromAddress || null,
        fromName: fromName || null,
        subject: subject || null,
        bodyText: bodyText.slice(0, 8000) || null,
        category: classification.category,
        categorySlug: classification.categorySlug,
        leadScore: classification.leadScore,
        confidence: classification.confidence,
        summaryHe: classification.summaryHe,
        recommendedPackage: classification.recommendedPackage,
        keySignals: classification.keySignals,
        nextAction: classification.nextAction,
        rawPayload: rawPayload ?? null,
        telegramSent: 0,
      })
      .returning();

    notifyNewLead(inserted).then(() => {
      db.update(emailLeads)
        .set({ telegramSent: 1 })
        .where(eq(emailLeads.id, inserted.id))
        .catch(() => {});
    }).catch(() => {});

    return res.json({ ok: true, lead: inserted });
  } catch (err) {
    console.error("[email-classifier] classify error:", err);
    return res.status(500).json({ error: "classification failed" });
  }
});

router.get("/email-classifier/results", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const categorySlug = req.query.category as string | undefined;
    const leadScore = req.query.score as string | undefined;

    let query = db.select().from(emailLeads).$dynamic();
    if (categorySlug) query = query.where(eq(emailLeads.categorySlug, categorySlug));
    if (leadScore) query = query.where(eq(emailLeads.leadScore, leadScore));
    query = query.orderBy(desc(emailLeads.createdAt)).limit(limit);

    const results = await query;
    return res.json(results);
  } catch (err) {
    console.error("[email-classifier] results error:", err);
    return res.status(500).json({ error: "failed to load results" });
  }
});

router.get("/email-classifier/stats", async (req, res) => {
  try {
    const byCategory = await db
      .select({ category: emailLeads.category, categorySlug: emailLeads.categorySlug, cnt: count() })
      .from(emailLeads)
      .groupBy(emailLeads.category, emailLeads.categorySlug)
      .orderBy(desc(count()));

    const byScore = await db
      .select({ leadScore: emailLeads.leadScore, cnt: count() })
      .from(emailLeads)
      .groupBy(emailLeads.leadScore);

    const [totRow] = await db.select({ total: count() }).from(emailLeads);

    return res.json({
      total: Number(totRow?.total ?? 0),
      byCategory,
      byScore,
    });
  } catch (err) {
    console.error("[email-classifier] stats error:", err);
    return res.status(500).json({ error: "failed to load stats" });
  }
});

const AGENT_SCRIPT = `#!/usr/bin/env python3
"""
AgentHub - Email Lead Classifier Agent
=======================================
Monitors a folder, reads new emails, sends to AgentHub for classification,
and saves classified JSON to the output folder.

Usage (Windows CMD - one line):
    python email_agent.py --inbox C:\\\\email-inbox --output C:\\\\classified-leads --server https://agenthub.guru

Usage (Mac/Linux):
    python email_agent.py --inbox ~/email-inbox --output ~/classified-leads --server https://agenthub.guru

Install dependencies first:
    pip install watchdog requests pdfplumber

Image/screenshot OCR support:
    Reads PNG/JPG/WEBP screenshots using Groq Vision (free, no extra key needed).
    Set GROQ_API_KEY env var before running:
        export GROQ_API_KEY=your_key_here
    Supported image formats: .png .jpg .jpeg .webp
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
    print("Missing: pip install requests watchdog")
    sys.exit(1)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("email-agent")

SUPPORTED_EXTENSIONS = {".eml", ".txt", ".msg", ".pdf", ".png", ".jpg", ".jpeg", ".webp"}
IMAGE_EXTENSIONS   = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_MIME         = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


def parse_eml(path):
    try:
        raw = path.read_bytes()
        msg = email.message_from_bytes(raw, policy=email.policy.default)
        from_addr = msg.get("From", "")
        subject = msg.get("Subject", "")
        body_parts = []
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    try:
                        body_parts.append(part.get_content())
                    except Exception:
                        pass
        else:
            try:
                body_parts.append(msg.get_content())
            except Exception:
                body_parts.append(str(msg.get_payload(decode=True), "utf-8", errors="replace"))
        body = "\\n".join(body_parts).strip()
        from_name, from_address = email.utils.parseaddr(from_addr)
        return {"fromName": from_name or "", "fromAddress": from_address or from_addr, "subject": subject, "bodyText": body}
    except Exception as e:
        log.warning(f"parse_eml error for {path.name}: {e}")
        return {"fromName": "", "fromAddress": "", "subject": path.stem, "bodyText": path.read_text(errors="replace")}


def parse_gmail_export(lines, text):
    """Parse Gmail 'Print all' / copy-paste export format.
    Line 0: 'Gmail[\\t| ]{recipient}'
    Line 1: subject
    Line 2: 'N message(s)'
    Line 3: '{Sender Name} <email>[\\t| ]{date}'
    Line 4: 'To: ...'
    Lines 5+: body
    """
    subject = lines[1].strip() if len(lines) > 1 else ""
    from_name, from_address = "", ""
    body_start = 5
    if len(lines) > 3:
        # Split on tab OR on date-like suffix (e.g. "10 June 2026")
        raw = lines[3]
        # Try tab split first, then strip trailing date heuristic
        if "\\t" in raw:
            sender_line = raw.split("\\t")[0].strip()
        else:
            import re
            sender_line = re.sub(r"\\s+\\d{1,2}\\s+\\w+\\s+\\d{4}.*$", "", raw).strip()
        from_name, from_address = email.utils.parseaddr(sender_line)
        if not from_address and "<" not in sender_line:
            # Might be "Name Surname <email>" without angle brackets — try whole string
            from_address = sender_line
    # body starts after 'To:' line or first blank line after line 3
    for i in range(4, min(15, len(lines))):
        ll = lines[i].lower()
        if ll.startswith("to:") or ll.startswith("cc:") or ll.startswith("bcc:"):
            body_start = i + 1
            continue
        if lines[i].strip() == "" and body_start > i:
            body_start = i + 1
            break
    body = "\\n".join(lines[body_start:]).strip() or text
    return {"fromName": from_name, "fromAddress": from_address, "subject": subject, "bodyText": body}


def _is_garbled(text):
    """Heuristic: if >35% of non-space chars are outside normal Hebrew/Latin/digit range,
    the text is likely a bad PDF extraction (wrong encoding)."""
    chars = [c for c in text if not c.isspace()]
    if len(chars) < 20:
        return False
    bad = sum(
        1 for c in chars
        if not (
            "\\u0020" <= c <= "\\u007e" or   # Basic Latin
            "\\u00c0" <= c <= "\\u024f" or   # Latin extended
            "\\u05d0" <= c <= "\\u05ea" or   # Hebrew letters
            "\\u05f0" <= c <= "\\u05f4" or   # Hebrew ligatures
            c.isdigit() or c in ".,!?:;()[]{}@#$%&*+-=/<>\\"\\' \\n\\r\\t"
        )
    )
    return (bad / len(chars)) > 0.35


def parse_txt(path):
    text = path.read_text(errors="replace")
    lines = text.splitlines()

    # Detect Gmail export: first non-empty line starts with "Gmail" (tab or space follows)
    first = lines[0].strip() if lines else ""
    if first.lower().startswith("gmail"):
        return parse_gmail_export(lines, text)

    from_address, from_name, subject = "", "", path.stem
    body_start = 0
    for i, line in enumerate(lines[:20]):
        ll = line.lower()
        if ll.startswith("from:"):
            from_name, from_address = email.utils.parseaddr(line[5:].strip())
        elif ll.startswith("subject:"):
            subject = line[8:].strip()
        elif ll.startswith("נושא:") or ll.startswith("מאת:"):
            # Hebrew header variants
            if ll.startswith("נושא:"):
                subject = line[5:].strip()
            else:
                from_name, from_address = email.utils.parseaddr(line[5:].strip())
        elif line.strip() == "" and i > 0 and (from_address or subject != path.stem):
            body_start = i + 1
            break
    body = "\\n".join(lines[body_start:]).strip() or text
    return {"fromName": from_name, "fromAddress": from_address, "subject": subject, "bodyText": body}


def parse_pdf(path):
    """Extract text from a PDF file using pdfplumber.
    Falls back gracefully when Hebrew fonts produce garbled output."""
    if not HAS_PDF:
        log.warning("pdfplumber not installed — cannot read PDF. Run: pip install pdfplumber")
        return {"fromName": "", "fromAddress": "", "subject": path.stem, "bodyText": f"[PDF: {path.name} — install pdfplumber to read]"}
    try:
        import warnings
        pages_text = []
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")   # suppress FontBBox noise
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    # Try layout-aware extraction first, fall back to plain
                    t = page.extract_text(x_tolerance=3, y_tolerance=3)
                    if not t:
                        t = page.extract_text()
                    if t:
                        pages_text.append(t)
        full_text = "\\n\\n".join(pages_text).strip()

        # Detect garbled extraction (common with Hebrew embedded fonts)
        if not full_text or _is_garbled(full_text):
            log.warning(f"PDF text extraction garbled for {path.name} — sending filename as subject")
            return {
                "fromName": "",
                "fromAddress": "",
                "subject": path.stem,
                "bodyText": f"[PDF: {path.name}]\\n\\n{full_text[:500] if full_text else '(no text extracted)'}",
            }

        # Try to find From/Subject in first 20 lines (some PDFs are exported emails)
        lines = full_text.splitlines()
        from_name, from_address, subject = "", "", path.stem
        for line in lines[:20]:
            ll = line.lower()
            if ll.startswith("from:"):
                from_name, from_address = email.utils.parseaddr(line[5:].strip())
            elif ll.startswith("subject:"):
                subject = line[8:].strip()
        return {"fromName": from_name, "fromAddress": from_address, "subject": subject, "bodyText": full_text}
    except Exception as e:
        log.warning(f"parse_pdf error for {path.name}: {e}")
        return {"fromName": "", "fromAddress": "", "subject": path.stem, "bodyText": f"[PDF parse error: {e}]"}


def parse_image(path):
    """Extract email content from a screenshot using Groq Vision API.
    Falls back to empty fields if GROQ_API_KEY is not set or call fails."""
    import base64
    import re as _re

    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        log.warning(f"GROQ_API_KEY not set — cannot OCR image {path.name}")
        return {"fromName": "", "fromAddress": "", "subject": path.stem,
                "bodyText": f"[Image: {path.name} — set GROQ_API_KEY to enable OCR]"}

    ext  = path.suffix.lower()
    mime = IMAGE_MIME.get(ext, "image/jpeg")
    try:
        b64 = base64.b64encode(path.read_bytes()).decode("utf-8")
    except Exception as e:
        return {"fromName": "", "fromAddress": "", "subject": path.stem,
                "bodyText": f"[Image read error: {e}]"}

    prompt = (
        "This is a screenshot of an email (possibly in Hebrew or English). "
        "Extract the metadata and body. "
        "Return ONLY a JSON object with these exact keys:\\n"
        "{\\n"
        '  "fromName": "sender display name, or empty string",\\n'
        '  "fromAddress": "sender email address, or empty string",\\n'
        '  "subject": "email subject line",\\n'
        '  "bodyText": "full plain-text body of the email"\\n'
        "}\\n"
        "If a field is not visible, use an empty string. No extra text outside the JSON."
    )

    payload = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                {"type": "text", "text": prompt},
            ],
        }],
        "max_tokens": 1024,
        "temperature": 0,
    }

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=40,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip markdown fences if model wrapped it (avoid backtick literals in regex)
        fence = chr(96) * 3
        content = _re.sub(r"^" + fence + r"[a-z]*\\n?|" + fence + r"$", "", content.strip(), flags=_re.MULTILINE).strip()
        m = _re.search(r"\\{.*\\}", content, _re.DOTALL)
        if m:
            data = json.loads(m.group())
            result = {
                "fromName":    str(data.get("fromName",    "")),
                "fromAddress": str(data.get("fromAddress", "")),
                "subject":     str(data.get("subject",     path.stem)),
                "bodyText":    str(data.get("bodyText",    "")),
            }
            log.info(f"  OCR OK — from: {result['fromAddress'] or '?'} | subject: {result['subject'][:60]}")
            return result
        # Model returned plain text — use as body
        log.warning(f"  OCR returned non-JSON for {path.name}, using raw text as body")
        return {"fromName": "", "fromAddress": "", "subject": path.stem, "bodyText": content}
    except Exception as e:
        log.warning(f"parse_image error for {path.name}: {e}")
        return {"fromName": "", "fromAddress": "", "subject": path.stem,
                "bodyText": f"[Image OCR error: {e}]"}


def parse_file(path):
    ext = path.suffix.lower()
    if ext in {".eml", ".msg"}:
        return parse_eml(path)
    if ext == ".pdf":
        return parse_pdf(path)
    if ext in IMAGE_EXTENSIONS:
        return parse_image(path)
    return parse_txt(path)


def file_hash(path):
    return hashlib.md5(path.read_bytes()).hexdigest()


def classify(server, file_path, parsed):
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
        log.error(f"Cannot connect to server: {server}")
        return None
    except Exception as e:
        log.error(f"classify error: {e}")
        return None


def save_result(output_dir, file_path, lead):
    out_file = output_dir / f"{file_path.stem}_classified.json"
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
    log.info(f"Saved: {out_file.name}")
    return out_file


def move_to_processed(file_path, processed_dir):
    processed_dir.mkdir(parents=True, exist_ok=True)
    dest = processed_dir / file_path.name
    if dest.exists():
        ts = datetime.now().strftime("%H%M%S")
        dest = processed_dir / f"{file_path.stem}_{ts}{file_path.suffix}"
    file_path.rename(dest)
    log.info(f"Moved to processed: {dest.name}")


def process_file(path, output_dir, processed_dir, server, seen_hashes):
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return
    if not path.exists():
        return
    h = file_hash(path)
    if h in seen_hashes:
        return
    seen_hashes.add(h)
    log.info(f"Processing: {path.name}")
    parsed = parse_file(path)
    log.info(f"  Subject: {parsed.get('subject', '-')}")
    lead = classify(server, path, parsed)
    if lead is None:
        log.error(f"  Classification failed for {path.name}")
        seen_hashes.discard(h)
        return
    score_icon = {"HOT": "FIRE", "WARM": "WARM", "COLD": "COLD"}.get(lead.get("leadScore", ""), "?")
    log.info(f"  [{score_icon}] {lead.get('category')} ({round((lead.get('confidence') or 0)*100)}%)")
    save_result(output_dir, path, lead)
    move_to_processed(path, processed_dir)


class InboxHandler(FileSystemEventHandler):
    def __init__(self, output_dir, processed_dir, server, seen_hashes):
        self.output_dir = output_dir
        self.processed_dir = processed_dir
        self.server = server
        self.seen_hashes = seen_hashes

    def on_created(self, event):
        if not event.is_directory:
            time.sleep(0.5)
            process_file(Path(event.src_path), self.output_dir, self.processed_dir, self.server, self.seen_hashes)

    def on_moved(self, event):
        if not event.is_directory:
            time.sleep(0.3)
            process_file(Path(event.dest_path), self.output_dir, self.processed_dir, self.server, self.seen_hashes)


def main():
    parser = argparse.ArgumentParser(description="AgentHub Email Lead Classifier")
    parser.add_argument("--inbox", default=str(Path.home() / "email-inbox"), help="Input folder - drop .eml/.txt files here")
    parser.add_argument("--output", default=str(Path.home() / "classified-leads"), help="Output folder - classified JSON saved here")
    parser.add_argument("--server", default="https://agenthub.guru", help="AgentHub server URL")
    parser.add_argument("--interval", type=int, default=3, help="Polling interval in seconds (fallback if no watchdog)")
    args = parser.parse_args()

    inbox_dir = Path(args.inbox)
    output_dir = Path(args.output)
    processed_dir = inbox_dir / "processed"

    inbox_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("\\n" + "="*55)
    print("  AgentHub - Email Lead Classifier Agent")
    print("="*55)
    print(f"  Input folder:  {inbox_dir}")
    print(f"  Output folder: {output_dir}")
    print(f"  Server:        {args.server}")
    print(f"  Mode:          {'watchdog (instant)' if HAS_WATCHDOG else 'polling every ' + str(args.interval) + 's'}")
    print("="*55)
    pdf_status = "enabled" if HAS_PDF else "install pdfplumber to enable"
    ocr_status = "enabled (Groq Vision)" if os.environ.get("GROQ_API_KEY") else "set GROQ_API_KEY to enable"
    print(f"  PDF support:   {pdf_status}")
    print(f"  Image OCR:     {ocr_status}")
    print("="*55)
    print("\\n  Drop .eml / .txt / .pdf / .png / .jpg / .webp files into the input folder")
    print("  Press Ctrl+C to stop\\n")

    seen_hashes = set()
    existing = [f for f in inbox_dir.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS]
    if existing:
        log.info(f"Processing {len(existing)} existing files...")
        for f in existing:
            process_file(f, output_dir, processed_dir, args.server, seen_hashes)

    if HAS_WATCHDOG:
        handler = InboxHandler(output_dir, processed_dir, args.server, seen_hashes)
        observer = Observer()
        observer.schedule(handler, str(inbox_dir), recursive=False)
        observer.start()
        log.info("Watching folder (watchdog mode)...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()
    else:
        log.warning("watchdog not installed - using polling every %ds", args.interval)
        while True:
            try:
                for f in inbox_dir.iterdir():
                    if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
                        process_file(f, output_dir, processed_dir, args.server, seen_hashes)
                time.sleep(args.interval)
            except KeyboardInterrupt:
                break

    print("\\nAgent stopped.")


if __name__ == "__main__":
    main()
`;

router.get("/email-classifier/agent-script", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="email_agent.py"');
  return res.send(AGENT_SCRIPT);
});

router.delete("/email-classifier/results/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(emailLeads).where(eq(emailLeads.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to delete" });
  }
});

export default router;
