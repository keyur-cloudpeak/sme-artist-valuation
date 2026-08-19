    /* ---- SCREEN 3 : METADATA TO INCLUDE ---- */
    function renderScreen3() {
      // If pipeline is still running or failed, show pipeline status
      if (state.pipeline.status === "running" || state.pipeline.status === "failed") {
        return `
      ${renderPipelineProgress()}
    `;
      }

      const term = (state.metadataSearch || "").toLowerCase();
      const yearFilter3 = state.screen3YearFilter || [];
      const albums = DATA.albums || [];
      const allYears3 = [...new Set(albums.map(a => a.release_year).filter(y => y > 0))].sort((a, b) => b - a);
      const filteredAlbums = albums.filter(a => {
        if (yearFilter3.length > 0 && !yearFilter3.includes(a.release_year)) return false;
        if (!term) return true;
        const nameMatch = (a.album_name || "").toLowerCase().includes(term);
        const artistMatch = (a.display_artist || "").toLowerCase().includes(term);
        const isrcMatch = (a.isrc || "").toLowerCase().includes(term);
        return nameMatch || artistMatch || isrcMatch;
      });

      const albumRows = filteredAlbums.map(a => {
          const inc = !!state.includedAlbums[a.album_id];
          return `<td><input type="checkbox" data-album-id="${esc(a.album_id)}" class="row-check" ${inc ? "checked" : ""} onchange="toggleAlbumInclude('${a.album_id}', this.checked)"></td>
        <td class="strong">${esc(a.album_name)}</td><td>${esc(a.display_artist || '')}</td><td>${esc(a.release_type || '')}</td><td class="num">${a.release_year || '—'}</td>
        <td>${esc(a.product_format || '')}</td><td>${esc(a.imprint || '')}</td>`;
        });

      if (!albums.length) {
        return `
      <div class="notice info">No metadata available yet. Please complete Step 2 first.</div>
      ${navButtons(true)}
    `;
      }

      const allSelected = filteredAlbums.length > 0 && filteredAlbums.every(a => state.includedAlbums[a.album_id]);
      const selectAllChecked = allSelected ? "checked" : "";

      const tableHtml = `<div class="table-wrap" id="screen3-table" style="max-height:480px;overflow-y:auto;"><table style="table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:60px;">
            <col style="width:auto;">
            <col style="width:200px;">
            <col style="width:140px;">
            <col style="width:120px;">
            <col style="width:100px;">
            <col style="width:160px;">
          </colgroup>
          <thead style="position:sticky;top:0;background:#fff;z-index:1;"><tr>
            <th style="text-align:center;"><input type="checkbox" ${selectAllChecked} onchange="toggleSelectAllAlbums(this.checked)" title="Select All"></th>
            <th style="text-align:left;">Title</th>
            <th>Artist</th>
            <th>Release Type</th>
            <th class="num">Release Year</th>
            <th>Format</th>
            <th>Imprint</th>
          </tr></thead>
          <tbody>${albumRows.map(r => "<tr>" + r + "</tr>").join("")}</tbody>
        </table></div>`;

      return `
    <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
      <div class="field" style="margin:0; flex:1; max-width:400px;">
        <label class="field-label">Search by Album, Artist or ISRC</label>
        <input id="metadataSearchInput" type="text" placeholder="Type to filter..." value="${esc(state.metadataSearch)}" oninput="setMetadataSearch(this.value)" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);">
      </div>
      <div class="field" style="margin:0; max-width:180px;">
        <label class="field-label">Release Year</label>
        ${multiSelectYear("ms-year-s3", allYears3, yearFilter3, "toggleScreen3Year")}
      </div>
    </div>
      ${tableHtml}
      ${navButtons(false)}
    `;
    }
    function toggleAlbumInclude(id, val) { state.includedAlbums[id] = val; renderKeepScroll(); }
    function toggleSelectAllAlbums(checked) {
      var el = document.getElementById('screen3-table');
      if (!el) return;
      var inputs = Array.from(el.querySelectorAll('.row-check'));
      inputs.forEach(function(inp) {
        var id = inp.getAttribute('data-album-id');
        if (!id) return;
        state.includedAlbums[id] = checked;
      });
      renderKeepScroll();
    }
    function setMetadataSearch(v) { state.metadataSearch = v; renderKeepScroll(); }
    function toggleScreen3Year(year, checked) {
      if (year === 'all') {
        state.screen3YearFilter = [];
      } else {
        var arr = state.screen3YearFilter || [];
        if (checked) {
          if (!arr.includes(year)) arr.push(year);
        } else {
          arr = arr.filter(function(y) { return y !== year; });
        }
        state.screen3YearFilter = arr;
      }
      render();
    }

