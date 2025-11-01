import 'dotenv/config';
import express, { type Request, Response, NextFunction, type RequestHandler } from "express";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startSyncService } from "./sync-service";
import authRouter from './auth';

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Session store and middleware (must be before auth guard)
const PgSession = connectPgSimple(session as any);

// allow opting into trust-proxy via env (when deployed behind a proxy/loadbalancer)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const cookieSecure = process.env.COOKIE_SECURE === 'true';
const cookieSameSite = process.env.COOKIE_SAMESITE || (cookieSecure ? 'none' : 'lax');

const sessionMiddleware = (session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true, // refresh expiration on each response
  cookie: {
    secure: cookieSecure,
    httpOnly: true,
    sameSite: cookieSameSite as any,
    maxAge: Number(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 1 day
  }
}) as unknown) as RequestHandler;

app.use(sessionMiddleware);

// mount auth routes
app.use('/auth', authRouter);

// Global auth guard: allow /auth, static files, and health endpoints; otherwise require session
app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path || '';
  // allow authentication routes and assets
  if (path.startsWith('/auth') || path.startsWith('/_') || path.startsWith('/public') || path.startsWith('/static') || path === '/favicon.ico') {
    return next();
  }

  // allow health check
  if (path === '/health' || path === '/ping') return next();

  // if user has session, allow
  if ((req as any).session && (req as any).session.user) return next();

  // if API request, return 401; otherwise redirect to login
  if (path.startsWith('/api')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // browser routes -> redirect to login
  return res.redirect('/auth/login');
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  // on Windows reusePort is not supported and causes ENOTSUP; only set it on supported platforms
  const listenOptions: any = {
    port,
    host: "0.0.0.0",
  };

  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
    
    // Start the background sync service
    startSyncService();
  });
})();
