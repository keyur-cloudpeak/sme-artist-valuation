// Snowflake connection helper — replaces Streamlit's `st.connection("snowflake")`.
//
// Auth: set SNOWFLAKE_PASSWORD for password auth, OR SNOWFLAKE_PRIVATE_KEY (+ optional
// SNOWFLAKE_PRIVATE_KEY_PASSPHRASE) for key-pair auth. Fill in real values in `.env.local`.
//
// Performance: a module-level singleton connection is reused across requests within the
// same Node.js process so the expensive OCSP certificate check (which caused 30-60 s
// cold-start latency) only happens once per server lifetime. The connection is tested
// before reuse and recreated transparently if it has gone stale.
//
// For Vercel / true serverless deployments the singleton will still open once per
// function instance, which is the best possible behaviour on that platform.

import snowflake from "snowflake-sdk";

export type SnowflakeRow = Record<string, any>;

// ─── OCSP tuning ────────────────────────────────────────────────────────────
// In development you can set SNOWFLAKE_OCSP_FAIL_OPEN=false to disable OCSP
// entirely and cut cold-start time by ~60 s.  Never disable in production.
if (process.env.NODE_ENV !== "production") {
  // snowflake-sdk respects the SNOWFLAKE_OCSP_FAIL_OPEN env var; we also
  // surface it via the SDK's global setting where the API allows it.
  snowflake.configure({ ocspFailOpen: true } as any);
}

// ─── Connection options ──────────────────────────────────────────────────────
function buildConnectionOptions(): snowflake.ConnectionOptions {
  const account = process.env.SNOWFLAKE_ACCOUNT || "";
  const username =
    process.env.SNOWFLAKE_USERNAME || process.env.SNOWFLAKE_USER || "";
  const role = process.env.SNOWFLAKE_ROLE || "ACCOUNTADMIN";
  const warehouse = process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH";

  const base: snowflake.ConnectionOptions = {
    account,
    username,
    role,
    warehouse,
  };

  if (process.env.SNOWFLAKE_PRIVATE_KEY) {
    return {
      ...base,
      authenticator: "SNOWFLAKE_JWT",
      privateKey: process.env.SNOWFLAKE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      privateKeyPass:
        process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE || undefined,
    };
  }

  return {
    ...base,
    password: process.env.SNOWFLAKE_PASSWORD || "",
  };
}

// ─── Singleton connection ────────────────────────────────────────────────────
// Module-level state survives across requests in a long-lived Node process.
// In serverless (new process per invocation) it just opens once per instance.
let _singleton: snowflake.Connection | null = null;
let _connecting: Promise<snowflake.Connection> | null = null;

function rawConnect(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection(buildConnectionOptions());
    connection.connect((err, conn) => {
      if (err) reject(err);
      else resolve(conn);
    });
  });
}

/** Ping with a lightweight query to verify the connection is alive. */
function ping(conn: snowflake.Connection): Promise<boolean> {
  return new Promise((resolve) => {
    conn.execute({
      sqlText: "SELECT 1",
      complete: (err) => resolve(!err),
    });
  });
}

/**
 * Return the cached singleton connection, (re)connecting if needed.
 * Concurrent callers during the initial connect share a single Promise
 * so only ONE OCSP handshake is ever in-flight at a time.
 */
async function getConnection(): Promise<snowflake.Connection> {
  // Happy path: singleton exists and is healthy
  if (_singleton) {
    if (await ping(_singleton)) return _singleton;
    // Connection went stale — drop it and reconnect below
    _singleton = null;
  }

  // If a connect is already in flight, wait for it (avoids duplicate OCSP)
  if (_connecting) return _connecting;

  _connecting = rawConnect().then((conn) => {
    _singleton = conn;
    _connecting = null;
    return conn;
  }).catch((err) => {
    _connecting = null;
    throw err;
  });

  return _connecting;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute a single SQL statement with optional bind params (positional, like
 * Snowpark's `params=[...]` / `:1`, `:2`, ... placeholders) and return rows as
 * plain objects (uppercase column names, matching Snowflake's default behavior).
 */
export async function execute<T extends SnowflakeRow = SnowflakeRow>(
  sqlText: string,
  binds: any[] = []
): Promise<T[]> {
  const connection = await getConnection();
  return new Promise<T[]>((resolve, reject) => {
    connection.execute({
      sqlText,
      binds: binds.length ? binds : undefined,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      },
    });
  });
}

/** Run several statements against the shared singleton connection. */
export async function withConnection<T>(
  fn: (run: (sqlText: string, binds?: any[]) => Promise<SnowflakeRow[]>) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  const run = (sqlText: string, binds: any[] = []) =>
    new Promise<SnowflakeRow[]>((resolve, reject) => {
      connection.execute({
        sqlText,
        binds: binds.length ? binds : undefined,
        complete: (err, _stmt, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        },
      });
    });
  return fn(run);
}
