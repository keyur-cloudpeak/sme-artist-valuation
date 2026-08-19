import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/snowflake";
import { MAX_STEP, MIN_STEP } from "@/lib/config";
import { clampStep, saveCheckpoint, completeSession, abandonOpenSessions, createNewSession, getOpenSession } from "@/lib/sessionManager";
import { createStep1SelectionTable, createStep2Table } from "@/lib/catalogBuilder";
import {
  loadDataFromSnowflake,
  searchCatalog,
  searchArtistsDropdown,
  searchLabelsDropdown,
  createIsrcTempTable,
  computeAnalyticsFromMonthlyDetail,
  computeFromAlbumMetadata,
} from "@/lib/dataLoader";
import { assembleWorkbenchHtml } from "@/lib/workbench/assemble";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function GET(req: NextRequest) {
  const cookieStore = req.cookies;
  const userEmail = cookieStore.get("wb_email")?.value || "";

  if (!userEmail) {
    return NextResponse.redirect(new URL("/", req.url), 303);
  }

  const sp = req.nextUrl.searchParams;

  return withConnection(async (run) => {
    // ─── "Start New Valuation" reset ──────────────────────────────────────────
    if (sp.get("wb_reset") === "1") {
      await abandonOpenSessions(run, userEmail);
      const newSession = await createNewSession(run, userEmail);
      const res = NextResponse.redirect(new URL("/workbench", req.url), 303);
      res.cookies.set("wb_session_id", newSession.session_id, COOKIE_OPTS);
      res.cookies.set("wb_current_step", String(newSession.current_step), COOKIE_OPTS);
      return res;
    }

    const sessionId = sp.get("wb_session_id") || cookieStore.get("wb_session_id")?.value || "";
    const currentStepCookieVal = Number(cookieStore.get("wb_current_step")?.value || MIN_STEP);
    let currentStep = sp.has("wb_step") ? clampStep(Number(sp.get("wb_step"))) : clampStep(currentStepCookieVal);

    // ─── Load bootstrap data ──────────────────────────────────────────────────
    let injectedData: Record<string, any>;
    try {
      injectedData = await loadDataFromSnowflake(run);
    } catch {
      injectedData = {
        albums: [], ambiguity_matches: {}, tracks: [], track_album_bridge: [],
        consumption_matrix: [], growth_trend: [], release_year_analysis: [],
        new_release_tracks: [], catalog_options: { artists: [], labels: [] },
      };
    }

    // ─── ISRC file upload (processed before search so an ISRC-mode search in the
    //     same request can already use the freshly created temp table) ─────────
    let isrcTable = cookieStore.get("wb_isrc_table")?.value || "";
    const wbIsrcFile = sp.get("wb_isrc_file") || "";
    const wbIsrcFilename = sp.get("wb_isrc_filename") || "";
    if (wbIsrcFile && wbIsrcFilename) {
      try {
        const csvText = Buffer.from(wbIsrcFile, "base64").toString("utf-8");
        isrcTable = await createIsrcTempTable(run, csvText, userEmail, wbIsrcFilename);
      } catch {
        // ignore, mirrors Python's best-effort ISRC processing
      }
    }

    // ─── Step Data extraction (from URL or Database) ──────────────────────────
    const wbStepDataRaw = sp.get("wb_step_data") || "";
    let wbStepData: Record<string, any> = {};
    if (wbStepDataRaw) {
      try {
        const parsed = JSON.parse(wbStepDataRaw);
        if (parsed && typeof parsed === "object") wbStepData = parsed;
      } catch {
        // ignore
      }
    } else if (sessionId) {
      // If we don't have step data in the URL (e.g. fresh load / resume),
      // fetch it from the database session.
      const openSession = await getOpenSession(run, userEmail);
      if (openSession && openSession.session_id === sessionId) {
        wbStepData = openSession.step_data || {};
      }
    }

    // ─── Live Luminate search (triggered from JS via query param or session) ──
    const wbSearchTerm = (sp.get("wb_search_term") || wbStepData.searchTerm || "").trim();
    const wbSearchMode = sp.get("wb_search_mode") || wbStepData.searchMode || "Artist";
    if (wbSearchTerm) {
      try {
        const liveResults = await searchCatalog(run, wbSearchMode, wbSearchTerm, isrcTable || undefined);
        if (liveResults.length) {
          injectedData.ambiguity_matches[wbSearchTerm] = liveResults;
        }
      } catch {
        // ignore
      }
    }

    // ─── Dropdown live search (autocomplete) ───────────────────────────────────
    const wbDropdownSearch = sp.get("wb_dropdown_search") || "";
    const wbDropdownMode = wbDropdownSearch ? sp.get("wb_dropdown_mode") || wbSearchMode : wbSearchMode;
    const dropdownTerm = (wbDropdownSearch || wbSearchTerm).trim();
    if (dropdownTerm.length >= 2) {
      try {
        injectedData.dropdown_results =
          wbDropdownMode === "Label"
            ? await searchLabelsDropdown(run, dropdownTerm)
            : await searchArtistsDropdown(run, dropdownTerm);
      } catch {
        injectedData.dropdown_results = [];
      }
    } else {
      injectedData.dropdown_results = [];
    }

    // ─── Stepwise table creation (step 1→2 transition) ─────────────────────────
    let catalogCreated = false;
    let step2Table = "";
    const wbCreateTable = sp.get("wb_create_table") === "1";
    const wbStep2Created = sp.get("wb_step2_created") === "1";
    
    const searchTermForTable = wbSearchTerm || "catalog";
    const searchModeForTable = wbSearchMode;
    const selectedEntities: string[] = Array.isArray(wbStepData.confirmed_mrelg_ids) ? wbStepData.confirmed_mrelg_ids : (wbStepData.resolvedEntities || []);

    if (currentStep >= 2 && wbCreateTable && !wbStep2Created && searchTermForTable && sessionId) {
      try {
        let step1Table = "";
        if (selectedEntities.length) {
          const step1Result = await createStep1SelectionTable(
            run,
            searchTermForTable,
            userEmail,
            selectedEntities,
            searchModeForTable,
            sessionId
          );
          if (step1Result.status === "success") step1Table = step1Result.table_name;
        }
        if (step1Table) {
          step2Table = await createStep2Table(run, step1Table, selectedEntities, userEmail, searchTermForTable, sessionId);
          catalogCreated = true;
        }
      } catch {
        // ignore, mirrors Python's best-effort table creation
      }
    } else if (wbStep2Created) {
      catalogCreated = true;
      step2Table = sp.get("wb_step2_table") || "";
    }

    // ─── Step 2 → 3: read step2 table + compute analytics for screens 4-8 ──────
    if (step2Table && catalogCreated) {
      try {
        const step2Rows = await run(`SELECT * FROM ${step2Table} ORDER BY TITLE`);
        injectedData.albums = step2Rows.map((r) => ({
          album_id: String(r["MRELG_ID"]),
          album_name: String(r["TITLE"] || ""),
          display_artist: String(r["DISPLAY_ARTIST"] || ""),
          release_type: String(r["RELEASE_TYPE"] || ""),
          release_year: r["RELEASE_YEAR"] ? Number(r["RELEASE_YEAR"]) : 0,
          track_count: 0,
          total_consumption_streams: 0,
          current_revenue_usd: 0,
          isrc: "",
          imprint: String(r["IMPRINT"] || ""),
          product_format: String(r["PRODUCT_FORMAT"] || ""),
        }));

        if (injectedData.albums.length) {
          try {
            const computed = await computeAnalyticsFromMonthlyDetail(run, step2Table, injectedData.albums);
            for (const key of [
              "territories", "consumption_matrix", "growth_trend", "market_growth",
              "catalog_age_split", "release_year_analysis", "local_row_revenue",
              "ppd", "new_release_tracks", "albums",
            ]) {
              if (key in computed) injectedData[key] = computed[key];
            }
          } catch {
            try {
              const fallback = computeFromAlbumMetadata(injectedData.albums, new Date().getFullYear());
              for (const key of [
                "territories", "consumption_matrix", "growth_trend", "market_growth",
                "catalog_age_split", "release_year_analysis", "local_row_revenue",
                "ppd", "new_release_tracks", "albums",
              ]) {
                if (key in fallback) injectedData[key] = fallback[key];
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // ─── Step sync: persist checkpoint from query params ───────────────────────
    if (sp.has("wb_step") && sessionId) {
      await saveCheckpoint(run, sessionId, currentStep, wbStepData, userEmail);
      if (currentStep >= MAX_STEP) {
        await completeSession(run, sessionId);
      }
    }

    // ─── Assemble the inner workbench HTML (iframe content) ────────────────────
    const innerHtml = assembleWorkbenchHtml({
      injectedData,
      currentStep,
      catalogCreated,
      userEmail,
      sessionId,
      stepData: wbStepData,
    });

    // Persist wb_step2_created/wb_step2_table on the browser's URL bar (without a
    // reload) once the table exists, mirroring Python's `st.query_params.update(...)`.
    const urlSyncScript =
      catalogCreated && step2Table && !wbStep2Created
        ? `<script>(function(){try{var u=new URL(window.location.href);u.searchParams.set('wb_step2_created','1');u.searchParams.set('wb_step2_table',${JSON.stringify(step2Table)});window.history.replaceState(null,'',u.toString());}catch(e){}})();</script>`
        : "";

    // Escape </script> sequences so they don't break the outer <script> block.
    // JSON.stringify handles quotes & newlines but NOT </script> which the HTML
    // parser treats as end-of-script regardless of JS string context.
    const safeInnerHtml = JSON.stringify(innerHtml).replace(/<\/script>/gi, "<\\/script>");

    const outerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sony Music | M&amp;A Catalog Valuation Workbench</title>
<style>html,body{margin:0;padding:0;overflow-x:hidden;} #wbFrame{width:100%;height:100vh;border:none;display:block;}</style>
</head>
<body>
<iframe id="wbFrame"></iframe>
${urlSyncScript}
<script>
  var frame = document.getElementById('wbFrame');
  frame.srcdoc = ${safeInnerHtml};
</script>
</body>
</html>`;

    const res = new NextResponse(outerHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    res.cookies.set("wb_current_step", String(currentStep), COOKIE_OPTS);
    if (isrcTable) res.cookies.set("wb_isrc_table", isrcTable, COOKIE_OPTS);
    return res;
  });
}
