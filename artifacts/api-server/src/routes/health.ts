import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Public, DB-touching health check — the keep-warm pings use it so both the
// Render instance AND the Neon database stay awake (auth-protected routes 401).
router.get("/healthz/db", async (_req, res) => {
  const started = Date.now();
  try {
    await pool.query("select 1");
    res.json({ status: "ok", db: "ok", ms: Date.now() - started });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable" });
  }
});

export default router;
