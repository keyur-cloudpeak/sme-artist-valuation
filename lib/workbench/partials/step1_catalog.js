    /* ---- SCREEN 1 : CATALOG SELECTION ---- */
    function renderScreen1() {
      const mode = state.searchMode;
      let searchField = "";
      if (mode === "Artist") {
        const artistList = DATA.dropdown_results || [];
        const hasResults = artistList.length > 0 && !state._dropdownSelected;
        const hasInput = state.searchTerm && state.searchTerm.length >= 2;
        let listContent = '';
        if (hasResults) {
          listContent = artistList.map(a => `<div class="autocomplete-item" onmousedown="acSelect('searchTermSel','acListArtist','${esc(a).replace(/'/g, "\\'")}', 'Artist', dispatchSearchAndRender)"><span class="ac-icon">${esc(a)[0]}</span>${esc(a)}</div>`).join('');
        } else if (hasInput) {
          listContent = '<div class="ac-no-result">Press Enter to search</div>';
        } else {
          listContent = '<div class="ac-no-result">Type at least 2 characters, then press Enter</div>';
        }
        searchField = `<div class="field"><label class="field-label" style="text-align:left; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; font-size: 0.75rem; margin-bottom: 12px; color: var(--text-mute);">Artist Name</label>
      <div class="autocomplete-wrap" id="acWrapArtist">
        <input type="text" id="searchTermSel" value="${esc(state.searchTerm)}" placeholder="Type artist name and press Enter..." autocomplete="off"
          oninput="acInputChanged('searchTermSel')"
          onclick="acToggle('acListArtist')"
          onkeydown="acSearchOnEnter(event,'acListArtist','searchTermSel','Artist')"
          style="font-size:1.15rem; padding:14px; border-radius:12px;">
        <div class="autocomplete-list${hasResults ? ' open' : ''}" id="acListArtist">
          ${listContent}
        </div>
      </div>
    </div>`;
      } else if (mode === "Label") {
        const labelList = DATA.dropdown_results || [];
        const hasResults = labelList.length > 0 && !state._dropdownSelected;
        const hasInput = state.searchTerm && state.searchTerm.length >= 2;
        let listContent = '';
        if (hasResults) {
          listContent = labelList.map(a => `<div class="autocomplete-item" onmousedown="acSelect('searchTermSel','acListLabel','${esc(a).replace(/'/g, "\\'")}', 'Label', dispatchSearchAndRender)"><span class="ac-icon">${esc(a)[0]}</span>${esc(a)}</div>`).join('');
        } else if (hasInput) {
          listContent = '<div class="ac-no-result">Press Enter to search</div>';
        } else {
          listContent = '<div class="ac-no-result">Type at least 2 characters, then press Enter</div>';
        }
        searchField = `<div class="field"><label class="field-label" style="text-align:left; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; font-size: 0.75rem; margin-bottom: 12px; color: var(--text-mute);">Label Name</label>
      <div class="autocomplete-wrap" id="acWrapLabel">
        <input type="text" id="searchTermSel" value="${esc(state.searchTerm)}" placeholder="Type label name and press Enter..." autocomplete="off"
          oninput="acInputChanged('searchTermSel')"
          onclick="acToggle('acListLabel')"
          onkeydown="acSearchOnEnter(event,'acListLabel','searchTermSel','Label')"
          style="font-size:1.15rem; padding:14px; border-radius:12px;">
        <div class="autocomplete-list${hasResults ? ' open' : ''}" id="acListLabel">
          ${listContent}
        </div>
      </div>
    </div>`;
      } else {
        searchField = `<div class="field"><label class="field-label" style="text-align:left; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; font-size: 0.75rem; margin-bottom: 12px; color: var(--text-mute);">UPLOAD ISRC LIST (EXCEL / CSV)</label>
      <div class="upload-box" onclick="document.getElementById('isrcFile').click()" style="background: transparent;">
        ${state.uploadedFile ? "&#128190; " + esc(state.uploadedFile) : "<span style='font-size: 1.2rem; margin-bottom: 12px; display: inline-block;'>&#8593;</span><br>Click to choose a file, or drag one here"}
      </div>
      <input type="file" id="isrcFile" accept=".xlsx,.csv" style="display:none" onchange="onIsrcUpload(this)">
      <div class="hint" style="text-align: left; margin-top: 16px; font-size: 0.85rem; color: var(--text-mute);">Expected column: <b>ISRC</b> &mdash; one code per row.</div>
      ${state.uploadedFile ? `<div class="notice success" style="text-align: left;">Loaded file: <b>${esc(state.uploadedFile)}</b> (dummy parse &mdash; 214 ISRCs detected)</div>` : ""}
    </div>`;
      }

      // Next is allowed only when the user has provided a search value
      const screen1CanNext = mode === "ISRC List"
        ? !!state.uploadedFile
        : !!(state.searchTerm && state.searchTerm.trim());

      const objectives = [
        ["Catalog Acquisition", "Which albums & tracks belong to the deal?"],
        ["Revenue Analysis", "Current, Local, and ROW revenue"],
        ["Consumption Analysis", "Audio vs Video, Paid vs Ad Supported"],
        ["Corporate Valuation", "Inputs for the Corporate model"],
      ];

      return `
    <div style="border-radius: var(--radius-l); padding: 60px 40px; max-width: 800px; margin: 40px auto 60px auto; text-align: center; box-shadow: var(--shadow);">
      
      <div class="field" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 40px;">
        <label class="field-label" style="text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; font-size: 0.75rem; margin-bottom: 16px; color: var(--text-mute);">SEARCH BY</label>
        <div class="radio-row" id="searchModeRow" style="justify-content: center; gap: 12px;">
          ${["Artist", "Label", "ISRC List"].map(m => `<div class="radio-opt ${m === mode ? "sel" : ""}" onclick="setSearchMode('${m}')" style="font-size: 0.9rem; font-family: var(--font-sans); font-weight: 600; padding: 10px 24px; border-radius: 24px; ${m === mode ? 'background: var(--accent); border-color: var(--accent); color: #fff;' : 'background: transparent; border-color: var(--border-strong);'}">${m}</div>`).join("")}
        </div>
      </div>
      
      <div style="max-width: 520px; margin: 0 auto;">
        ${searchField}
      </div>
    </div>

    ${sectionTitle("Business Objective Checklist")}
    <div class="grid grid-4" style="margin-bottom: 40px;">
      ${objectives.map(([t, d]) => `<div class="card"><div class="kpi-label" style="text-transform: uppercase; letter-spacing: 0.05em;">${esc(t)}</div><div class="card-body-text" style="margin-top: 8px;">${esc(d)}</div></div>`).join("")}
    </div>

    ${navButtons(!screen1CanNext)}
  `;
    }
    function setSearchMode(m) { state.searchMode = m; state.uploadedFile = null; state.searchTerm = ""; render(); }
    function onIsrcUpload(el) {
      if (el.files && el.files[0]) {
        var file = el.files[0];
        state.uploadedFile = file.name;
        state.searchTerm = "ISRC upload: " + file.name;
        // Read file content and push as base64 to parent for Python processing
        var reader = new FileReader();
        reader.onload = function(evt) {
          var b64 = btoa(evt.target.result);
          try {
            var url = new URL(window.parent.location.href);
            url.searchParams.set('wb_isrc_file', b64);
            url.searchParams.set('wb_isrc_filename', file.name);
            url.searchParams.set('wb_search_mode', 'ISRC List');
            window.parent.history.replaceState(null, '', url.toString());
          } catch(e) {}
        };
        reader.readAsBinaryString(file);
        render();
      }
    }
    /* ---- CUSTOM AUTOCOMPLETE HELPERS ---- */

    // ── Debounce utility ──
    var _debounceTimers = {};
    function debounce(fn, key, ms) {
      ms = ms || 300;
      key = key || 'default';
      return function() {
        var args = arguments, ctx = this;
        clearTimeout(_debounceTimers[key]);
        _debounceTimers[key] = setTimeout(function() { fn.apply(ctx, args); }, ms);
      };
    }

    // Simple input handler: update state, persist, update button state
    function acInputChanged(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;
      state.searchTerm = input.value;
      state.resolvedEntities = [];
      state._dropdownSelected = false;
      try {
        localStorage.setItem("__wb_search_term", state.searchTerm || '');
        localStorage.setItem("__wb_search_mode", state.searchMode || 'Artist');
      } catch(e) {}
      const nextBtn = document.querySelector('.btn:not(.secondary)');
      if (nextBtn) {
        const canNext = !!(state.searchTerm && state.searchTerm.trim());
        nextBtn.disabled = !canNext;
        nextBtn.title = canNext ? '' : 'Please fill in the required field to continue';
      }
    }

    // On Enter key: trigger parent reload to run Luminate search
    function acSearchOnEnter(event, listId, inputId, mode) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const input = document.getElementById(inputId);
        if (!input || input.value.trim().length < 2) return;
        state.searchTerm = input.value;
        try {
          localStorage.setItem("__wb_search_term", state.searchTerm || '');
          localStorage.setItem("__wb_search_mode", state.searchMode || 'Artist');
        } catch(e) {}
        // Use replaceState + reload (same pattern as goToStep which works)
        try {
          var url = new URL(window.parent.location.href);
          url.searchParams.set('wb_dropdown_search', state.searchTerm);
          url.searchParams.set('wb_dropdown_mode', mode || 'Artist');
          url.searchParams.set('wb_search_term', state.searchTerm);
          url.searchParams.set('wb_search_mode', mode || 'Artist');
          url.searchParams.set('wb_step', '1');
          url.searchParams.set('wb_email', window.__USER_EMAIL__ || '');
          url.searchParams.set('wb_session_id', window.__SESSION_ID__ || '');
          window.parent.history.replaceState(null, '', url.toString());
          window.parent.location.reload();
        } catch(e) {
          // Cross-origin fallback
          try {
            localStorage.setItem('__wb_pending_dropdown_search', state.searchTerm);
          } catch(e2) {}
        }
        return;
      }
      // Arrow nav within dropdown results
      acKeyNav(event, listId, inputId, dispatchSearchAndRender);
    }

    // Push search params to the parent frame URL so Python can execute
    // the live Luminate query on the next rerun (when navigating to step 2).
    function pushSearchParamsToParent() {
      try {
        var url = new URL(window.parent.location.href);
        url.searchParams.set('wb_search_term', state.searchTerm || '');
        url.searchParams.set('wb_search_mode', state.searchMode || 'Artist');
        window.parent.history.replaceState(null, '', url.toString());
      } catch(e) {
        try {
          var url2 = new URL(window.top.location.href);
          url2.searchParams.set('wb_search_term', state.searchTerm || '');
          url2.searchParams.set('wb_search_mode', state.searchMode || 'Artist');
          window.top.history.replaceState(null, '', url2.toString());
        } catch(e2) {}
      }
    }

    // Debounced version that pushes search params to parent for live query
    var _debouncedLiveSearch = debounce(function() {
      pushSearchParamsToParent();
    }, 'liveSearch', 300);

    function dispatchSearch() {
      const sel = document.getElementById("searchTermSel");
      if (sel) state.searchTerm = sel.value;
      state.resolvedEntities = [];
      try {
        localStorage.setItem("__wb_search_term", state.searchTerm || '');
        localStorage.setItem("__wb_search_mode", state.searchMode || 'Artist');
      } catch(e) {}
      const nextBtn = document.querySelector('.btn:not(.secondary)');
      if (nextBtn) {
        const canNext = !!(state.searchTerm && state.searchTerm.trim());
        nextBtn.disabled = !canNext;
        nextBtn.title = canNext ? '' : 'Please fill in the required field to continue';
      }
    }

    function dispatchSearchAndRender() {
      dispatchSearch();
      _debouncedLiveSearch();
      renderKeepScroll();
    }

    function acOpen(listId) {
      const list = document.getElementById(listId);
      if (list) list.classList.add('open');
    }
    function acClose(listId) {
      const list = document.getElementById(listId);
      if (list) list.classList.remove('open');
    }
    function acToggle(listId) {
      const list = document.getElementById(listId);
      if (!list) return;
      if (list.classList.contains('open')) {
        list.classList.remove('open');  // 2nd click → close
      } else {
        list.classList.add('open');     // 1st click → open
      }
    }
    function acFilter(wrapId, listId, inputId, callback) {
      const input = document.getElementById(inputId);
      const list = document.getElementById(listId);
      if (!input || !list) return;
      const q = input.value.toLowerCase().trim();
      const items = list.querySelectorAll('.autocomplete-item');
      let anyVisible = false;
      items.forEach(item => {
        const text = item.textContent.trim().toLowerCase();
        const match = !q || text.includes(q);
        item.style.display = match ? 'flex' : 'none';
        if (match) anyVisible = true;
      });
      // show/hide no-result placeholder
      let noRes = list.querySelector('.ac-no-result');
      if (!anyVisible) {
        if (!noRes) { noRes = document.createElement('div'); noRes.className = 'ac-no-result'; list.appendChild(noRes); }
        noRes.textContent = 'No matches found';
        noRes.style.display = 'block';
      } else if (noRes) {
        noRes.style.display = 'none';
      }
      list.classList.add('open');
      if (callback) callback();
      // Debounced push to parent for live Luminate query
      _debouncedLiveSearch();
    }
    function acSelect(inputId, listId, value, mode, callback) {
      const input = document.getElementById(inputId);
      if (input) { input.value = value; }
      // Ensure the search mode matches the list the user selected from
      if (mode) state.searchMode = mode;
      state._dropdownSelected = true;
      acClose(listId);
      if (callback) callback();
    }
    function acKeyNav(event, listId, inputId, callback) {
      const list = document.getElementById(listId);
      if (!list || !list.classList.contains('open')) return;
      const items = [...list.querySelectorAll('.autocomplete-item')].filter(i => i.style.display !== 'none');
      const active = list.querySelector('.autocomplete-item.active');
      let idx = items.indexOf(active);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (active) active.classList.remove('active');
        idx = (idx + 1) % items.length;
        items[idx] && items[idx].classList.add('active');
        items[idx] && items[idx].scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (active) active.classList.remove('active');
        idx = (idx - 1 + items.length) % items.length;
        items[idx] && items[idx].classList.add('active');
        items[idx] && items[idx].scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter') {
        if (active) {
          event.preventDefault();
          const input = document.getElementById(inputId);
          if (input) input.value = active.textContent.trim();
          // Set searchMode based on the list the user selected from
          if (listId === 'acListLabel') state.searchMode = 'Label';
          else state.searchMode = 'Artist';
          acClose(listId);
          if (callback) callback();
        }
      } else if (event.key === 'Escape') {
        acClose(listId);
      }
    }
    // Close autocomplete when clicking outside
    document.addEventListener('click', function (e) {
      ['acListArtist', 'acListLabel'].forEach(id => {
        const list = document.getElementById(id);
        const wrap = list && list.closest('.autocomplete-wrap');
        if (list && wrap && !wrap.contains(e.target)) acClose(id);
      });
    });

