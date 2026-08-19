// Data loading from Snowflake — port of data_loader.py (including the pandas-based
// analytics math, reimplemented with plain array helpers since there's no pandas in Node).

import { DB, LUMINATE_DATABASE, LUMINATE_SCHEMA } from "./config";
import { SnowflakeRow } from "./snowflake";
import { pullMonthlyDetail } from "./catalogBuilder";

type Run = (sql: string, binds?: any[]) => Promise<SnowflakeRow[]>;

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  US: "United States", MX: "Mexico", CO: "Colombia", AR: "Argentina",
  BR: "Brazil", ES: "Spain", CL: "Chile", PE: "Peru", GB: "United Kingdom",
  DE: "Germany", FR: "France", IT: "Italy", EC: "Ecuador", VE: "Venezuela",
  DO: "Dominican Republic", GT: "Guatemala", JP: "Japan", CA: "Canada",
  AU: "Australia", PT: "Portugal", KR: "South Korea", NZ: "New Zealand",
  IN: "India", ID: "Indonesia", TH: "Thailand", PH: "Philippines",
  MY: "Malaysia", SG: "Singapore", TW: "Taiwan", HK: "Hong Kong",
  VN: "Vietnam", ZA: "South Africa", NG: "Nigeria", KE: "Kenya",
  EG: "Egypt", AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel",
  TR: "Turkey", NL: "Netherlands", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", BE: "Belgium", AT: "Austria",
  CH: "Switzerland", IE: "Ireland", PL: "Poland", CZ: "Czech Republic",
  RO: "Romania", HU: "Hungary", GR: "Greece", UY: "Uruguay",
  PY: "Paraguay", BO: "Bolivia", CR: "Costa Rica", PA: "Panama",
  HN: "Honduras", SV: "El Salvador", NI: "Nicaragua", CU: "Cuba",
  PR: "Puerto Rico",
};

// ─── Small groupby helpers (stand-ins for pandas) ────────────────────────────

function groupBy<T, K extends string | number>(rows: T[], keyFn: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

function sumBy<T>(rows: T[], valFn: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + (valFn(r) || 0), 0);
}

// ─── Luminate share detection ─────────────────────────────────────────────────

export async function detectLuminateShare(run: Run): Promise<{ available: boolean; database: string | null }> {
  try {
    const result = await run(`SELECT CONFIG_VALUE FROM ${DB}.CONFIG WHERE CONFIG_KEY = 'luminate_share_db'`);
    if (result.length > 0) {
      const raw = result[0]["CONFIG_VALUE"];
      let shareDb: string;
      try {
        shareDb = typeof raw === "string" ? JSON.parse(raw) : String(raw).replace(/^"|"$/g, "");
      } catch {
        shareDb = String(raw).replace(/^"|"$/g, "");
      }
      await run(`SELECT 1 FROM ${shareDb}.METADATA.RECORDINGS LIMIT 1`);
      return { available: true, database: shareDb };
    }
  } catch {
    // ignore
  }
  return { available: false, database: null };
}

// ─── Bootstrap data load ─────────────────────────────────────────────────────

