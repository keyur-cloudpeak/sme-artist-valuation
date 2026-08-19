// Catalog table builder — port of catalog_builder.py
// Naming convention: STEP{N}_{searchterm}_{username}_{sessionid}

import { DB, LUMINATE_DATABASE, LUMINATE_SCHEMA, LUMINATE_MODELS_DATABASE, LUMINATE_MODELS_SCHEMA } from "./config";
import { SnowflakeRow } from "./snowflake";

type Run = (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>;

function sanitizeIdentifier(name: string): string {
  let sanitized = name.trim().replace(/[^A-Za-z0-9_]/g, "_");
  sanitized = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return sanitized ? sanitized.slice(0, 60) : "UNKNOWN";
}

function makeTableName(step: number, userEmail: string, entityName: string, sessionId = ""): string {
  const userPart = sanitizeIdentifier(userEmail.includes("@") ? userEmail.split("@")[0] : userEmail);
  const entityPart = sanitizeIdentifier(entityName);
  if (sessionId) {
    const sidPart = sanitizeIdentifier(sessionId.replace(/-/g, ""));
    return `STEP${step}_${entityPart}_${userPart}_${sidPart}`;
  }
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  return `STEP${step}_${entityPart}_${userPart}_${ts}`;
}

export interface Step1Result {
  status: "success" | "error";
  table_name: string;
  row_count?: number;
  error?: string;
}

export async function createStep1SelectionTable(
  run: Run,
  entityName: string,
  userEmail: string,
  selectedEntities: string[],
  searchMode = "Artist",
  sessionId = ""
): Promise<Step1Result> {
  const tableName = makeTableName(1, userEmail, entityName, sessionId);
  const fqn = `${DB}.${tableName}`;
  const luminateView = `${LUMINATE_DATABASE}.${LUMINATE_SCHEMA}.VW_MUSICAL_RELEASE_GROUP_DS`;

  try {
    await run(`DROP TABLE IF EXISTS ${fqn}`);
    await run(`CREATE TABLE ${fqn} (
            MRELG_ID VARCHAR,
            ENTITY_NAME VARCHAR,
            SEARCH_TERM VARCHAR,
            SEARCH_MODE VARCHAR,
            SELECTED_BY VARCHAR,
            SESSION_ID VARCHAR,
            CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )`);

    for (const entity of selectedEntities) {
      if (searchMode === "Artist") {
        await run(
          `INSERT INTO ${fqn} (MRELG_ID, ENTITY_NAME, SEARCH_TERM, SEARCH_MODE, SELECTED_BY, SESSION_ID)
                    SELECT DISTINCT MRELG_ID, :1, :2, :3, :4, :5
                    FROM ${luminateView}
                    WHERE DISPLAY_ARTIST = :1`,
          [entity, entityName, searchMode, userEmail, sessionId]
        );
      } else if (searchMode === "Label") {
        await run(
          `INSERT INTO ${fqn} (MRELG_ID, ENTITY_NAME, SEARCH_TERM, SEARCH_MODE, SELECTED_BY, SESSION_ID)
                    SELECT DISTINCT MRELG_ID, :1, :2, :3, :4, :5
                    FROM ${luminateView}
                    WHERE IMPRINT = :1`,
          [entity, entityName, searchMode, userEmail, sessionId]
        );
      } else {
        await run(
          `INSERT INTO ${fqn} (MRELG_ID, ENTITY_NAME, SEARCH_TERM, SEARCH_MODE, SELECTED_BY, SESSION_ID)
                    VALUES (NULL, :1, :2, :3, :4, :5)`,
          [entity, entityName, searchMode, userEmail, sessionId]
        );
      }
    }

    const countRows = await run(`SELECT COUNT(*) AS CNT FROM ${fqn}`);
    const rowCount = Number(countRows[0]?.["CNT"] ?? 0);
    return { status: "success", table_name: fqn, row_count: rowCount };
  } catch (e: any) {
    return { status: "error", table_name: fqn, error: String(e?.message || e) };
  }
}

export interface CatalogResult {
  status: "success" | "error";
  table_name: string;
  track_count?: number;
  album_count?: number;
  total_streams?: number;
  total_revenue?: number;
  error?: string;
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  "Artist/Band": "ARTIST",
  Artist: "ARTIST",
  Label: "LABEL",
  "ISRC List": "ISRC",
};

export async function createCatalogTable(
  run: Run,
  entityName: string,
  userEmail: string,
  searchMode = "Artist/Band",
  sessionId = ""
): Promise<CatalogResult> {
  const tableName = makeTableName(2, userEmail, entityName, sessionId);
  const fqn = `${DB}.${tableName}`;
  const entityType = ENTITY_TYPE_MAP[searchMode] || "ARTIST";

  try {
    await run(`DROP TABLE IF EXISTS ${fqn}`);
    await run(`CREATE TABLE ${fqn} (
            MRELG_ID VARCHAR,
            TRACK_ID VARCHAR,
            TRACK_NAME VARCHAR,
            ISRC VARCHAR,
            RELEASE_YEAR NUMBER,
            FIRST_STREAM_DATE DATE,
            CONTENT_TYPE VARCHAR,
            PRIMARY_ALBUM_ID VARCHAR,
            ALBUM_ID VARCHAR,
            ALBUM_NAME VARCHAR,
            RELEASE_TYPE VARCHAR,
            IS_COMPILATION BOOLEAN,
            ALBUM_RELEASE_YEAR NUMBER,
            TRACK_COUNT NUMBER,
            CURRENT_REVENUE_USD FLOAT,
            TOTAL_CONSUMPTION_STREAMS NUMBER,
            IS_PRIMARY_ALBUM BOOLEAN,
            ENTITY_NAME VARCHAR,
            ENTITY_TYPE VARCHAR,
            SEARCH_MODE VARCHAR,
            CREATED_BY VARCHAR,
            CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )`);

    await run(
      `INSERT INTO ${fqn}
            (MRELG_ID, TRACK_ID, TRACK_NAME, ISRC, RELEASE_YEAR, FIRST_STREAM_DATE,
             CONTENT_TYPE, PRIMARY_ALBUM_ID, ALBUM_ID, ALBUM_NAME, RELEASE_TYPE,
             IS_COMPILATION, ALBUM_RELEASE_YEAR, TRACK_COUNT, CURRENT_REVENUE_USD,
             TOTAL_CONSUMPTION_STREAMS, IS_PRIMARY_ALBUM, ENTITY_NAME, ENTITY_TYPE,
             SEARCH_MODE, CREATED_BY)
            SELECT
                a.ALBUM_ID AS MRELG_ID,
                t.TRACK_ID, t.TRACK_NAME, t.ISRC, t.RELEASE_YEAR, t.FIRST_STREAM_DATE,
                t.CONTENT_TYPE, t.PRIMARY_ALBUM_ID,
                a.ALBUM_ID, a.ALBUM_NAME, a.RELEASE_TYPE,
                a.IS_COMPILATION, a.RELEASE_YEAR AS ALBUM_RELEASE_YEAR,
                a.TRACK_COUNT, a.CURRENT_REVENUE_USD, a.TOTAL_CONSUMPTION_STREAMS,
                b.IS_PRIMARY,
                :1,
                :2,
                :3,
                :4
            FROM ${DB}.TRACKS t
            JOIN ${DB}.TRACK_ALBUM_BRIDGE b ON t.TRACK_ID = b.TRACK_ID
            JOIN ${DB}.ALBUMS a ON b.ALBUM_ID = a.ALBUM_ID
            WHERE EXISTS (
                SELECT 1 FROM ${DB}.AMBIGUITY_MATCHES am
                WHERE am.MATCH_NAME = :5
                AND am.TRACK_COUNT > 0
            )`,
      [entityName, entityType, searchMode, userEmail, entityName]
    );

    const stats = await run(`SELECT
                COUNT(DISTINCT TRACK_ID) AS TRACK_COUNT,
                COUNT(DISTINCT ALBUM_ID) AS ALBUM_COUNT,
                COALESCE(SUM(TOTAL_CONSUMPTION_STREAMS), 0) AS TOTAL_STREAMS,
                COALESCE(SUM(CURRENT_REVENUE_USD), 0) AS TOTAL_REVENUE
            FROM ${fqn}
            WHERE IS_PRIMARY_ALBUM = TRUE`);

    const trackCount = Number(stats[0]?.["TRACK_COUNT"] ?? 0);
    const albumCount = Number(stats[0]?.["ALBUM_COUNT"] ?? 0);
    const totalStreams = Number(stats[0]?.["TOTAL_STREAMS"] ?? 0);
    const totalRevenue = Number(stats[0]?.["TOTAL_REVENUE"] ?? 0);

    await run(
      `INSERT INTO ${DB}.CATALOG_ACTIVITY_LOG
                (USER_EMAIL, ACTIVITY_TYPE, ENTITY_NAME, ENTITY_TYPE, SEARCH_MODE,
                 CATALOG_TABLE_NAME, TRACK_COUNT, ALBUM_COUNT, TOTAL_STREAMS,
                 TOTAL_REVENUE_USD, STATUS)
                VALUES (:1, 'TABLE_CREATED', :2, :3, :4, :5, :6, :7, :8, :9, 'SUCCESS')`,
      [userEmail, entityName, entityType, searchMode, fqn, trackCount, albumCount, totalStreams, totalRevenue]
    );

    return {
      status: "success",
      table_name: fqn,
      track_count: trackCount,
      album_count: albumCount,
      total_streams: totalStreams,
      total_revenue: totalRevenue,
    };
  } catch (e: any) {
    try {
      await run(
        `INSERT INTO ${DB}.CATALOG_ACTIVITY_LOG
                    (USER_EMAIL, ACTIVITY_TYPE, ENTITY_NAME, ENTITY_TYPE, SEARCH_MODE,
                     CATALOG_TABLE_NAME, STATUS, ERROR_MESSAGE)
                    VALUES (:1, 'TABLE_CREATED', :2, :3, :4, :5, 'FAILED', :6)`,
        [userEmail, entityName, entityType, searchMode, fqn, String(e?.message || e).slice(0, 2000)]
      );
    } catch {
      // ignore
    }
    return { status: "error", table_name: fqn, error: String(e?.message || e) };
  }
}

export async function createStep2Table(
  run: Run,
  step1Table: string,
  _confirmedMrelgIds: string[],
  userEmail: string,
  entityName: string,
  sessionId = ""
): Promise<string> {
  const tableName = makeTableName(2, userEmail, entityName, sessionId);
  const fqn = `${DB}.${tableName}`;
  const luminateView = `${LUMINATE_DATABASE}.${LUMINATE_SCHEMA}.VW_MUSICAL_RELEASE_GROUP_DS`;

  await run(`DROP TABLE IF EXISTS ${fqn}`);
  await run(`CREATE TABLE ${fqn} AS
        SELECT
            v.MRELG_ID,
            v.TITLE,
            v.DISPLAY_ARTIST,
            v.IMPRINT,
            v.RELEASE_DATE,
            v.RELEASE_YEAR,
            v.PRODUCT_FORMAT,
            v.RELEASE_TYPE,
            v.GENRES,
            v.COMPILATION_TYPE,
            v.DURATION,
            s1.ENTITY_NAME,
            s1.SEARCH_TERM,
            s1.SEARCH_MODE,
            s1.SELECTED_BY,
            s1.SESSION_ID
        FROM ${luminateView} v
        JOIN ${step1Table} s1 ON v.MRELG_ID = s1.MRELG_ID`);

  return fqn;
}

/** Returns the raw monthly detail rows (mirrors Python's Snowpark DataFrame — here just an array of rows). */
export async function pullMonthlyDetail(run: Run, step2Table: string): Promise<SnowflakeRow[]> {
  const luminateFqn = `${LUMINATE_DATABASE}.${LUMINATE_SCHEMA}`;
  const modelsFqn = `${LUMINATE_MODELS_DATABASE}.${LUMINATE_MODELS_SCHEMA}`;

  return run(`WITH matched_recordings AS (
                SELECT rec.MR_ID, rec.DISPLAY_ARTIST, rec.TITLE, rec.RELEASE_DATE
                FROM ${luminateFqn}.VW_MUSICAL_RECORDING_DS rec
                JOIN (
                    SELECT DISTINCT LOWER(DISPLAY_ARTIST) AS ARTIST_KEY
                    FROM ${step2Table}
                ) artists
                    ON LOWER(rec.DISPLAY_ARTIST) = artists.ARTIST_KEY
            )
            SELECT
                mr.MONTH_START_DATE,
                mr.COUNTRY_CODE,
                mr.COMMERCIAL_MODEL,
                m.DISPLAY_ARTIST AS RELEASE_GROUP_DISPLAY_ARTIST,
                COALESCE(pc.RELEASE_GROUP_ID, s2.MRELG_ID) AS RELEASE_GROUP_ID,
                COALESCE(pc.RELEASE_GROUP_TITLE, m.TITLE) AS RELEASE_GROUP_TITLE,
                m.RELEASE_DATE AS FIRST_STREAM_DATE,
                mr.MR_ID AS RECORDING_ID,
                m.TITLE AS RECORDING_TITLE,
                mr.CONTENT_TYPE,
                SUM(mr.QUANTITY) AS QUANTITY
            FROM ${modelsFqn}.MONTHLY_MR_SUMMARY mr
            JOIN matched_recordings m
                ON m.MR_ID = mr.MR_ID
            LEFT JOIN ${modelsFqn}.PRODUCT_CATALOG pc
                ON pc.RECORDING_ID = mr.MR_ID
            CROSS JOIN (
                SELECT DISTINCT DISPLAY_ARTIST, MRELG_ID
                FROM ${step2Table}
                LIMIT 1
            ) s2
            WHERE mr.MONTH_START_DATE >= '2020-01-01'
            GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`);
}
