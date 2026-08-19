    /* ---- SCREEN 6 : RELEASE-YEAR & REVENUE ---- */
    function renderScreen6() {
      let ry = DATA.release_year_analysis;

      // Apply date filter
      const fromYear6 = state.screen6FromDate ? parseInt(state.screen6FromDate.split("-")[0]) : null;
      const toYear6 = state.screen6ToDate ? parseInt(state.screen6ToDate.split("-")[0]) : null;
      if (fromYear6 || toYear6) {
        ry = ry.filter(function(r) {
          const match = r.bucket.match(/\d{4}/);
          if (!match) return true;
          const yr = parseInt(match[0]);
          if (fromYear6 && yr < fromYear6) return false;
          if (toYear6 && yr > toYear6) return false;
          return true;
        });
      }

      const buckets = ry.map(r => r.bucket);
      const tabs = ["Consumption", "Revenue", "Growth"];
      const t = state.revenueTab;
      let chart = "";
      if (t === 0) chart = vBarChart(buckets, [{ name: "Streams", color: "#E1261C", data: ry.map(r => r.consumption_streams) }], { valueFormatter: v => (v / 1e6).toFixed(0) + "M", height: 220 });
      else if (t === 1) chart = vBarChart(buckets, [{ name: "Revenue", color: "#2A63C7", data: ry.map(r => r.revenue_usd) }], { valueFormatter: v => "$" + (v / 1000000).toFixed(1) + "M", height: 220 });
      else chart = vBarChart(buckets, [{ name: "YoY Growth %", color: "#1E9E5A", data: ry.map(r => r.yoy_growth_pct) }], { valueFormatter: v => v.toFixed(0) + "%", height: 220 });

      const rows = ry.map(r => `<td class="strong">${esc(r.bucket)}</td><td class="num">${(r.consumption_streams / 1000000).toFixed(1)}M</td><td class="num">${fmtUSD(r.revenue_usd)}</td><td class="num">${r.yoy_growth_pct}%</td>`);

      const ppdRows = [
        ...Object.entries(DATA.ppd.current_splits).map(([k, v]) => `<td>Current</td><td class="strong">${esc(k)}</td><td class="num">${fmtUSD4(v)}</td>`),
        ...Object.entries(DATA.ppd.future_splits).map(([k, v]) => `<td>Future-State</td><td class="strong">${esc(k)}</td><td class="num">${fmtUSD4(v)}</td>`)
      ];

      return `
    ${sectionTitle("Local / ROW Revenue Output")}
    <div class="grid grid-2">
      ${kpiCard("Local Revenue", fmtUSD(DATA.local_row_revenue.local_revenue_usd))}
      ${kpiCard("ROW Revenue", fmtUSD(DATA.local_row_revenue.row_revenue_usd))}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
      <div class="subtabs" style="margin-bottom:0;">
        ${tabs.map((tb, i) => `<button class="subtab ${i === t ? "active" : ""}" onclick="setRevenueTab(${i})">${tb}</button>`).join("")}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <label style="font-size:0.8rem;font-weight:500;color:var(--fg);opacity:0.7;margin:0;">From</label>
        <input type="date" value="${state.screen6FromDate}" onchange="setScreen6FromDate(this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--bg);color:var(--fg);font-size:0.8rem;">
        <label style="font-size:0.8rem;font-weight:500;color:var(--fg);opacity:0.7;margin:0;">To</label>
        <input type="date" value="${state.screen6ToDate}" onchange="setScreen6ToDate(this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--bg);color:var(--fg);font-size:0.8rem;">
        ${(state.screen6FromDate || state.screen6ToDate) ? '<button onclick="clearScreen6Dates()" style="padding:3px 8px;font-size:0.75rem;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);cursor:pointer;">Clear</button>' : ''}
      </div>
    </div>
    ${chart}
    ${table(["Release Year Bucket", "Consumption", "Revenue (USD)", "YoY Growth %"], rows)}

    ${table(["Split Type", "Segment", "PPD (USD)"], ppdRows)}
    ${navButtons(false)}
  `;
    }
    function setRevenueTab(i) { state.revenueTab = i; render(); }
    function setScreen6FromDate(v) { state.screen6FromDate = v; render(); }
    function setScreen6ToDate(v) { state.screen6ToDate = v; render(); }
    function clearScreen6Dates() { state.screen6FromDate = ""; state.screen6ToDate = ""; render(); }