export async function loadDataFromSnowflake(run: Run): Promise<Record<string, any>> {
  const data: Record<string, any> = {};

  const luminateStatus = await detectLuminateShare(run);
  data["_data_source"] = {
    type: luminateStatus.available ? "luminate_share" : "demo",
    database: luminateStatus.database,
  };

  try {
    const rows = await run(`SELECT * FROM ${DB}.TRACKS ORDER BY TRACK_ID`);
    data["tracks"] = rows.map((r) => ({
      track_id: r["TRACK_ID"],
      track_name: r["TRACK_NAME"],
      isrc: r["ISRC"],
      release_year: Number(r["RELEASE_YEAR"]),
      first_stream_date: String(r["FIRST_STREAM_DATE"]),
      content_type: r["CONTENT_TYPE"],
      primary_album_id: r["PRIMARY_ALBUM_ID"],
    }));
  } catch {
    data["tracks"] = [];
  }

  // albums is populated dynamically from step2 table data (not hardcoded)
  data["albums"] = [];

  try {
    const rows = await run(`SELECT * FROM ${DB}.TRACK_ALBUM_BRIDGE ORDER BY TRACK_ID, ALBUM_ID`);
    data["track_album_bridge"] = rows.map((r) => ({
      track_id: r["TRACK_ID"],
      album_id: r["ALBUM_ID"],
      is_primary: Boolean(r["IS_PRIMARY"]),
    }));
  } catch {
    data["track_album_bridge"] = [];
  }

  // These keys are computed dynamically from pullMonthlyDetail in step 3→4+.
  // Provide empty defaults so the app renders before the step2 table is ready.
  data["consumption_matrix"] = [
    { bucket: "2024 H1", audio_premium: 0, audio_ad_supported: 0, video_premium: 0, video_ad_supported: 0 },
  ];
  data["growth_trend"] = [{ year: 2024, yoy_growth_pct: 0 }];
  data["release_year_analysis"] = [{ bucket: "2024", consumption_streams: 0, revenue_usd: 0, yoy_growth_pct: 0 }];
  data["new_release_tracks"] = [];

  // ambiguity_matches is populated dynamically from live search queries only
  data["ambiguity_matches"] = {};

  try {
    const rows = await run(`SELECT CONFIG_KEY, CONFIG_VALUE FROM ${DB}.CONFIG`);
    for (const r of rows) {
      let val = r["CONFIG_VALUE"];
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          // leave as string
        }
      }
      data[String(r["CONFIG_KEY"])] = val;
    }
  } catch {
    // ignore
  }

  try {
    const rows = await run(`SELECT NAME FROM ${DB}.ARTISTS ORDER BY NAME`);
    const artistNames = rows.map((r) => r["NAME"]);
    if (typeof data["catalog_options"] !== "object" || data["catalog_options"] === null) {
      data["catalog_options"] = {};
    }
    data["catalog_options"]["artists"] = artistNames;
  } catch {
    // ignore
  }

  // Ensure required keys have defaults so the JS never crashes
  data["catalog_options"] = data["catalog_options"] ?? { artists: [], labels: [] };
  data["territories"] = data["territories"] ?? {
    countries: ["United States", "Mexico", "Colombia"],
    regions: { "Latin America": ["Mexico", "Colombia"], "North America": ["United States"] },
  };
  data["market_growth"] = data["market_growth"] ?? { artist_growth_pct: 0, market_growth_pct: 7.0 };
  data["catalog_age_split"] = data["catalog_age_split"] ?? { older_than_10y_pct: 0, recent_releases_pct: 0 };
  data["local_row_revenue"] = data["local_row_revenue"] ?? { local_revenue_usd: 0, row_revenue_usd: 0 };
  data["ppd"] = data["ppd"] ?? {
    current_splits: { audio_premium: 0.0038, audio_ad_supported: 0.0015, video_premium: 0.002, video_ad_supported: 0.0007 },
    future_splits: { audio_premium: 0.004, audio_ad_supported: 0.0016, video_premium: 0.0021, video_ad_supported: 0.0007 },
  };

  return data;
}

// ─── Live Luminate catalog search ────────────────────────────────────────────

const LUMINATE_VIEW = `${LUMINATE_DATABASE}.${LUMINATE_SCHEMA}.vw_musical_release_group_ds`;
const LUMINATE_SONG_MAP = `${LUMINATE_DATABASE}.${LUMINATE_SCHEMA}.vw_song_mrelg_map_ds`;
const LUMINATE_SONG = `${LUMINATE_DATABASE}.${LUMINATE_SCHEMA}.vw_song_ds`;

export async function searchArtistsDropdown(run: Run, term: string): Promise<string[]> {
  if (!term || !term.trim()) return [];
  try {
    const likePattern = `%${term.trim()}%`;
    const rows = await run(
      `SELECT DISTINCT DISPLAY_ARTIST
                FROM ${LUMINATE_VIEW}
                WHERE DISPLAY_ARTIST ILIKE :1
                ORDER BY CASE WHEN TRIM(DISPLAY_ARTIST) ILIKE :2 THEN 0 ELSE 1 END,
                         LENGTH(DISPLAY_ARTIST) ASC, DISPLAY_ARTIST DESC
                LIMIT 1`,
      [likePattern, term.trim()]
    );
    return rows.map((r) => r["DISPLAY_ARTIST"]);
  } catch {
    return [];
  }
}

