/**
 * Open-Source Hub support: live GitHub star counts.
 *
 * The hub lists curated open-source agent projects. Instead of hard-coded star
 * numbers, this endpoint fetches live counts from the GitHub API, cached for an
 * hour so a page load never burns the unauthenticated 60/hr rate limit. On any
 * error or rate-limit it falls back to the last cached value (or null, letting
 * the client keep its static label).
 */
import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface CacheEntry { stars: number; at: number; }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchStars(repo: string): Promise<number | null> {
  const cached = cache.get(repo);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.stars;
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "AgentHub-OpenSourceHub",
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!r.ok) return cached?.stars ?? null;
    const j = (await r.json()) as { stargazers_count?: number };
    if (typeof j.stargazers_count === "number") {
      cache.set(repo, { stars: j.stargazers_count, at: Date.now() });
      return j.stargazers_count;
    }
    return cached?.stars ?? null;
  } catch {
    return cached?.stars ?? null;
  }
}

// GET /api/opensource/stars?repos=owner/repo,owner/repo
router.get("/opensource/stars", async (req, res): Promise<void> => {
  const reposParam = String(req.query.repos || "").trim();
  if (!reposParam) {
    res.json({ stars: {} });
    return;
  }
  const repos = reposParam
    .split(",")
    .map((s) => s.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""))
    .filter((s) => /^[\w.-]+\/[\w.-]+$/.test(s))
    .slice(0, 40);

  const entries = await Promise.all(repos.map(async (r) => [r, await fetchStars(r)] as const));
  const stars: Record<string, number | null> = {};
  for (const [r, s] of entries) stars[r] = s;
  res.json({ stars, cachedAt: new Date().toISOString() });
});

export default router;
