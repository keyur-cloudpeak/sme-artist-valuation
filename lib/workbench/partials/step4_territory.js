    /* ---- SCREEN 4 : LOCAL TERRITORY MAPPING ---- */
    var _territoryDDOpen = false;
    function renderScreen4() {
      const allCountries = DATA.territories.countries;
      const regions = DATA.territories.regions;

      // Multi-select dropdown for territory selection
      const selectedTags = state.localTerritories.map(c =>
        `<span class="ms-tag"><span class="ms-tag-text">${esc(c)}</span><span class="ms-tag-remove" onclick="event.stopPropagation();removeTerritory('${esc(c)}')">&times;</span></span>`
      ).join("");

      const allSelected = state.localTerritories.length === allCountries.length;
      const optionItems = allCountries.map(c => {
        const sel = state.localTerritories.includes(c);
        return `<div class="ms-option ${sel ? 'ms-option-sel' : ''}" onclick="event.stopPropagation();toggleTerritory('${esc(c)}')"><span class="ms-checkbox ${sel ? 'ms-checkbox-checked' : ''}"></span>${esc(c)}</div>`;
      }).join("");

      const ddDisplay = _territoryDDOpen ? 'block' : 'none';

      const selector = `<div class="field" style="position:relative; z-index:100;"><label class="field-label">LOCAL TERRITORIES</label>
      <div class="ms-select-wrapper" id="msSelectWrapper">
        <div class="ms-select-control" onclick="toggleTerritoryDropdown()">
          <div class="ms-tags-area">${selectedTags || '<span class="ms-placeholder">Select territories...</span>'}</div>
          <div class="ms-arrow">${_territoryDDOpen ? '&#9650;' : '&#9660;'}</div>
        </div>
        <div class="ms-dropdown" id="msDropdown" style="display:${ddDisplay};">
          <div class="ms-option ms-option-all ${allSelected ? 'ms-option-sel' : ''}" onclick="event.stopPropagation();toggleAllTerritories()"><span class="ms-checkbox ${allSelected ? 'ms-checkbox-checked' : ''}"></span>All</div>
          <div class="ms-options-list" id="msOptionsList">${optionItems}</div>
        </div>
      </div></div>`;

      const rowCount = state.localTerritories.length;
      const rowRest = allCountries.length - rowCount;

      return `
    ${selector}
    <div class="grid grid-2" style="margin-top:6px; position:relative; z-index:1;">
      ${kpiCard("Local Territories Selected", rowCount)}
      ${kpiCard("Rest of World (ROW)", rowRest + " territories")}
    </div>
    <div style="margin-top: 24px; position:relative; z-index:1;">
      ${sectionTitle("Country Wise Output")}
      ${table(
        ["Country Name", "Consumption", "% of total", "Local Mapping", "Audio PPD's", "Video PPD's", "Local %", "Rest of the World %", "Local Audio PPD", "Local Video PPD", "RoW Audio PPD", "RoW Video PPD", "Total Audio PPD"],
        [
          `<td><strong>Worldwide</strong></td><td class="num">98,765,432</td><td class="num">100%</td><td>Worldwide</td><td class="num">0.004321</td><td class="num">0.001876</td><td class="num">-</td><td class="num">-</td><td class="num">0.003210</td><td class="num">0.001540</td><td class="num">0.001111</td><td class="num">0.000336</td><td class="num">0.004321</td>`,
          ...allCountries.map((c, i) => {
            const isLocal = state.localTerritories.includes(c);
            const cons = Math.floor(25000000 / (i + 1.2));
            const pct = Math.max(1, 22 - i) + "%";
            const audioPpd = (0.002000 + (Math.abs(Math.sin(i)) * 0.005)).toFixed(6);
            const videoPpd = (0.000800 + (Math.abs(Math.cos(i)) * 0.0015)).toFixed(6);
            const pctL = isLocal ? Math.floor(30 + Math.abs(Math.sin(i)) * 40) + "%" : "0%";
            const pctR = !isLocal ? Math.floor(10 + Math.abs(Math.cos(i)) * 50) + "%" : "0%";
            return `<td>${esc(c)}</td><td class="num">${fmtNum(cons)}</td><td class="num">${pct}</td><td style="color: ${isLocal ? 'var(--tag-green-text)' : 'var(--text-dim)'}">${isLocal ? "Local" : "RoW"}</td><td class="num">${audioPpd}</td><td class="num">${videoPpd}</td><td class="num">${pctL}</td><td class="num">${pctR}</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">-</td>`;
          })
        ],
        { scroll: true }
      )}
    </div>
    ${navButtons(false)}
  `;
    }
    function toggleTerritory(c) {
      const idx = state.localTerritories.indexOf(c);
      if (idx >= 0) state.localTerritories.splice(idx, 1); else state.localTerritories.push(c);
      _territoryDDOpen = true;
      render();
    }
    function removeTerritory(c) {
      const idx = state.localTerritories.indexOf(c);
      if (idx >= 0) state.localTerritories.splice(idx, 1);
      render();
    }
    function toggleAllTerritories() {
      const allCountries = DATA.territories.countries;
      if (state.localTerritories.length === allCountries.length) {
        state.localTerritories = [];
      } else {
        state.localTerritories = [...allCountries];
      }
      _territoryDDOpen = true;
      render();
    }
    function toggleTerritoryDropdown() {
      _territoryDDOpen = !_territoryDDOpen;
      const dd = document.getElementById('msDropdown');
      if (dd) dd.style.display = _territoryDDOpen ? 'block' : 'none';
    }
    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      const wrapper = document.getElementById('msSelectWrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        _territoryDDOpen = false;
        const dd = document.getElementById('msDropdown');
        if (dd) dd.style.display = 'none';
      }
    });