export async function searchLabelsDropdown(run: Run, term: string): Promise<string[]> {
  if (!term || !term.trim()) return [];
  try {
    const likePattern = `%${term.trim()}%`;
    const rows = await run(
      `SELECT DISTINCT IMPRINT
                FROM ${LUMINATE_VIEW}
                WHERE IMPRINT ILIKE :1
                ORDER BY CASE WHEN TRIM(IMPRINT) ILIKE :2 THEN 0 ELSE 1 END,
                         LENGTH(IMPRINT) ASC, IMPRINT ASC
                LIMIT 1`,
      [likePattern, term.trim()]
    );
    return rows.map((r) => r["IMPRINT"]);
  } catch {
    return [];
  }
}

function buildLikePattern(term: string): string {
  return "%" + term.trim().toLowerCase().split(/\s+/).join("%") + "%";
}

interface AmbiguityMatch {
  id: number;
  name: string;
  confidence: "High" | "Medium" | "Low";
  track_count: number;
  recommended: boolean;
}

function rankResults(records: SnowflakeRow[]): AmbiguityMatch[] {
  if (!records.length) return [];
  const maxCount = Number(records[0]["ALBUM_COUNT"]);
  return records.map((r, i) => {
    const count = Number(r["ALBUM_COUNT"]);
    let confidence: "High" | "Medium" | "Low";
    if (i === 0) confidence = "High";
    else if (count >= maxCount * 0.5) confidence = "Medium";
    else confidence = "Low";
    return {
      id: i + 1,
      name: String(r["NAME"]),
      confidence,
      track_count: count,
      recommended: i === 0,
    };
  });
}

/**
 * Run a live Luminate query based on search mode and return ambiguity-style matches.
 * `isrcTable` should be the fully-qualified ISRC temp table created via createIsrcTempTable,
 * required when searchMode === "ISRC List".
 */
export async function searchCatalog(
  run: Run,
  searchMode: string,
  searchTerm: string,
  isrcTable?: string
): Promise<AmbiguityMatch[]> {
  if (!searchTerm || !searchTerm.trim()) return [];
  const likePattern = buildLikePattern(searchTerm);

  try {
    let rows: SnowflakeRow[];
    if (searchMode === "Artist") {
      rows = await run(
        `SELECT DISTINCT DISPLAY_ARTIST AS NAME,
                       COUNT(DISTINCT mrelg_id) AS ALBUM_COUNT
                FROM ${LUMINATE_VIEW}
                WHERE LOWER(DISPLAY_ARTIST) LIKE :1
                GROUP BY DISPLAY_ARTIST
                ORDER BY ALBUM_COUNT DESC
                LIMIT 20`,
        [likePattern]
      );
    } else if (searchMode === "Label") {
      rows = await run(
        `SELECT DISTINCT IMPRINT AS NAME,
                       COUNT(DISTINCT mrelg_id) AS ALBUM_COUNT
                FROM ${LUMINATE_VIEW}
                WHERE LOWER(IMPRINT) LIKE :1
                GROUP BY IMPRINT
                ORDER BY ALBUM_COUNT DESC
                LIMIT 20`,
        [likePattern]
      );
    } else if (searchMode === "ISRC List") {
      if (!isrcTable) return [];
      rows = await run(
        `SELECT DISTINCT TITLE || ' — ' || DISPLAY_ARTIST AS NAME,
                       COUNT(DISTINCT v.mrelg_id) AS ALBUM_COUNT
                FROM ${LUMINATE_VIEW} v
                WHERE v.mrelg_id IN (
                    SELECT relg.mrelg_id
                    FROM ${LUMINATE_SONG_MAP} relg
                    JOIN ${LUMINATE_SONG} sng
                        ON relg.song_id = sng.song_id
                    WHERE sng.isrc IN (SELECT isrc FROM ${isrcTable})
                )
                GROUP BY TITLE, DISPLAY_ARTIST
                ORDER BY ALBUM_COUNT DESC
                LIMIT 20`
      );
    } else {
      return [];
    }

    if (!rows.length) return [];
    return rankResults(rows);
  } catch {
    return [];
  }
}

// ─── Analytics computation from monthly streaming detail (steps 4-8) ─────────

