    /* ---- SCREEN 5 : CATALOG ANALYTICS ---- */
    function renderScreen5() {
      const idx = Math.round(DATA.market_growth.artist_growth_pct / DATA.market_growth.market_growth_pct * 100);
      const matrix = DATA.consumption_matrix;
      const buckets = matrix.map(m => m.bucket);

      const tabs = ["All", "Audio", "Video", "Premium", "Ad Supported", "Growth Trend"];
      let tabContent = "";
      const t = state.analyticsTab;
      if (t === 0) {
        const series = [
          { name: "Audio Premium", color: "#E1261C", data: matrix.map(m => m.audio_premium) },
          { name: "Audio Ad Supported", color: "#8A8A8A", data: matrix.map(m => m.audio_ad_supported) },
          { name: "Video Premium", color: "#2A63C7", data: matrix.map(m => m.video_premium) },
          { name: "Video Ad Supported", color: "#B9861F", data: matrix.map(m => m.video_ad_supported) },
        ];
        // Compute total per bucket and YoY growth %
        const totals = matrix.map(m => m.audio_premium + m.audio_ad_supported + m.video_premium + m.video_ad_supported);
        const growthPcts = totals.map((v, i) => i === 0 ? 0 : ((v - totals[i - 1]) / (totals[i - 1] || 1) * 100));
        series.push({ name: "Growth %", color: "#1E9E5A", data: growthPcts, dashed: true, secondaryAxis: true });
        tabContent = multiLineChart(buckets, series, { dualAxis: true });
      } else if (t === 1) {
        tabContent = vBarChart(buckets, [
          { name: "Audio Premium", color: "#E1261C", data: matrix.map(m => m.audio_premium) },
          { name: "Audio Ad Supported", color: "#8A8A8A", data: matrix.map(m => m.audio_ad_supported) },
        ], { stacked: true });
      } else if (t === 2) {
        tabContent = vBarChart(buckets, [
          { name: "Video Premium", color: "#2A63C7", data: matrix.map(m => m.video_premium) },
          { name: "Video Ad Supported", color: "#8A8A8A", data: matrix.map(m => m.video_ad_supported) },
        ], { stacked: true });
      } else if (t === 3) {
        tabContent = vBarChart(buckets, [
          { name: "Audio Premium", color: "#E1261C", data: matrix.map(m => m.audio_premium) },
          { name: "Video Premium", color: "#2A63C7", data: matrix.map(m => m.video_premium) },
        ], { stacked: false });
      } else if (t === 4) {
        tabContent = vBarChart(buckets, [
          { name: "Audio Ad Supported", color: "#B9861F", data: matrix.map(m => m.audio_ad_supported) },
          { name: "Video Ad Supported", color: "#8A8A8A", data: matrix.map(m => m.video_ad_supported) },
        ], { stacked: false });
      } else {
        const g = DATA.growth_trend;
        tabContent = lineChart(g.map(x => x.year), g.map(x => x.yoy_growth_pct), "#E1261C") +
          `<div class="card" style="margin-top:14px;">
        <div class="kpi-label">Market Growth Comparison</div>
        <div class="card-body-text" style="font-size:.95rem;color:var(--text)">
          Artist Growth <b style="color:var(--accent)">${DATA.market_growth.artist_growth_pct}%</b> &divide;
          Market Growth <b>${DATA.market_growth.market_growth_pct}%</b> =
          <b style="color:var(--green)">${idx}% of market growth</b>
        </div>
      </div>`;
      }

      return `
    <div class="grid grid-4">
      ${kpiCard("Catalog from Releases &gt; 10y", DATA.catalog_age_split.older_than_10y_pct + "%")}
      ${kpiCard("Catalog from Recent Releases", DATA.catalog_age_split.recent_releases_pct + "%")}
      ${kpiCard("Artist Growth (2025)", DATA.market_growth.artist_growth_pct + "%", "vs prior year", true)}
      ${kpiCard("PP", idx + "%", "Market: " + DATA.market_growth.market_growth_pct + "%", idx >= 100)}
    </div>
    <div class="subtabs">
      ${tabs.map((tb, i) => `<button class="subtab ${i === t ? "active" : ""}" onclick="setAnalyticsTab(${i})">${tb}</button>`).join("")}
    </div>
    ${tabContent}
    ${navButtons(false)}
  `;
    }
    function setAnalyticsTab(i) { state.analyticsTab = i; render(); }

