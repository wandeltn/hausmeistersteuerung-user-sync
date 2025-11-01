import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

let pool: any;
let db: any;

// Decide which client to use. Default to node-postgres unless the connection string
// clearly indicates a Neon serverless connection (host includes 'neon' or 'neondatabase' or the string contains 'neon').
let useNeon = false;
try {
  const url = new URL(connectionString);
  const host = url.hostname || '';
  if (/neon|neondatabase/i.test(host) || /neon|neondatabase/i.test(connectionString)) {
    useNeon = true;
  }
} catch (e) {
  // If parsing fails, fall back to inspecting raw string
  if (/neon|neondatabase/i.test(connectionString)) {
    useNeon = true;
  }
}

if (!useNeon) {
  pool = new PgPool({ connectionString });
  // prevent uncaught 'error' events from crashing the process
  try {
    // pool may be an EventEmitter
    (pool as any).on?.('error', (err: any) => {
      console.error('Postgres pool error:', err);
    });
  } catch (e) {
    // ignore
  }
  db = drizzlePg(pool, { schema });
} else {
  // If requested via env, disable TLS verification for Neon websocket (development only).
  // WARNING: this should NEVER be used in production. Use only for local dev with self-signed certs.
  const disableTls = (process.env.DISABLE_TLS_VERIFY === 'true');

  if (disableTls) {
    // wrap ws constructor to inject rejectUnauthorized: false into options and ensure SNI servername
    neonConfig.webSocketConstructor = function (url: string, protocols?: any, options?: any) {
      let servername: string | undefined = undefined;
      try {
        const parsed = new URL(url);
        servername = parsed.hostname;
      } catch (e) {
        // ignore
      }

      const wsOptions = Object.assign({}, options || {}, { rejectUnauthorized: false } as any);
      if (servername) {
        // Do not set servername when it's an IP literal — Node disallows IPs for SNI
        const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(servername);
        const isIpv6 = servername.includes(":");
        if (!isIpv4 && !isIpv6) {
          wsOptions.servername = servername;
        }
      }
      return new ws(url, protocols as any, wsOptions);
    } as any;
  } else {
    neonConfig.webSocketConstructor = ws;
  }

  pool = new NeonPool({ connectionString });
  // neon pool may emit errors too
  try {
    (pool as any).on?.('error', (err: any) => {
      console.error('Neon pool error:', err);
    });
  } catch (e) {
    // ignore
  }
  db = drizzleNeon({ client: pool, schema });
}

export { pool, db };