export async function computeAnalyticsFromMonthlyDetail(
  run: Run,
  step2Table: string,
  albums: any[]
): Promise<Record<string, any>> {
  const currentYear = new Date().getFullYear();
  let df: SnowflakeRow[] = [];
  let hasStreamingData = false;

  try {
    df = await pullMonthlyDetail(run, step2Table);
    if (df && df.length > 100) hasStreamingData = true;
  } catch {
    // ignore
  }

  if (hasStreamingData) {
    return computeFromStreamingData(df, albums, currentYear);
  }
  return computeFromAlbumMetadata(albums, currentYear);
}

export function computeFromAlbumMetadata(albums: any[], currentYear: number): Record<string, any> {
  const result: Record<string, any> = {};
  const numAlbums = albums.length;
  if (numAlbums === 0) return {};

  // --- Territories ---
  const topCountryCodes = [
    "US", "MX", "CO", "AR", "BR", "ES", "CL", "PE", "GB", "DE",
    "FR", "IT", "EC", "VE", "DO", "GT", "JP", "CA", "AU", "PT",
  ];
  const topCountries = topCountryCodes.map((c) => COUNTRY_CODE_TO_NAME[c] || c);
  const regionCodeMap: Record<string, string[]> = {
    "Latin America": ["MX", "CO", "AR", "BR", "CL", "PE", "EC", "VE", "DO", "GT"],
    "North America": ["US", "CA"],
    Europe: ["ES", "GB", "DE", "FR", "IT", "PT"],
    "Asia Pacific": ["JP", "AU"],
  };
  const regionMap: Record<string, string[]> = {};
  for (const [region, codes] of Object.entries(regionCodeMap)) {
    regionMap[region] = codes.map((c) => COUNTRY_CODE_TO_NAME[c] || c);
  }
  result["territories"] = { countries: topCountries, regions: regionMap };

  // --- Derive base metrics from album metadata ---
  const albumYears = albums.map((a) => a.release_year || 0).filter((y: number) => y > 0);
  const minYear = albumYears.length ? Math.min(...albumYears) : currentYear - 5;

  const baseStreamsPerAlbum = 15_000_000; // 15M avg streams per album for established artist
  const totalCatalogStreams = numAlbums * baseStreamsPerAlbum;

  // --- Consumption Matrix (half-year buckets) ---
  const startYear = Math.max(minYear, currentYear - 4);
  const buckets: string[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    for (const h of ["H1", "H2"]) {
      if (y === currentYear && h === "H2") continue;
      buckets.push(`${y} ${h}`);
    }
  }
  const matrixRows = buckets.map((bucket, i) => {
    const growthFactor = 1.0 + i * 0.08; // 8% growth per half-year
    const base = (totalCatalogStreams / buckets.length) * growthFactor;
    return {
      bucket,
      audio_premium: Math.trunc(base * 0.55),
      audio_ad_supported: Math.trunc(base * 0.25),
      video_premium: Math.trunc(base * 0.12),
      video_ad_supported: Math.trunc(base * 0.08),
    };
  });
  result["consumption_matrix"] = matrixRows;

  // --- Growth Trend ---
  const growthTrend: { year: number; yoy_growth_pct: number }[] = [];
  for (let y = Math.max(minYear, currentYear - 6); y <= currentYear; y++) {
    const age = currentYear - y;
    const yoy = round1(12.0 - age * 1.5 + Math.sin(y) * 3);
    growthTrend.push({ year: y, yoy_growth_pct: yoy });
  }
  result["growth_trend"] = growthTrend;

  // --- Market Growth ---
  const artistGrowth = growthTrend.length ? growthTrend[growthTrend.length - 1].yoy_growth_pct : 8.0;
  result["market_growth"] = { artist_growth_pct: artistGrowth, market_growth_pct: 7.0 };

  // --- Catalog Age Split ---
  if (albumYears.length) {
    const olderCount = albumYears.filter((y: number) => currentYear - y > 10).length;
    const recentCount = albumYears.filter((y: number) => currentYear - y <= 3).length;
    const totalCount = albumYears.length;
    result["catalog_age_split"] = {
      older_than_10y_pct: Math.round((olderCount / totalCount) * 100),
      recent_releases_pct: Math.round((recentCount / totalCount) * 100),
    };
  } else {
    result["catalog_age_split"] = { older_than_10y_pct: 50, recent_releases_pct: 20 };
  }

  // --- Release Year Analysis ---
  const yearAlbumCount = new Map<number, number>();
  for (const a of albums) {
    const ry = a.release_year || 0;
    if (ry > 0) yearAlbumCount.set(ry, (yearAlbumCount.get(ry) || 0) + 1);
  }
  const sortedYears = Array.from(yearAlbumCount.keys()).sort((a, b) => a - b);
  const ryAnalysis: any[] = [];
  let prevStreams: number | null = null;
  for (const year of sortedYears) {
    const count = yearAlbumCount.get(year)!;
    const age = currentYear - year;
    const decay = Math.max(0.3, 1.0 - age * 0.05);
    const streams = Math.trunc(count * baseStreamsPerAlbum * decay);
    const rev = round2(streams * 0.003);
    const yoy = prevStreams && prevStreams > 0 ? round1(((streams - prevStreams) / prevStreams) * 100) : 0;
    ryAnalysis.push({ bucket: String(year), consumption_streams: streams, revenue_usd: rev, yoy_growth_pct: yoy });
    prevStreams = streams;
  }
  result["release_year_analysis"] = ryAnalysis;

  // --- Local/ROW Revenue ---
  const totalRevenue = totalCatalogStreams * 0.003;
  const localPct = 0.35;
  result["local_row_revenue"] = {
    local_revenue_usd: round2(totalRevenue * localPct),
    row_revenue_usd: round2(totalRevenue * (1 - localPct)),
  };

  // --- PPD ---
  result["ppd"] = {
    current_splits: { audio_premium: 0.0038, audio_ad_supported: 0.0015, video_premium: 0.002, video_ad_supported: 0.0007 },
    future_splits: { audio_premium: 0.004, audio_ad_supported: 0.0016, video_premium: 0.0021, video_ad_supported: 0.0007 },
  };

  // --- Enrich albums ---
  const enrichedAlbums = albums.map((a, i) => {
    const ry = a.release_year || 0;
    const age = ry > 0 ? Math.max(1, currentYear - ry) : 5;
    const decay = Math.max(0.3, 1.0 - age * 0.05);
    const streams = Math.trunc(baseStreamsPerAlbum * decay * (1 + Math.sin(i) * 0.3));
    const trackCount = Math.max(1, Math.trunc(8 + Math.sin(i * 2.1) * 5));
    return {
      ...a,
      total_consumption_streams: streams,
      current_revenue_usd: round2(streams * 0.003),
      track_count: a.track_count && a.track_count !== 0 ? a.track_count : trackCount,
    };
  });
  result["albums"] = enrichedAlbums;

  // --- New Release Tracks ---
  const recentAlbums = albums.filter((a) => (a.release_year || 0) >= currentYear - 3);
  const newReleaseTracks = recentAlbums.slice(0, 20).map((a, i) => {
    const streamsM = round2(2.0 + Math.sin(i * 1.7) * 1.5 + i * 0.3);
    let flag = "Normal";
    if (streamsM > 5) flag = "Outlier";
    else if (i > 15) flag = "Incomplete Data";
    return {
      track_id: `TR_${String(i).padStart(4, "0")}`,
      track_name: a.album_name || `Track ${i + 1}`,
      release_year: a.release_year || currentYear,
      first_12m_streams_millions: Math.max(0.5, streamsM),
      months_of_data: Math.min(12, 12 - (i % 6)),
      flag,
    };
  });
  result["new_release_tracks"] = newReleaseTracks;

  return result;
}

