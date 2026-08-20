    /* ---- SCREEN 8 : CORPORATE EXPORT ---- */
    function computeExport() {
      const included = DATA.albums.filter(a => state.includedAlbums[a.album_id]);
      const activeNr = DATA.new_release_tracks.filter(d => state.excludedFlags.indexOf(d.flag) === -1);
      const avgStreams = activeNr.length ? Math.round((activeNr.reduce((s, d) => s + d.first_12m_streams_millions, 0) / activeNr.length) * 100) / 100 : 0;
      const idx = Math.round(DATA.market_growth.artist_growth_pct / DATA.market_growth.market_growth_pct * 100);
      return {
        "Catalog Name": state.resolvedEntity || state.searchTerm,
        "Local Territories": state.localTerritories.join(", "),
        "Total Albums (Included)": included.length,
        "Total Tracks (Included)": included.reduce((s, a) => s + a.track_count, 0),
        "Current Annual Revenue (USD)": included.reduce((s, a) => s + a.current_revenue_usd, 0),
        "Local Revenue (USD)": DATA.local_row_revenue.local_revenue_usd,
        "ROW Revenue (USD)": DATA.local_row_revenue.row_revenue_usd,
        "Catalog Age Split — Older than 10y": DATA.catalog_age_split.older_than_10y_pct + "%",
        "Catalog Age Split — Recent": DATA.catalog_age_split.recent_releases_pct + "%",
        "YoY Growth 2025": DATA.market_growth.artist_growth_pct + "%",
        "Market Growth 2025": DATA.market_growth.market_growth_pct + "%",
        "PP": idx + "%",
        "Expected Growth Assumption (Analyst)": state.expectedGrowth + "%",
        "Expected Decay Assumption (Analyst)": state.expectedDecay + "%",
        "Average New-Track Streams (M)": avgStreams,
        "Projected Next Album Streams (M)": Math.round(avgStreams * 10 * 10) / 10,
        _included: included,
      };
    }
    function renderScreen8() {
      const exp = computeExport();
      const rows = Object.entries(exp).filter(([k]) => k !== "_included").map(([k, v]) => `<td class="strong">${esc(k)}</td><td class="num">${esc(v)}</td>`);

      return `
    <div class="grid grid-3" style="margin-top:16px;">
      ${kpiCard("Current Annual Revenue", fmtUSD(exp["Current Annual Revenue (USD)"]))}
      ${kpiCard("Local / ROW Split", fmtUSD(exp["Local Revenue (USD)"]) + " / " + fmtUSD(exp["ROW Revenue (USD)"]))}
      ${kpiCard("PP", exp["PP"])}
    </div>
    ${table(["Corporate Template Field", "Value"], rows, { scroll: true })}
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-top:32px;">
      <div>
        ${sectionTitle("Export")}
        <button class="btn" onclick="downloadExcel()">&#11015;&nbsp; Download Corporate Excel Template</button>
      </div>
    </div>
  `;
    }

    function downloadExcel() {
      try {
        const exp = computeExport();
        const wb = XLSX.utils.book_new();
        const expRows = Object.entries(exp).filter(([k]) => k !== "_included").map(([k, v]) => ({ "Corporate Template Field": k, "Value": String(v) }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), "Corporate Template Inputs");

        const albumRows = exp._included.map(a => ({ album_name: a.album_name, release_type: a.release_type, release_year: a.release_year, track_count: a.track_count, current_revenue_usd: a.current_revenue_usd }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(albumRows), "Album Detail");

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(DATA.release_year_analysis), "Release-Year Analysis");

        const fname = "corporate_valuation_inputs_" + String(exp["Catalog Name"]).replace(/\s+/g, "_") + ".xlsx";
        XLSX.writeFile(wb, fname);
        toast("Excel template downloaded");
      } catch (e) {
        console.error(e);
        toast("Export failed — see console");
      }
    }

    /* ============================================================
