// Session progress management — port of session_manager.py

import { DB, MIN_STEP, MAX_STEP, EMAIL_REGEX } from "./config";
import { withConnection, SnowflakeRow } from "./snowflake";

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function clampStep(step: number): number {
  return Math.max(MIN_STEP, Math.min(MAX_STEP, step));
}

const esc = (v: string) => v.replace(/'/g, "''");

export async function ensureSessionTables(run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>) {
  try {
    await run(`CREATE TABLE IF NOT EXISTS ${DB}.SESSION_PROGRESS (
        SESSION_ID VARCHAR DEFAULT UUID_STRING(),
        USER_EMAIL VARCHAR NOT NULL,
        STATUS VARCHAR DEFAULT 'IN_PROGRESS',
        CURRENT_STEP NUMBER DEFAULT 1,
        STEP_DATA VARIANT DEFAULT PARSE_JSON('{}'),
        CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )`);
    await run(`CREATE TABLE IF NOT EXISTS ${DB}.USER_PROGRESS (
        USER_EMAIL VARCHAR(320) NOT NULL PRIMARY KEY,
        CURRENT_STEP NUMBER DEFAULT 1,
        VISITED_STEPS VARCHAR(200) DEFAULT '[]',
        LAST_UPDATED TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )`);
  } catch {
    // ignore, mirrors Python's best-effort table creation
  }
}

export interface OpenSession {
  session_id: string;
  current_step: number;
  step_data: Record<string, any>;
  updated_at: string;
}

export async function getOpenSessions(
  run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>,
  email: string
): Promise<OpenSession[]> {
  try {
    const safeEmail = esc(email);
    const rows = await run(`SELECT SESSION_ID, CURRENT_STEP,
               TO_VARCHAR(STEP_DATA) AS STEP_DATA_STR, UPDATED_AT
        FROM ${DB}.SESSION_PROGRESS
        WHERE USER_EMAIL = '${safeEmail}' AND STATUS = 'IN_PROGRESS'
        ORDER BY UPDATED_AT DESC
        LIMIT 20`);
      return rows.map((row) => {
      let stepData: Record<string, any> = {};
      const raw = row["STEP_DATA_STR"];
      if (raw) {
        try {
          const parsed = JSON.parse(String(raw));
          stepData = typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
          stepData = {};
        }
      }
      return {
        session_id: String(row["SESSION_ID"]),
        current_step: clampStep(Number(row["CURRENT_STEP"])),
        step_data: stepData,
        updated_at: String(row["UPDATED_AT"]),
      };
    });
  } catch {
    // ignore, mirrors Python's best-effort lookup
  }
  return [];
}

export async function getOpenSession(
  run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>,
  email: string
): Promise<OpenSession | null> {
  const sessions = await getOpenSessions(run, email);
  return sessions[0] || null;
}

export interface NewSession {
  session_id: string;
  current_step: number;
  step_data: Record<string, any>;
}

export async function createNewSession(
  run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>,
  email: string
): Promise<NewSession> {
  try {
    const safeEmail = esc(email);
    await run(`INSERT INTO ${DB}.SESSION_PROGRESS (USER_EMAIL, STATUS, CURRENT_STEP, STEP_DATA)
        SELECT '${safeEmail}', 'IN_PROGRESS', ${MIN_STEP}, PARSE_JSON('{}')`);
    const result = await run(`SELECT SESSION_ID, CURRENT_STEP
        FROM ${DB}.SESSION_PROGRESS
        WHERE USER_EMAIL = '${safeEmail}' AND STATUS = 'IN_PROGRESS'
        ORDER BY CREATED_AT DESC LIMIT 1`);
    if (result.length) {
      return {
        session_id: String(result[0]["SESSION_ID"]),
        current_step: MIN_STEP,
        step_data: {},
      };
    }
  } catch {
    // fall through to local fallback below
  }
  return { session_id: "local", current_step: MIN_STEP, step_data: {} };
}

export async function saveCheckpoint(
  run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>,
  sessionId: string,
  newStep: number,
  stepData: Record<string, any>,
  userEmail?: string
): Promise<boolean> {
  if (!sessionId || sessionId === "local") return false;
  const step = clampStep(newStep);
  const stepDataJson = JSON.stringify(stepData);
  const safeSid = esc(sessionId);
  try {
    await run(`UPDATE ${DB}.SESSION_PROGRESS
        SET CURRENT_STEP = ${step},
            STEP_DATA = PARSE_JSON($$${stepDataJson}$$),
            UPDATED_AT = CURRENT_TIMESTAMP()
        WHERE SESSION_ID = '${safeSid}' AND STATUS = 'IN_PROGRESS'`);
    if (userEmail) {
      const safeEmail = esc(userEmail);
      const visitedJson = JSON.stringify(Array.from({ length: step }, (_, i) => i + 1));
      await run(`MERGE INTO ${DB}.USER_PROGRESS t
          USING (SELECT '${safeEmail}' AS USER_EMAIL) s ON t.USER_EMAIL = s.USER_EMAIL
          WHEN MATCHED THEN UPDATE SET
              CURRENT_STEP = ${step},
              VISITED_STEPS = $$${visitedJson}$$,
              LAST_UPDATED = CURRENT_TIMESTAMP()
          WHEN NOT MATCHED THEN INSERT (USER_EMAIL, CURRENT_STEP, VISITED_STEPS)
              VALUES ('${safeEmail}', ${step}, $$${visitedJson}$$)`);
    }
    return true;
  } catch {
    return false;
  }
}

export async function completeSession(
  run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>,
  sessionId: string
): Promise<boolean> {
  try {
    const safeSid = esc(sessionId);
    await run(`UPDATE ${DB}.SESSION_PROGRESS
        SET STATUS = 'COMPLETED', UPDATED_AT = CURRENT_TIMESTAMP()
        WHERE SESSION_ID = '${safeSid}'`);
    return true;
  } catch {
    return false;
  }
}

export async function abandonOpenSessions(
  run: (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>,
  email: string
): Promise<void> {
  try {
    const safeEmail = esc(email);
    await run(`UPDATE ${DB}.SESSION_PROGRESS
        SET STATUS = 'COMPLETED', UPDATED_AT = CURRENT_TIMESTAMP()
        WHERE USER_EMAIL = '${safeEmail}' AND STATUS = 'IN_PROGRESS'`);
  } catch {
    // ignore
  }
}

export { withConnection };