export function computeFromStreamingData(df: SnowflakeRow[], albums: any[], currentYear: number): Record<string, any> {
  const result: Record<string, any> = {};

  const norm = (r: SnowflakeRow) => ({
    MONTH_START_DATE: new Date(r["MONTH_START_DATE"]),
    COUNTRY_CODE: r["COUNTRY_CODE"] as string | null,
    COMMERCIAL_MODEL: (r["COMMERCIAL_MODEL"] as string | null) ?? "",
    CONTENT_TYPE: (r["CONTENT_TYPE"] as string | null) ?? "",
    RELEASE_GROUP_ID: String(r["RELEASE_GROUP_ID"] ?? "").trim(),
    FIRST_STREAM_DATE: r["FIRST_STREAM_DATE"] ? new Date(r["FIRST_STREAM_DATE"]) : null,
    RECORDING_ID: r["RECORDING_ID"],
    RECORDING_TITLE: r["RECORDING_TITLE"],
    QUANTITY: Number(r["QUANTITY"] || 0),
  });
  let rows = df.map(norm);

  // --- Territories ---
  const countriesRaw = Array.from(new Set(rows.map((r) => r.COUNTRY_CODE).filter(Boolean) as string[])).sort();
  const regionMapCodes: Record<string, string[]> = {
    "Latin America": ["MX", "CO", "AR", "BR", "CL", "PE", "EC", "VE", "UY", "PY", "BO", "CR", "PA", "DO", "GT", "HN", "SV", "NI", "CU", "PR"],
    "North America": ["US", "CA"],
    Europe: ["GB", "DE", "FR", "ES", "IT", "NL", "SE", "NO", "DK", "FI", "PT", "BE", "AT", "CH", "IE", "PL", "CZ", "RO", "HU", "GR"],
    "Asia Pacific": ["JP", "KR", "AU", "NZ", "IN", "ID", "TH", "PH", "MY", "SG", "TW", "HK", "VN"],
    "Middle East & Africa": ["ZA", "NG", "KE", "EG", "AE", "SA", "IL", "TR"],
  };
  const countriesNamed = countriesRaw.map((c) => COUNTRY_CODE_TO_NAME[c] || c);
  const regionsOut: Record<string, string[]> = {};
  for (const [regionName, codes] of Object.entries(regionMapCodes)) {
    const matched = codes.filter((c) => countriesRaw.includes(c)).map((c) => COUNTRY_CODE_TO_NAME[c] || c);
    if (matched.length) regionsOut[regionName] = matched;
  }
  result["territories"] = { countries: countriesNamed, regions: regionsOut };

  // --- Consumption Matrix (half-year buckets) ---
  rows = rows.filter((r) => !["Total", "LUMINATE_NULL"].includes(r.CONTENT_TYPE) && r.COMMERCIAL_MODEL !== "LUMINATE_NULL");

  if (rows.length === 0) {
    return computeFromAlbumMetadata(albums, currentYear);
  }

  const enriched = rows.map((r) => {
    const year = r.MONTH_START_DATE.getUTCFullYear();
    const month = r.MONTH_START_DATE.getUTCMonth() + 1;
    const half = month <= 6 ? "H1" : "H2";
    const bucket = `${year} ${half}`;
    const ctLower = (r.CONTENT_TYPE || "").toLowerCase();
    const cmLower = (r.COMMERCIAL_MODEL || "").toLowerCase();
    const isAudio = ctLower === "" || ctLower === "audio" || ctLower === "total" || ctLower.includes("audio");
    const isVideo = ctLower === "video" || ctLower.includes("video");
    const isPremium = cmLower === "premium" || cmLower.includes("premium");
    const isAd = !isPremium;
    let segment: string;
    if (isVideo && isPremium) segment = "video_premium";
    else if (isVideo && isAd) segment = "video_ad_supported";
    else if (isPremium) segment = "audio_premium";
    else segment = "audio_ad_supported";
    return { ...r, YEAR: year, BUCKET: bucket, SEGMENT: segment };
  });

  const bucketsSorted = Array.from(new Set(enriched.map((r) => r.BUCKET))).sort();
  const matrixRows = bucketsSorted.map((bucket) => {
    const bdf = enriched.filter((r) => r.BUCKET === bucket);
    const segSum = (seg: string) => sumBy(bdf.filter((r) => r.SEGMENT === seg), (r) => r.QUANTITY);
    return {
      bucket,
      audio_premium: Math.trunc(segSum("audio_premium")),
      audio_ad_supported: Math.trunc(segSum("audio_ad_supported")),
      video_premium: Math.trunc(segSum("video_premium")),
      video_ad_supported: Math.trunc(segSum("video_ad_supported")),
    };
  });
  result["consumption_matrix"] = matrixRows;

  // --- Growth Trend (yearly) ---
  const byYear = groupBy(enriched, (r) => r.YEAR);
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  const growthTrend: { year: number; yoy_growth_pct: number }[] = [];
  let prev: number | null = null;
  for (const year of years) {
    const total = sumBy(byYear.get(year)!, (r) => r.QUANTITY);
    const yoy = prev && prev > 0 ? round1(((total - prev) / prev) * 100) : 0;
    growthTrend.push({ year, yoy_growth_pct: yoy });
    prev = total;
  }
  result["growth_trend"] = growthTrend;

  // --- Market Growth ---
  const artistGrowth = growthTrend.length >= 2 ? growthTrend[growthTrend.length - 1].yoy_growth_pct : 0;
  result["market_growth"] = { artist_growth_pct: artistGrowth, market_growth_pct: 7.0 };

  // --- Catalog Age Split ---
  const albumYears = albums.map((a) => a.release_year || 0).filter((y: number) => y > 0);
  if (albumYears.length) {
    const olderCount = albumYears.filter((y: number) => currentYear - y > 10).length;
    const recentCount = albumYears.filter((y: number) => currentYear - y <= 3).length;
    const totalAlbums = albumYears.length;
    result["catalog_age_split"] = {
      older_than_10y_pct: Math.round((olderCount / totalAlbums) * 100),
      recent_releases_pct: Math.round((recentCount / totalAlbums) * 100),
    };
  } else {
    result["catalog_age_split"] = { older_than_10y_pct: 0, recent_releases_pct: 0 };
  }

  // --- Release Year Analysis ---
  const albumYearMap = new Map<string, number>();
  for (const a of albums) albumYearMap.set(String(a.album_id).trim(), Number(a.release_year || 0));

  const withAlbumYear = enriched.map((r) => {
    const mapped = albumYearMap.get(r.RELEASE_GROUP_ID);
    const fallbackYear = r.FIRST_STREAM_DATE ? r.FIRST_STREAM_DATE.getUTCFullYear() : 0;
    const albumYear = mapped !== undefined && mapped > 0 ? mapped : fallbackYear || 0;
    return { ...r, ALBUM_YEAR: albumYear };
  });

  const avgPpd = 0.003; // $0.003 per stream average
  const byAlbumYear = groupBy(withAlbumYear.filter((r) => r.ALBUM_YEAR > 0), (r) => r.ALBUM_YEAR);
  const ryYears = Array.from(byAlbumYear.keys()).sort((a, b) => a - b);
  const ryAnalysis: any[] = [];
  let prevStreams: number | null = null;
  for (const year of ryYears) {
    const streams = sumBy(byAlbumYear.get(year)!, (r) => r.QUANTITY);
    const rev = round2(streams * avgPpd);
    const yoy = prevStreams && prevStreams > 0 ? round1(((streams - prevStreams) / prevStreams) * 100) : 0;
    ryAnalysis.push({ bucket: String(year), consumption_streams: Math.trunc(streams), revenue_usd: rev, yoy_growth_pct: yoy });
    prevStreams = streams;
  }
  result["release_year_analysis"] = ryAnalysis;

  // --- Local/ROW Revenue ---
  const localCodes = ["MX", "US", "CO"];
  const totalStreams = sumBy(enriched, (r) => r.QUANTITY);
  const localStreams = sumBy(enriched.filter((r) => localCodes.includes(r.COUNTRY_CODE || "")), (r) => r.QUANTITY);
  const rowStreams = totalStreams - localStreams;
  result["local_row_revenue"] = {
    local_revenue_usd: round2(localStreams * avgPpd),
    row_revenue_usd: round2(rowStreams * avgPpd),
  };

  // --- PPD splits ---
  const ppdRates: Record<string, number> = {
    audio_premium: 0.0038,
    audio_ad_supported: 0.0015,
    video_premium: 0.002,
    video_ad_supported: 0.0007,
  };
  const currentSplits: Record<string, number> = {};
  const futureSplits: Record<string, number> = {};
  for (const [seg, rate] of Object.entries(ppdRates)) {
    currentSplits[seg] = rate;
    futureSplits[seg] = round6(rate * 1.05); // 5% projected increase
  }
  result["ppd"] = { current_splits: currentSplits, future_splits: futureSplits };

  // --- Enrich albums with per-album streams and revenue ---
  const byReleaseGroup = groupBy(enriched, (r) => r.RELEASE_GROUP_ID);
  const enrichedAlbums = albums.map((a) => {
    const aid = String(a.album_id).trim();
    const albumRows = byReleaseGroup.get(aid) || [];
    const streams = Math.trunc(sumBy(albumRows, (r) => r.QUANTITY));
    const trackCountFromData = new Set(albumRows.map((r) => r.RECORDING_ID)).size;
    return {
      ...a,
      total_consumption_streams: streams,
      current_revenue_usd: round2(streams * avgPpd),
      track_count: trackCountFromData > 0 ? trackCountFromData : a.track_count || 0,
    };
  });
  result["albums"] = enrichedAlbums;

  // --- New Release Tracks ---
  const cutoffYear = currentYear - 3;
  const recentRows = withAlbumYear.filter((r) => {
    const fallbackYear = r.FIRST_STREAM_DATE ? r.FIRST_STREAM_DATE.getUTCFullYear() : 0;
    return fallbackYear >= cutoffYear;
  });
  if (recentRows.length) {
    const byRecording = groupBy(recentRows, (r) => `${r.RECORDING_ID}|${r.RECORDING_TITLE}|${r.FIRST_STREAM_DATE ? r.FIRST_STREAM_DATE.getUTCFullYear() : 0}`);
    const trackPerf = Array.from(byRecording.entries()).map(([key, rs]) => {
      const [recordingId, recordingTitle, releaseYearGrp] = key.split("|");
      const totalStreams = sumBy(rs, (r) => r.QUANTITY);
      const months = new Set(rs.map((r) => r.MONTH_START_DATE.toISOString().slice(0, 7))).size;
      return { recordingId, recordingTitle, releaseYearGrp: Number(releaseYearGrp), totalStreams, months };
    });
    trackPerf.sort((a, b) => b.totalStreams - a.totalStreams);
    const top30 = trackPerf.slice(0, 30);
    const newReleaseTracks = top30.map((t) => {
      const monthlyAvg = t.months > 0 ? t.totalStreams / t.months : 0;
      const first12m = t.months > 0 ? (monthlyAvg * Math.min(t.months, 12)) / 1_000_000 : 0;
      let flag = "Normal";
      if (first12m > 50) flag = "Outlier";
      else if (t.months < 6) flag = "Incomplete Data";
      return {
        track_id: String(t.recordingId),
        track_name: String(t.recordingTitle || "Unknown"),
        release_year: t.releaseYearGrp,
        first_12m_streams_millions: round2(first12m),
        months_of_data: t.months,
        flag,
      };
    });
    result["new_release_tracks"] = newReleaseTracks;
  } else {
    result["new_release_tracks"] = [];
  }

  return result;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ─── ISRC CSV upload ──────────────────────────────────────────────────────────

function sanitizeUploadIdentifier(name: string): string {
  let sanitized = name.trim().replace(/[^A-Za-z0-9_]/g, "_");
  sanitized = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return sanitized ? sanitized.slice(0, 40) : "UNKNOWN";
}

/**
 * Upload a CSV of ISRCs into a temp table named STEP1_{user}_{filename}_{timestamp}.
 * Returns the fully-qualified table name.
 */
export async function createIsrcTempTable(run: Run, csvText: string, userEmail: string, filename: string): Promise<string> {
  const userPart = sanitizeUploadIdentifier(userEmail.includes("@") ? userEmail.split("@")[0] : userEmail);
  const filePart = sanitizeUploadIdentifier(filename.includes(".") ? filename.split(".").slice(0, -1).join(".") : filename);
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const tableName = `STEP1_${userPart}_${filePart}_${ts}`;
  const fqn = `${DB}.${tableName}`;

  await run(`CREATE OR REPLACE TABLE ${fqn} (ISRC VARCHAR)`);

  const isrcs: string[] = [];
  for (const line of csvText.split(/\r?\n/)) {
    const val = line.split(",")[0]?.trim().toUpperCase();
    if (val && val !== "ISRC") isrcs.push(val);
  }

  for (let i = 0; i < isrcs.length; i += 500) {
    const batch = isrcs.slice(i, i + 500);
    const values = batch.map((v) => `('${v.replace(/'/g, "''")}')`).join(", ");
    await run(`INSERT INTO ${fqn} VALUES ${values}`);
  }

  return fqn;
}
