    /* ---- SCREEN 2 : RESOLVE AMBIGUITY ---- */
    function renderScreen2() {
      // If pipeline is running/failed/completed, show pipeline UI instead
      if (state.pipeline.status === "running" || state.pipeline.status === "failed" || state.pipeline.status === "completed") {
        return `
      ${renderPipelineProgress()}
    `;
      }

      const matches = getAmbiguityMatches();

      const confColor = c => c === "High" ? "green" : c === "Medium" ? "gold" : "grey";
      const rows = matches.map(m => {
        const checked = state.resolvedEntities.includes(m.name) ? "checked" : "";
        return `<td style="width:60px;text-align:center;"><input type="checkbox" class="row-check" ${checked} onchange="toggleEntitySelect('${esc(m.name).replace(/'/g, "\\'")}', this.checked)"></td>
          <td class="strong" style="text-align:left;">${esc(m.name)}</td><td class="num" style="text-align:right;">${fmtNum(m.track_count)}</td>`;
      });

      const selectedHtml = state.resolvedEntities.length
        ? `<div class="notice success">Selected: <b>${state.resolvedEntities.map(esc).join("</b>, <b>")}</b></div>`
        : `<div class="notice info">Select at least one entity to continue.</div>`;

      // Custom table with explicit column alignment — show 10 visible rows with scroll
      const allSelected = matches.length > 0 && matches.every(m => state.resolvedEntities.includes(m.name));
      const selectAllChecked = allSelected ? "checked" : "";
      const tableHtml = `<div class="table-wrap" style="max-height:480px;overflow-y:auto;"><table style="table-layout:fixed;width:100%;">
        <colgroup>
          <col style="width:80px;">
          <col style="width:auto;">
          <col style="width:140px;">
        </colgroup>
        <thead style="position:sticky;top:0;background:#fff;z-index:1;"><tr>
          <th style="text-align:center;"><input type="checkbox" ${selectAllChecked} onchange="toggleSelectAll(this.checked)" title="Select All"></th>
          <th style="text-align:left;">Name</th>
          <th style="text-align:right;">Album Count</th>
        </tr></thead>
        <tbody>${rows.map(r => "<tr>" + r + "</tr>").join("")}</tbody>
      </table></div>`;

      return `
    ${tableHtml}
    ${selectedHtml}
  `;
    }
    function toggleEntitySelect(name, checked) {
      if (checked) {
        if (!state.resolvedEntities.includes(name)) state.resolvedEntities.push(name);
      } else {
        state.resolvedEntities = state.resolvedEntities.filter(n => n !== name);
      }
      renderKeepScroll();
    }
    function toggleSelectAll(checked) {
      const matches = getAmbiguityMatches();
      if (checked) {
        state.resolvedEntities = matches.map(m => m.name);
      } else {
        state.resolvedEntities = [];
      }
      renderKeepScroll();
    }

