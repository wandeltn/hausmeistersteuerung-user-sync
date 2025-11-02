import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Lazy-import Vite and the Vite config to avoid referencing dev-only
  // dependencies in the production bundle. Bundlers that see a top-level
  // `import "vite"` will leave it as an external import which then
  // requires `vite` at runtime (causing the Docker production image to fail
  // when devDependencies are not installed).
  const { createServer: createViteServer, createLogger } = await import("vite");
  // IMPORTANT: do not import the project's vite.config here. The project's
  // config often references PostCSS / Vite plugins (devDependencies) which
  // may include native binaries (e.g. lightningcss) or other packages not
  // present in a production runtime. We pass a minimal inline config to
  // createViteServer to keep the dev-only setup isolated.

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const clientRoot = path.resolve(import.meta.dirname, '..', 'client');

  // Try to load the React plugin so TSX files are supported in dev middleware.
  let reactPlugin: any = undefined;
  try {
    const mod = await import('@vitejs/plugin-react');
    reactPlugin = mod && (mod.default || mod);
  } catch (e) {
    console.warn('[vite debug] could not import @vitejs/plugin-react, TSX transforms may fail', e);
  }

  const vite = await createViteServer({
    root: clientRoot,
    configFile: false,
    resolve: {
      alias: [
        { find: /^@\//, replacement: path.resolve(clientRoot, 'src') + '/' },
        { find: '@shared', replacement: path.resolve(import.meta.dirname, '..', 'shared') },
      ],
    },
    plugins: reactPlugin ? [reactPlugin()] : [],
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // NOTE: we intentionally avoid calling `ssrLoadModule` here because it
  // will evaluate client-side code (which accesses `document`) and throw
  // during SSR. We only verify file existence above.
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
