import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const allowedOrigins = new Set(
  [
    "https://agenthub-guru-claude.onrender.com",
    "https://app.agenthub.guru",
    "https://admin.agenthub.guru",
    process.env.FRONTEND_ORIGIN,
  ].filter(Boolean) as string[],
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV !== "test") {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

app.disable("x-powered-by");
// Behind Render's proxy (and the static site's /api rewrite): use X-Forwarded-For
// so req.ip is the real client (login rate limiting keys on it).
app.set("trust proxy", true);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      // Disallowed origin: no CORS headers (browser blocks it) instead of a 500.
      cb(null, false);
    },
    credentials: true,
  }),
);
app.use(cookieParser(sessionSecret ?? "test-only-secret"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Unknown API path → JSON 404 (not Express's HTML page).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// Last-resort error handler: log it, return JSON, never leak a stack trace.
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) return next(err);
    const status =
      typeof (err as { status?: unknown })?.status === "number"
        ? (err as { status: number }).status
        : 500;
    req.log?.error({ err }, "unhandled route error");
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: status >= 500 ? "internal_error" : "bad_request",
    });
  },
);

export default app;
