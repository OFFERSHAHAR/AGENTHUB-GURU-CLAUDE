---
name: Groq TPM limits and Hebrew prompts
description: Hebrew tokenizes ~3-4 tok/word; long Hebrew system prompts overflow Groq's per-minute limit; spec-agent fix pattern.
---

## The rule
Keep system prompts that go to Groq 8B (fallback tier) in English, with inline/compact JSON examples.
Hebrew text is expensive in tokens: ~3-4 tokens per word vs ~1.3 for English.

## Why
Groq llama-3.1-8b-instant has a **6,000 TPM** (tokens per minute) limit on on-demand.
A full Hebrew system prompt + agents list + conversation history can easily hit 6000+ tokens *per single request*.
Groq 70B (starter) has the same 6K TPM cap, but only 100-200K TPD (runs out in minutes of spec conversations).

## How to apply
- spec-agent system prompt: English rules + single-line JSON template + agents as `ID N: name` only
- Agents list: omit descriptions (saves ~400 tokens)
- If adding a Hebrew-heavy prompt to any route, estimate tokens: char_count / 2.5 ≈ tokens (Hebrew), char_count / 4 ≈ tokens (English)
- "fallback" is now a valid ModelTier → Groq 8B (14K RPD, 500K TPD); prefer over "starter" (70B, 100 RPD) for high-volume routes like spec-agent
- Ollama ("free" tier) is NOT available on Replit itself — only if OLLAMA_BASE_URL points to an external server
