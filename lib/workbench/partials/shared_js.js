  <script>
    /* ============================================================
       SONY MUSIC — M&A CATALOG VALUATION WORKBENCH
       App logic (vanilla JS, no frameworks)
       ============================================================ */

    const SCREENS = [
      { n: 1, key: "catalog", label: "CATALOG SELECT", color: "var(--accent)" },
      { n: 2, key: "metadata", label: "RESOLVE AMBIGUITY", color: "var(--accent)" },
      { n: 3, key: "metainc", label: "METADATA TO INCLUDE", color: "var(--accent)" },
      { n: 4, key: "territory", label: "TERRITORY MAP", color: "var(--accent)" },
      { n: 5, key: "analytics", label: "CATALOG ANALYTICS", color: "var(--accent)" },
      { n: 6, key: "revenue", label: "REVENUE & PPD", color: "var(--accent)" },
      { n: 7, key: "albums", label: "ALBUM ANALYSIS", color: "var(--accent)" },
      { n: 8, key: "export", label: "CORPORATE EXPORT", color: "var(--accent)" },
    ];

    const state = {
      screen: 1,
      completedSteps: new Set(),
      theme: "light",
      searchMode: "Artist",
      searchTerm: "",
      resolvedEntities: [],
      metadataSearch: "",
      screen3YearFilter: [],
      includedAlbums: null,
      territoryMode: "Country selection",
      region: Object.keys(DATA.territories.regions)[0],
      localTerritories: ["Mexico", "United States", "Colombia"],
      excludedFlags: ["Duplicate", "Outlier", "Incomplete Data"],
      projTracks: 10,
      expectedGrowth: 8.0,
      expectedDecay: -6.0,
      albumFilter: "All",
      albumYearFilter: [],
      analyticsTab: 0,
      revenueTab: 0,
      screen6FromDate: "",
      screen6ToDate: "",

      uploadedFile: null,
      // Pipeline job state
      pipeline: {
        status: "idle", // idle | running | completed | failed
        progress: 0,    // 0-100
        startedAt: null,
        estimatedMinutes: 1,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 2,
        failedStep: null, // which step failed
      },
    };

    function initIncludedAlbums() {
      if (state.includedAlbums) return;
      const m = {};
      DATA.albums.forEach(a => {
        m[a.album_id] = true;
      });
      state.includedAlbums = m;
    }
    initIncludedAlbums();

    /* ---------------- helpers ---------------- */
    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));
    const fmtUSD = v => { const m = Number(v) / 1000000; return "$" + m.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "M"; };
    const fmtUSD4 = v => "$" + Number(v).toFixed(4);
    const fmtNum = v => Number(v).toLocaleString("en-US");
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    function toast(msg) {
      const t = $("#toast");
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
    }

    /* ---------------- component builders ---------------- */

    // Multi-select checkbox dropdown builder
    function multiSelectYear(id, allYears, selectedYears, onChangeFn) {
      const allSelected = selectedYears.length === 0; // empty = "All"
      const label = allSelected ? "All" : (selectedYears.length === 1 ? String(selectedYears[0]) : selectedYears.length + " selected");
      const optionsHtml = allYears.map(y => {
        const checked = selectedYears.includes(y) ? "checked" : "";
        return `<label class="ms-option" onclick="event.stopPropagation()">
          <input type="checkbox" ${checked} onchange="${onChangeFn}(${y}, this.checked)"> ${y}
        </label>`;
      }).join("");
      return `<div class="multi-select-dropdown" id="${id}">
        <div class="ms-trigger" onclick="toggleMsDropdown('${id}')">
          <span>${label}</span>
          <span class="ms-arrow">&#9660;</span>
        </div>
        <div class="ms-panel">
          <label class="ms-option ms-all" onclick="event.stopPropagation()">
            <input type="checkbox" ${allSelected ? "checked" : ""} onchange="${onChangeFn}('all', this.checked)"> All
          </label>
          ${optionsHtml}
        </div>
      </div>`;
    }
    function toggleMsDropdown(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("open");
      // Close on outside click
      if (el.classList.contains("open")) {
        setTimeout(function() {
          function closer(e) { if (!el.contains(e.target)) { el.classList.remove("open"); document.removeEventListener("click", closer); } }
          document.addEventListener("click", closer);
        }, 0);
      }
    }

    function kpiCard(label, value, delta, positive) {
      let deltaHtml = "";
      if (delta !== undefined && delta !== null) {
        const cls = positive ? "pos" : "neg";
        const arrow = positive ? "&#9650;" : "&#9660;";
        deltaHtml = `<div class="kpi-delta ${cls}">${arrow}&nbsp;${esc(delta)}</div>`;
      }
      return `<div class="card">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${value}</div>
    ${deltaHtml}
  </div>`;
    }

    function sectionTitle(title, caption) {
      return `<div class="section-title">${esc(title)}</div>` +
        (caption ? `<div class="section-caption">${esc(caption)}</div>` : "");
    }

    function tag(text, cls) {
      return `<span class="tag tag-${cls}">${esc(text)}</span>`;
    }

    function table(headers, rows, opts) {
      opts = opts || {};
      const scrollCls = opts.scroll ? "table-scroll" : "";
      let thead = "<tr>" + headers.map(h => `<th>${esc(h)}</th>`).join("") + "</tr>";
      let tbody = rows.map(r => "<tr>" + r + "</tr>").join("");
      return `<div class="table-wrap"><div class="${scrollCls}"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div></div>`;
    }

    /* ---------------- SVG chart builders ---------------- */
    function svgWrap(inner, viewW, viewH) {
      return `<svg viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
    }

    function niceMax(v) {
      if (v <= 0) return 10;
      const mag = Math.pow(10, Math.floor(Math.log10(v)));
      const norm = v / mag;
      let step;
      if (norm <= 1) step = 1; else if (norm <= 2) step = 2; else if (norm <= 5) step = 5; else step = 10;
      return step * mag;
    }

    /* Vertical bar chart: 1-2 series, grouped or stacked */
    function vBarChart(categories, series, opts) {
      opts = opts || {};
      const W = 880, H = opts.height || 220;
      const padL = 58, padR = 16, padT = 16, padB = 44;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const stacked = !!opts.stacked;
      let maxVal = 0;
      categories.forEach((c, i) => {
        if (stacked) {
          let sum = 0; series.forEach(s => sum += (s.data[i] || 0));
          maxVal = Math.max(maxVal, sum);
        } else {
          series.forEach(s => maxVal = Math.max(maxVal, s.data[i] || 0));
        }
      });
      maxVal = niceMax(maxVal * 1.08);
      const n = categories.length;
      const groupW = plotW / n;
      const barPad = groupW * 0.18;
      const barsAvail = groupW - barPad * 2;
      const seriesW = stacked ? barsAvail : barsAvail / series.length;

      let bars = "";
      let gridLines = "";
      const gridSteps = 4;
      for (let g = 0; g <= gridSteps; g++) {
        const val = maxVal * g / gridSteps;
        const y = padT + plotH - (val / maxVal) * plotH;
        gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid-line"/>`;
        gridLines += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" class="axis-label">${opts.valueFormatter ? opts.valueFormatter(val) : Math.round(val)}</text>`;
      }

      categories.forEach((cat, i) => {
        const gx = padL + i * groupW + barPad;
        let stackY = padT + plotH;
        series.forEach((s, si) => {
          const v = s.data[i] || 0;
          const h = (v / maxVal) * plotH;
          let x;
          if (stacked) { x = gx; } else { x = gx + si * seriesW; }
          const y = stacked ? (stackY - h) : (padT + plotH - h);
          bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(seriesW - 3).toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="3" fill="${s.color}" opacity="0.92"><title>${esc(cat)} — ${esc(s.name)}: ${fmtNum(v)}</title></rect>`;
          if (stacked) stackY -= h;
        });
        const lx = gx + barsAvail / 2;
        bars += `<text x="${lx.toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" class="axis-label">${esc(cat)}</text>`;
      });

      let legend = "";
      if (series.length > 1) {
        legend = `<g transform="translate(${padL},4)">` + series.map((s, i) =>
          `<g transform="translate(${i * 130},0)"><rect width="9" height="9" rx="2" fill="${s.color}"/><text x="14" y="8.5" class="axis-label" style="font-size:10px">${esc(s.name)}</text></g>`
        ).join("") + `</g>`;
      }

      return `<div class="chart-box">${svgWrap(gridLines + bars + legend, W, H)}</div>`;
    }

    /* Horizontal bar chart: single series, with optional average vline */
    function hBarChart(categories, values, color, opts) {
      opts = opts || {};
      const W = 880, H = opts.height || Math.max(280, categories.length * 34 + 60);
      const padL = 190, padR = 60, padT = 12, padB = 30;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const maxVal = niceMax(Math.max(...values, 0.001) * 1.12);
      const n = categories.length;
      const rowH = plotH / n;
      const barH = rowH * 0.6;

      let bars = "";
      let gridLines = "";
      const gridSteps = 4;
      for (let g = 0; g <= gridSteps; g++) {
        const val = maxVal * g / gridSteps;
        const x = padL + (val / maxVal) * plotW;
        gridLines += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" class="grid-line"/>`;
        gridLines += `<text x="${x}" y="${H - padB + 16}" text-anchor="middle" class="axis-label">${opts.valueFormatter ? opts.valueFormatter(val) : Math.round(val)}</text>`;
      }

      categories.forEach((cat, i) => {
        const v = values[i] || 0;
        const y = padT + i * rowH + (rowH - barH) / 2;
        const w = (v / maxVal) * plotW;
        bars += `<text x="${padL - 10}" y="${(y + barH / 2 + 4).toFixed(1)}" text-anchor="end" class="axis-label" style="font-size:10.5px">${esc(cat.length > 26 ? cat.slice(0, 24) + '…' : cat)}</text>`;
        bars += `<rect x="${padL}" y="${y.toFixed(1)}" width="${Math.max(w, 0).toFixed(1)}" height="${barH.toFixed(1)}" rx="4" fill="${color}" opacity="0.92"><title>${esc(cat)}: ${fmtNum(v)}</title></rect>`;
        bars += `<text x="${(padL + w + 6).toFixed(1)}" y="${(y + barH / 2 + 4).toFixed(1)}" class="bar-value">${opts.valueFormatter ? opts.valueFormatter(v) : fmtNum(v)}</text>`;
      });

      let avgLine = "";
      if (opts.avgLine !== undefined) {
        const ax = padL + (opts.avgLine / maxVal) * plotW;
        avgLine = `<line x1="${ax}" y1="${padT}" x2="${ax}" y2="${H - padB}" stroke="var(--green)" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="${ax}" y="${padT - 2}" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;fill:var(--green);font-weight:700">AVG ${opts.avgLabel || opts.avgLine}</text>`;
      }

      return `<div class="chart-box">${svgWrap(gridLines + bars + avgLine, W, H)}</div>`;
    }

    /* Line chart: single series */
    function lineChart(categories, values, color, opts) {
      opts = opts || {};
      const W = 880, H = opts.height || 340;
      const padL = 54, padR = 20, padT = 20, padB = 40;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const minV = Math.min(...values, 0);
      const maxV = niceMax(Math.max(...values) * 1.15);
      const n = categories.length;
      const stepX = n > 1 ? plotW / (n - 1) : 0;

      const range = maxV - minV || 1;
      const pts = values.map((v, i) => {
        const x = padL + i * stepX;
        const y = padT + plotH - ((v - minV) / range) * plotH;
        return [x, y];
      });

      let gridLines = "";
      for (let g = 0; g <= 4; g++) {
        const val = minV + (range * g / 4);
        const y = padT + plotH - ((val - minV) / range) * plotH;
        gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid-line"/>`;
        gridLines += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" class="axis-label">${val.toFixed(1)}%</text>`;
      }
      const zeroY = padT + plotH - ((0 - minV) / range) * plotH;

      const pathD = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      const areaD = pathD + ` L${pts[pts.length - 1][0].toFixed(1)},${zeroY} L${pts[0][0].toFixed(1)},${zeroY} Z`;

      let dots = "";
      pts.forEach((p, i) => {
        dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="${color}" stroke="var(--surface)" stroke-width="2"><title>${esc(categories[i])}: ${values[i]}%</title></circle>`;
        dots += `<text x="${p[0].toFixed(1)}" y="${(p[1] - 12).toFixed(1)}" text-anchor="middle" class="axis-label" style="font-weight:700">${values[i]}%</text>`;
        dots += `<text x="${p[0].toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" class="axis-label">${esc(categories[i])}</text>`;
      });

      return `<div class="chart-box">${svgWrap(
        gridLines +
        `<path d="${areaD}" fill="${color}" opacity="0.08"/>` +
        `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
        dots, W, H)}</div>`;
    }

    /* Multi-series line chart */
    function multiLineChart(categories, series, opts) {
      opts = opts || {};
      const W = 880, H = opts.height || 340;
      const padL = 70, padR = opts.dualAxis ? 70 : 20, padT = 20, padB = 40;
      const plotW = W - padL - padR, plotH = H - padT - padB;

      // Separate primary and secondary axis series
      const primarySeries = series.filter(s => !s.secondaryAxis);
      const secondarySeries = series.filter(s => s.secondaryAxis);

      const primaryVals = primarySeries.flatMap(s => s.data);
      const minV = Math.min(...primaryVals, 0);
      const maxV = niceMax(Math.max(...primaryVals) * 1.15);
      const range = maxV - minV || 1;

      let minV2 = 0, maxV2 = 1, range2 = 1;
      if (secondarySeries.length) {
        const secVals = secondarySeries.flatMap(s => s.data);
        minV2 = Math.min(...secVals, 0);
        maxV2 = Math.max(...secVals) * 1.15;
        if (maxV2 <= minV2) maxV2 = minV2 + 1;
        range2 = maxV2 - minV2;
      }

      const n = categories.length;
      const stepX = n > 1 ? plotW / (n - 1) : 0;

      let gridLines = "";
      for (let g = 0; g <= 4; g++) {
        const val = minV + (range * g / 4);
        const y = padT + plotH - ((val - minV) / range) * plotH;
        gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid-line"/>`;
        gridLines += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" class="axis-label">${fmtNum(Math.round(val))}</text>`;
      }

      // Secondary Y-axis labels
      if (opts.dualAxis && secondarySeries.length) {
        for (let g = 0; g <= 4; g++) {
          const val = minV2 + (range2 * g / 4);
          const y = padT + plotH - ((val - minV2) / range2) * plotH;
          gridLines += `<text x="${W - padR + 8}" y="${y + 3}" text-anchor="start" class="axis-label" fill="#1E9E5A">${val.toFixed(1)}%</text>`;
        }
      }

      let xLabels = "";
      categories.forEach((cat, i) => {
        const x = padL + i * stepX;
        xLabels += `<text x="${x.toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" class="axis-label">${esc(cat)}</text>`;
      });

      let lines = "";
      series.forEach(s => {
        const isSecondary = s.secondaryAxis;
        const sMinV = isSecondary ? minV2 : minV;
        const sRange = isSecondary ? range2 : range;
        const pts = s.data.map((v, i) => {
          const x = padL + i * stepX;
          const y = padT + plotH - ((v - sMinV) / sRange) * plotH;
          return [x, y];
        });
        const pathD = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
        const dashAttr = s.dashed ? ' stroke-dasharray="6,4"' : '';
        lines += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"${dashAttr}/>`;
        pts.forEach((p, i) => {
          const valLabel = isSecondary ? s.data[i].toFixed(1) + "%" : fmtNum(s.data[i]);
          lines += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"><title>${esc(s.name)} — ${esc(categories[i])}: ${valLabel}</title></circle>`;
        });
      });

      let legend = `<div style="display:flex;gap:16px;justify-content:center;margin-top:8px;flex-wrap:wrap;">`;
      series.forEach(s => {
        const lineStyle = s.dashed ? 'border-top:2px dashed ' + s.color + ';width:12px;height:0;display:inline-block;' : 'width:12px;height:12px;border-radius:2px;background:' + s.color + ';display:inline-block;';
        legend += `<span style="display:flex;align-items:center;gap:5px;font-size:.8rem;"><span style="${lineStyle}"></span>${esc(s.name)}</span>`;
      });
      legend += `</div>`;

      return `<div class="chart-box">${svgWrap(gridLines + xLabels + lines, W, H)}</div>` + legend;
    }

    /* Donut chart */
    function donutChart(labels, values, colors, opts) {
      opts = opts || {};
      const W = 420, H = opts.height || 300;
      const cx = W / 2, cy = H / 2 - 8, r = Math.min(W, H) / 2 - 20, r0 = r * 0.58;
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let angle = -Math.PI / 2;
      let paths = "";
      const legend = [];
      labels.forEach((lab, i) => {
        const v = values[i];
        const frac = v / total;
        const a0 = angle;
        const a1 = angle + frac * Math.PI * 2;
        angle = a1;
        const large = (a1 - a0) > Math.PI ? 1 : 0;
        const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const xi0 = cx + r0 * Math.cos(a1), yi0 = cy + r0 * Math.sin(a1);
        const xi1 = cx + r0 * Math.cos(a0), yi1 = cy + r0 * Math.sin(a0);
        const d = `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} L${xi0.toFixed(2)},${yi0.toFixed(2)} A${r0},${r0} 0 ${large} 0 ${xi1.toFixed(2)},${yi1.toFixed(2)} Z`;
        paths += `<path d="${d}" fill="${colors[i]}"><title>${esc(lab)}: ${(frac * 100).toFixed(1)}%</title></path>`;
        legend.push(`<div style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:3px;background:${colors[i]};display:inline-block;"></span><span style="font-family:var(--font-mono);font-size:.76rem;color:var(--text-dim)">${esc(lab)}</span><span style="font-family:var(--font-mono);font-size:.76rem;font-weight:700;margin-left:auto">${(frac * 100).toFixed(1)}%</span></div>`);
      });
      const centerText = `<text x="${cx}" y="${cy - 4}" text-anchor="middle" style="font-family:var(--font-serif);font-weight:800;font-size:22px;fill:var(--text)">${labels.length}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="axis-label">SEGMENTS</text>`;
      return `<div class="chart-box"><div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
    <div style="flex:0 0 auto;width:220px">${svgWrap(paths + centerText, W, H)}</div>
    <div style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:10px">${legend.join("")}</div>
  </div></div>`;
    }

    /* ============================================================
       SCREEN RENDERERS
       ============================================================ */
