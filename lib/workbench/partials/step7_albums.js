    /* ---- SCREEN 7 : ALBUM ANALYSIS ---- */
    function renderScreen7() {
      const filter = state.albumFilter;
      const yearFilter = state.albumYearFilter || [];
      const albumsWithStatus = DATA.albums.map(a => Object.assign({}, a, { Status: state.includedAlbums[a.album_id] ? "Include" : "Exclude" }));
      let view = filter === "All" ? albumsWithStatus : albumsWithStatus.filter(a => a.Status === filter);
      if (yearFilter.length > 0) {
        view = view.filter(a => yearFilter.includes(a.release_year));
      }

      // Get unique release years for dropdown
      const allYears = [...new Set(DATA.albums.map(a => a.release_year))].sort((a, b) => b - a);

      const rows = view.map(a => `<td class="strong">${esc(a.album_name)}</td><td>${esc(a.release_type)}</td><td class="num">${a.release_year}</td><td class="num">${a.track_count}</td><td class="num">${fmtNum(a.total_consumption_streams || 0)}</td><td class="num">${fmtUSD(a.current_revenue_usd)}</td><td>${a.Status === "Include" ? tag("Include", "green") : tag("Exclude", "red")}</td>`);

      const included = albumsWithStatus.filter(a => a.Status === "Include");
      const totalTracks = included.reduce((s, a) => s + a.track_count, 0);
      const totalRevenue = included.reduce((s, a) => s + a.current_revenue_usd, 0);
      const totalConsumption = included.reduce((s, a) => s + (a.total_consumption_streams || 0), 0);

      const albumChartTab = state.albumChartTab || 0;
      const sortedInc = included.slice().sort((a, b) => albumChartTab === 1
        ? (b.total_consumption_streams || 0) - (a.total_consumption_streams || 0)
        : b.current_revenue_usd - a.current_revenue_usd);

      const chartTabs = ["Revenue", "Consumption"];
      const chartTabsHtml = chartTabs.map((tb, i) =>
        `<button class="subtab ${i === albumChartTab ? "active" : ""}" onclick="setAlbumChartTab(${i})">${tb}</button>`
      ).join("");

      const chart = albumChartTab === 1
        ? hBarChart(sortedInc.map(a => a.album_name), sortedInc.map(a => a.total_consumption_streams || 0), "#2A63C7", { valueFormatter: v => (v / 1e6).toFixed(1) + "M", height: Math.max(200, sortedInc.length * 22 + 60) })
        : hBarChart(sortedInc.map(a => a.album_name), sortedInc.map(a => a.current_revenue_usd), "#E1261C", { valueFormatter: v => "$" + (v / 1000).toFixed(0) + "K", height: Math.max(200, sortedInc.length * 22 + 60) });

      return `
    <div class="grid grid-4" style="margin-top:16px;">
      ${kpiCard("Albums in Scope", included.length)}
      ${kpiCard("Total Tracks", fmtNum(totalTracks))}
      ${kpiCard("Total Consumption", (totalConsumption / 1000000).toLocaleString("en-US", {maximumFractionDigits: 1}) + "M")}
      ${kpiCard("Total Current Revenue", fmtUSD(totalRevenue))}
    </div>
    <div style="display:flex; gap:100px; flex-wrap:wrap; align-items:flex-end; padding-top: 10px;">
      <div class="field" style="max-width:220px;">
        <label class="field-label">Filter</label>
        <select onchange="setAlbumFilter(this.value)">
          ${["All", "Include", "Exclude"].map(f => `<option ${f === filter ? "selected" : ""}>${f}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="max-width:220px;">
        <label class="field-label">Release Year</label>
        ${multiSelectYear("ms-year-s7", allYears, yearFilter, "toggleAlbumYear")}
      </div>
    </div>
    ${table(["Album", "Release Type", "Release Year", "Track Count", "Total Consumption (Streams)", "Current Revenue (USD)", "Status"], rows, { scroll: true })}
    ${sectionTitle("Album Analysis Chart (Included)")}
    <div class="subtabs">${chartTabsHtml}</div>
    ${chart}
    ${navButtons(false)}
  `;
    }
    function setAlbumFilter(v) { state.albumFilter = v; render(); }
    function toggleAlbumYear(year, checked) {
      if (year === 'all') {
        state.albumYearFilter = [];
      } else {
        var arr = state.albumYearFilter || [];
        if (checked) {
          if (!arr.includes(year)) arr.push(year);
        } else {
          arr = arr.filter(function(y) { return y !== year; });
        }
        state.albumYearFilter = arr;
      }
      render();
    }
    function setAlbumChartTab(i) { state.albumChartTab = i; render(); }

