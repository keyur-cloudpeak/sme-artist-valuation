       MAIN RENDER / NAV / THEME / TICKER
       ============================================================ */

    const RENDERERS = [renderScreen1, renderScreen2, renderScreen3, renderScreen4, renderScreen5, renderScreen6, renderScreen7, renderScreen8];

    /* ---------- PIPELINE JOB MANAGEMENT ---------- */
    function startPipelineJob() {
      state.pipeline.status = "running";
      state.pipeline.progress = 0;
      state.pipeline.startedAt = Date.now();
      state.pipeline.errorMessage = null;
      state.pipeline.failedStep = null;
      // Persist pipeline state
      savePipelineState();
      render();
      // Save entities to checkpoint so Streamlit can create the table
      var stepData = {
        entities: state.resolvedEntities,
        searchMode: state.searchMode,
        searchTerm: state.searchTerm,
        create_table: true
      };
      try {
        localStorage.setItem("__wb_create_table", JSON.stringify(stepData));
      } catch(e) {}
      if (typeof window.__saveCheckpoint === "function") {
        window.__saveCheckpoint(3, stepData);
      }
      // If the backend already created the table, animate progress quickly to 100%
      if (window.__CATALOG_CREATED__) {
        var quickProgress = 0;
        window.__pipelineTimer = setInterval(function() {
          quickProgress += 10;
          state.pipeline.progress = Math.min(100, quickProgress);
          savePipelineState();
          render();
          if (quickProgress >= 100) {
            clearInterval(window.__pipelineTimer);
            completePipeline();
          }
        }, 300);
        return;
      }
      // Start polling progress
      pollPipelineProgress();
    }

    function savePipelineState() {
      try {
        localStorage.setItem("__wb_pipeline", JSON.stringify({
          status: state.pipeline.status,
          progress: state.pipeline.progress,
          startedAt: state.pipeline.startedAt,
          errorMessage: state.pipeline.errorMessage,
          retryCount: state.pipeline.retryCount,
          failedStep: state.pipeline.failedStep,
        }));
      } catch(e) {}
    }

    function restorePipelineState() {
      try {
        var saved = localStorage.getItem("__wb_pipeline");
        if (saved) {
          var p = JSON.parse(saved);
          state.pipeline.status = p.status || "idle";
          state.pipeline.progress = p.progress || 0;
          state.pipeline.startedAt = p.startedAt || null;
          state.pipeline.errorMessage = p.errorMessage || null;
          state.pipeline.retryCount = p.retryCount || 0;
          state.pipeline.failedStep = p.failedStep || null;
          // If was running but backend already created the table, animate to 100%
          if (state.pipeline.status === "running" && window.__CATALOG_CREATED__) {
            var startPct = state.pipeline.progress || 0;
            var animProgress = startPct;
            render();
            var animTimer = setInterval(function() {
              animProgress += 5;
              state.pipeline.progress = Math.min(100, animProgress);
              savePipelineState();
              render();
              if (animProgress >= 100) {
                clearInterval(animTimer);
                completePipeline();
              }
            }, 200);
            return;
          }
          // If was running, resume polling
          if (state.pipeline.status === "running") {
            pollPipelineProgress();
          }
        }
      } catch(e) {}
    }

    function pollPipelineProgress() {
      if (state.pipeline.status !== "running") return;
      // Clear any existing timer to prevent stacking intervals
      if (window.__pipelineTimer) clearInterval(window.__pipelineTimer);
      window.__pipelineTimer = setInterval(function() {
        if (state.pipeline.status !== "running") {
          clearInterval(window.__pipelineTimer);
          return;
        }
        // Check if backend has completed the table creation
        if (window.__CATALOG_CREATED__) {
          completePipeline();
          return;
        }
        var elapsed = Date.now() - state.pipeline.startedAt;
        // Timeout: kill session if running longer than 60 minutes
        if (elapsed > 60 * 60 * 1000) {
          failPipeline("The process took more than the allowed time so the session has been killed.", state.pipeline.failedStep || 2);
          return;
        }
        var estimatedMs = state.pipeline.estimatedMinutes * 60 * 1000;
        var pct = Math.min(95, Math.round((elapsed / estimatedMs) * 95));
        state.pipeline.progress = pct;
        savePipelineState();
        render();
        // Broadcast progress to Streamlit for backend coordination
        try {
          var ch = new BroadcastChannel("wb_pipeline_sync");
          ch.postMessage({ type: "pipeline_progress", progress: pct, status: state.pipeline.status });
          ch.close();
        } catch(e) {}
      }, 3000);
    }

    function completePipeline() {
      state.pipeline.status = "completed";
      state.pipeline.progress = 100;
      clearInterval(window.__pipelineTimer);
      savePipelineState();
      render();
    }

    function failPipeline(errorMsg, failedStep) {
      state.pipeline.status = "failed";
      state.pipeline.errorMessage = errorMsg || "An unexpected error occurred while processing.";
      state.pipeline.failedStep = failedStep || 2;
      clearInterval(window.__pipelineTimer);
      savePipelineState();
      render();
    }

    function retryPipeline() {
      if (state.pipeline.retryCount >= state.pipeline.maxRetries) {
        // Max retries exceeded — show contact support
        state.pipeline.status = "failed";
        state.pipeline.errorMessage = "Maximum retry attempts exceeded. Please contact the Support team for assistance.";
        savePipelineState();
        render();
        return;
      }
      state.pipeline.retryCount++;
      // Go back to the failed step
      var targetStep = state.pipeline.failedStep || 2;
      state.pipeline.status = "idle";
      state.pipeline.progress = 0;
      state.pipeline.errorMessage = null;
      state.pipeline.failedStep = null;
      savePipelineState();
      state.screen = targetStep;
      render();
    }

    function resetPipeline() {
      state.pipeline.status = "idle";
      state.pipeline.progress = 0;
      state.pipeline.startedAt = null;
      state.pipeline.errorMessage = null;
      state.pipeline.retryCount = 0;
      state.pipeline.failedStep = null;
      clearInterval(window.__pipelineTimer);
      savePipelineState();
    }

    function cancelPipeline() {
      resetPipeline();
      try {
        localStorage.removeItem("__wb_create_table");
      } catch(e) {}
      try {
        if (typeof window.__saveCheckpoint === "function") {
          window.__saveCheckpoint(2, {
            entities: state.resolvedEntities,
            searchMode: state.searchMode,
            searchTerm: state.searchTerm,
          });
        }
      } catch(e) {}
      state.screen = 2;
      render();
    }

    function startNewValuation() {
      // Clear all localStorage state
      try {
        localStorage.removeItem("__wb_completed_steps");
        localStorage.removeItem("__wb_current_step");
        localStorage.removeItem("__wb_visited_steps");
        localStorage.removeItem("__wb_search_term");
        localStorage.removeItem("__wb_search_mode");
        localStorage.removeItem("__wb_resolved_entities");
        localStorage.removeItem("__wb_pipeline");
        localStorage.removeItem("__wb_create_table");
        localStorage.removeItem("__wb_pending_step");
      } catch(e) {}
      // Reset local state immediately
      state.screen = 1;
      state.searchTerm = '';
      state.resolvedEntity = '';
      state.resolvedEntities = [];
      state.completedSteps = new Set();
      state.pipeline.status = 'idle';
      state.pipeline.progress = 0;
      // Signal Streamlit to reset session state and start fresh at step 1
      try {
        var url = new URL(window.parent.location.href);
        // Remove ALL query params (not just wb_ prefixed)
        var allKeys = [];
        url.searchParams.forEach(function(v, k) { allKeys.push(k); });
        allKeys.forEach(function(k) { url.searchParams.delete(k); });
        // Add only the reset flag
        url.searchParams.set('wb_reset', '1');
        window.parent.history.replaceState(null, '', url.toString());
        window.parent.location.reload();
      } catch(e) {
        window.parent.location.reload();
      }
    }
    function contactSupport() {
      // Open support modal or show info
      var subject = encodeURIComponent("M&A Workbench - Pipeline Error");
      var body = encodeURIComponent(
        "Hi Support Team,\n\n" +
        "I'm experiencing a persistent error in the M&A Catalog Valuation Workbench.\n\n" +
        "Error: " + (state.pipeline.errorMessage || "Unknown") + "\n" +
        "Step: " + (state.pipeline.failedStep || "N/A") + "\n" +
        "Retry attempts: " + state.pipeline.retryCount + "\n" +
        "Entities selected: " + state.resolvedEntities.join(", ") + "\n\n" +
        "Please help resolve this issue.\n\nThank you."
      );
      window.open("mailto:ma-workbench-support@sonymusic.com?subject=" + subject + "&body=" + body, "_blank");
    }

    function logoutUser() {
      try {
        // Clear local storage keys used by the workbench
        localStorage.removeItem("__wb_completed_steps");
        localStorage.removeItem("__wb_current_step");
        localStorage.removeItem("__wb_visited_steps");
        localStorage.removeItem("__wb_search_term");
        localStorage.removeItem("__wb_search_mode");
        localStorage.removeItem("__wb_resolved_entities");
        localStorage.removeItem("__wb_pipeline");
        localStorage.removeItem("__wb_create_table");
        localStorage.removeItem("__wb_pending_step");
      } catch(e) {}

      try {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
          .catch(function() {})
          .finally(function() {
            try { window.parent.location.href = '/'; } catch(e) { window.location.href = '/'; }
          });
      } catch(e) {
        try { window.parent.location.href = '/'; } catch(e) { window.location.href = '/'; }
      }
    }

    // Listen for pipeline status updates from Streamlit backend
    try {
      var pipelineCh = new BroadcastChannel("wb_pipeline_sync");
      pipelineCh.onmessage = function(event) {
        var d = event.data;
        if (d.type === "pipeline_complete") {
          completePipeline();
        } else if (d.type === "pipeline_failed") {
          failPipeline(d.error || "Pipeline execution failed.", d.failedStep || 2);
        } else if (d.type === "pipeline_progress_update") {
          state.pipeline.progress = d.progress || state.pipeline.progress;
          savePipelineState();
          render();
        }
      };
    } catch(e) {}

    /* ---------- PIPELINE PROGRESS UI RENDERER ---------- */
    function renderPipelineProgress() {
      var p = state.pipeline;
      if (p.status === "running") {
        var elapsed = p.startedAt ? Math.round((Date.now() - p.startedAt) / 60000) : 0;
        // Compute remaining from actual progress rate (elapsed / pct), not fixed countdown
        var remaining = 0;
        if (p.progress > 0 && p.progress < 100) {
          var totalEstMs = (Date.now() - p.startedAt) / (p.progress / 100);
          remaining = Math.max(0, Math.round((totalEstMs - (Date.now() - p.startedAt)) / 60000));
        }
        return `
      <div class="pipeline-overlay">
        <div class="pipeline-card">
          <div class="pipeline-icon">&#9881;</div>
          <div class="pipeline-title">Building Catalog Table</div>
          <div class="pipeline-subtitle">Creating table with selected artists, labels, and ISRC codes.<br>This process typically takes a minutes.</div>
          <div class="progress-label">Progress</div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill animated" style="width: ${p.progress}%"></div>
          </div>
          <div class="progress-pct">${p.progress}%</div>
          <div class="pipeline-elapsed">
            Elapsed: ${elapsed} min &nbsp;|&nbsp; Est. remaining: ~${remaining} min
          </div>
          <div class="pipeline-actions">
            <button class="btn-back" onclick="cancelPipeline()" style="background:var(--accent);border:1px solid var(--accent-2);color:#fff;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:0.9rem;">Cancel</button>
          </div>
          <div style="margin-top:16px;font-size:0.82rem;color:var(--text-mute)">
            You can close this page and check back later. Progress is saved automatically.
          </div>
        </div>
      </div>`;
      } else if (p.status === "failed") {
        var canRetry = p.retryCount < p.maxRetries;
        var retryBtn = canRetry
          ? `<button class="btn-retry" onclick="retryPipeline()">&#8635; Retry from Step ${p.failedStep || 2}</button>`
          : '';
        var supportMsg = !canRetry
          ? `<div style="margin-top:12px;font-size:0.85rem;color:var(--text-dim);">All retry attempts exhausted. Please contact the Support team.</div>`
          : `<div style="margin-top:12px;font-size:0.82rem;color:var(--text-mute);">Retries used: ${p.retryCount} of ${p.maxRetries}</div>`;
        return `
      <div class="pipeline-overlay">
        <div class="pipeline-card">
          <div class="pipeline-icon" style="color:var(--accent)">&#9888;</div>
          <div class="pipeline-title">Pipeline Failed</div>
          <div class="pipeline-subtitle">An error occurred while building the catalog table.</div>
          <div class="pipeline-error">
            <div class="pipeline-error-title">Error Details</div>
            <div class="pipeline-error-msg">${esc(p.errorMessage || "Unknown error")}</div>
          </div>
          ${supportMsg}
          <div class="pipeline-actions">
            <button class="btn-back" onclick="pipelineGoBack()" style="background:transparent;border:1px solid var(--border);color:var(--text);padding:10px 24px;border-radius:8px;cursor:pointer;font-size:0.9rem;">&larr; Back</button>
            <button class="btn-back" onclick="cancelPipeline()" style="background:transparent;border:1px solid var(--border);color:var(--text);padding:10px 24px;border-radius:8px;cursor:pointer;font-size:0.9rem;">Cancel</button>
            ${retryBtn}
            <button class="btn-support" onclick="contactSupport()">&#9993; Contact Support</button>
          </div>
        </div>
      </div>`;
      } else if (p.status === "completed") {
        return `
      <div class="pipeline-overlay">
        <div class="pipeline-card">
          <div class="pipeline-icon" style="color:var(--green)">&#10003;</div>
          <div class="pipeline-success-badge">Table Created Successfully</div>
          <div class="pipeline-title">Ready to Continue</div>
          <div class="pipeline-subtitle">The catalog table has been built. Click Next to proceed to metadata selection.</div>
          <div style="margin-top:20px;"><button class="btn" onclick="pipelineProceedToStep3()">Next &rarr;</button></div>
        </div>
      </div>`;
      }
      return "";
    }

    function pipelineGoBack() {
      cancelPipeline();
      state.screen = 1;
      render();
    }

    function pipelineProceedToStep3() {
      state.pipeline.status = "idle";
      state.pipeline._skipTrigger = true;
      savePipelineState();
      goScreen(3);
    }

    function goScreen(n) {
      var prev = state.screen;
      // Intercept step 1 → 2: push search params to parent URL for Luminate query
      if (prev === 1 && n === 2) {
        if (typeof pushSearchParamsToParent === "function") pushSearchParamsToParent();
      }
      // Intercept step 2 → 3: trigger pipeline job (skip if pipeline already ran)
      if (prev === 2 && n === 3 && !state.pipeline._skipTrigger && state.pipeline.status !== "completed" && state.pipeline.status !== "running") {
        // Start pipeline UI immediately
        startPipelineJob();
        // Reload page with wb_create_table=1 so Python creates the table during progress bar
        try {
          var url = new URL(window.parent.location.href);
          url.searchParams.set('wb_step', '2');
          url.searchParams.set('wb_create_table', '1');
          url.searchParams.set('wb_email', window.__USER_EMAIL__ || '');
          url.searchParams.set('wb_session_id', window.__SESSION_ID__ || '');
          url.searchParams.set('wb_step_data', JSON.stringify({
            step2_confirmed: true,
            confirmed_mrelg_ids: state.resolvedEntities,
            entity_name: state.searchTerm || 'catalog',
            search_mode: state.searchMode,
            searchTerm: state.searchTerm || '',
            searchMode: state.searchMode || 'Artist'
          }));
          // Best-effort: attempt to persist checkpoint via API before reload
          try { if (typeof window.__saveCheckpoint === 'function') window.__saveCheckpoint(2, {
            step2_confirmed: true,
            confirmed_mrelg_ids: state.resolvedEntities,
            entity_name: state.searchTerm || 'catalog',
            search_mode: state.searchMode,
            searchTerm: state.searchTerm || '',
            searchMode: state.searchMode || 'Artist'
          }); } catch(e) {}
          window.parent.history.replaceState(null, '', url.toString());
          window.parent.location.reload();
        } catch(e) {}
        return; // Don't navigate yet
      }
      // Clear skip flag after pipeline intercept check
      state.pipeline._skipTrigger = false;
      // If navigating to step 3 and pipeline completed, allow it and reset
      if (n === 3 && state.pipeline.status === "completed") {
        resetPipeline();
      }
      state.screen = Math.max(1, Math.min(8, n));
      // Mark all steps before the new screen as completed
      state.completedSteps = new Set();
      for (var i = 1; i < state.screen; i++) {
        state.completedSteps.add(i);
      }
      // Persist to localStorage FIRST (before any reload)
      try {
        localStorage.setItem("__wb_completed_steps", JSON.stringify(Array.from(state.completedSteps)));
        localStorage.setItem("__wb_current_step", String(state.screen));
        localStorage.setItem("__wb_search_term", state.searchTerm || '');
        localStorage.setItem("__wb_search_mode", state.searchMode || 'Artist');
        localStorage.setItem("__wb_resolved_entities", JSON.stringify(state.resolvedEntities || []));
        var visited = JSON.parse(localStorage.getItem("__wb_visited_steps") || "[]");
        if (visited.indexOf(state.screen) === -1) visited.push(state.screen);
        localStorage.setItem("__wb_visited_steps", JSON.stringify(visited));
      } catch(e) {}
      render();
      // Push wb_step to parent query params and reload to trigger Streamlit DB save
      try {
        var url = new URL(window.parent.location.href);
        // Get searchTerm from state OR localStorage (in case state was cleared)
        var _searchTerm = state.searchTerm || localStorage.getItem("__wb_search_term") || '';
        var _searchMode = state.searchMode || localStorage.getItem("__wb_search_mode") || 'Artist';
        var _entities = state.resolvedEntities && state.resolvedEntities.length
          ? state.resolvedEntities
          : JSON.parse(localStorage.getItem("__wb_resolved_entities") || '[]');
        url.searchParams.set('wb_step', String(state.screen));
        url.searchParams.set('wb_email', window.__USER_EMAIL__ || '');
        url.searchParams.set('wb_session_id', window.__SESSION_ID__ || '');
        url.searchParams.set('wb_step_data', JSON.stringify({
          currentStep: state.screen,
          searchTerm: _searchTerm,
          searchMode: _searchMode,
          resolvedEntities: _entities,
          completedSteps: Array.from(state.completedSteps)
        }));
        // Best-effort: persist checkpoint via API before triggering reload
        try { if (typeof window.__saveCheckpoint === 'function') window.__saveCheckpoint(state.screen, {
          currentStep: state.screen,
          searchTerm: _searchTerm,
          searchMode: _searchMode,
          resolvedEntities: _entities,
          completedSteps: Array.from(state.completedSteps)
        }); } catch(e) {}
        // replaceState sets params, then reload triggers Streamlit to read them
        window.parent.history.replaceState(null, '', url.toString());
        window.parent.location.reload();
      } catch(e) {
        // Cross-origin fallback: store in localStorage for next natural rerun
        try {
          localStorage.setItem('__wb_pending_step', JSON.stringify({
            step: state.screen,
            step_data: {
              currentStep: state.screen,
              searchTerm: state.searchTerm || '',
              searchMode: state.searchMode || '',
              resolvedEntities: state.resolvedEntities || [],
              completedSteps: Array.from(state.completedSteps)
            }
          }));
        } catch(e2) {}
      }
    }

    function renderTabbar() {

      const moveResume = state.screen === 1
        ? `<form action="/api/auth/resume" method="POST" target="_top" style="margin:0 10px 0 0; flex:0 0 auto;"><input type="hidden" name="action" value="move_resume" /><button class="btn secondary" type="submit">Back To Welcome</button></form>`
        : "";
      const html = SCREENS.map(s => {
        const active = s.n === state.screen;
        const completed = state.completedSteps.has(s.n) && !active;
        const cls = `tab-pill${active ? " active" : ""}${completed ? " completed" : ""}`;
        const check = completed ? `<span class="check-icon">&#10003;</span>` : "";
        return `<span class="${cls}" style="--pill-c:${s.color}; cursor: default; pointer-events: none;">
      ${check}${s.n} &middot; ${s.label}
    </span>`;
      }).join("");
      $("#tabbar").innerHTML = moveResume + html;
    }

    function renderMeta() {
      // Entity chip removed from UI.
    }

    const SCREEN_TITLES = [
      { label: "Select Catalog", caption: "Identify the catalog to be evaluated by artist, label, or an uploaded ISRC list." },
      { label: "Resolve Ambiguity", caption: "Select one or more catalog entities. Near-duplicate names must not be merged silently." },
      { label: "Metadata to Include", caption: "Select which albums / tracks / labels flow into the valuation." },
      { label: "Local Territory Selection", caption: "Required input — drives PPD calculations, revenue allocation, and Corporate outputs." },
      { label: "Catalog Analytics", caption: "Consumption split by content type and monetization model, with catalog age and market benchmark KPIs." },
      { label: "Release-Year Analysis & Revenue Conversion", caption: "Consumption, revenue, and growth by release-year bucket, plus PPD-based revenue conversion and Local/ROW output." },
      { label: "Album Analysis", caption: "Albums, release year, track count, total consumption (by release year bucket), and current revenue for the resolved catalog." },
      { label: "Corporate Export", caption: "Standardized summary tables and Corporate-model inputs, ready for the Corporate Excel process." },
    ];

    function showSpinnerAndGo(n) {
      try {
        var existing = document.getElementById('__wb_spinner');
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.id = '__wb_spinner';
        el.style.position = 'fixed';
        el.style.left = '0';
        el.style.top = '0';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.background = 'rgba(220,38,38,0.06)';
        el.style.zIndex = '9999';
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;"><div style="width:40px;height:40px;border:4px solid #dc2626;border-top-color:transparent;border-radius:50%;animation:wb-spin 1s linear infinite;"></div></div>';
        var st = document.createElement('style');
        st.id = '__wb_spinner_styles';
        st.innerHTML = '@keyframes wb-spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
        document.body.appendChild(el);
        // show for a short period then navigate
        setTimeout(function() {
          try { goScreen(n); } catch(e) { }
          setTimeout(function() {
            try { var s = document.getElementById('__wb_spinner'); if (s) s.remove(); var ss = document.getElementById('__wb_spinner_styles'); if (ss) ss.remove(); } catch(e) {}
          }, 2000);
        }, 1200);
      } catch(e) {
        try { goScreen(n); } catch(e2) {}
      }
    }

    function renderTopNav() {
      const pipelineBusy = state.screen === 2 && (state.pipeline.status === "running" || state.pipeline.status === "failed" || state.pipeline.status === "completed");
      const back = state.screen > 1 && !pipelineBusy ? `<button class="btn secondary back-btn" onclick="showSpinnerAndGo(${state.screen - 1})">&larr; Back</button>` : `<span></span>`;
      let nextDisabled = false;
      if (state.screen === 1) {
        const mode = state.searchMode;
        nextDisabled = mode === "ISRC List" ? !state.uploadedFile : !(state.searchTerm && state.searchTerm.trim());
      }
      const dis = nextDisabled ? ' disabled title="Please fill in the required field to continue"' : '';
      const next = state.screen < 8 && !pipelineBusy ? `<button class="btn"${dis} onclick="showSpinnerAndGo(${state.screen + 1})">Next &rarr;</button>` : `<span></span>`;
      const t = SCREEN_TITLES[state.screen - 1];
      const centerHtml = `<div style="text-align:center; flex:1; min-width:0;">
        
        <div class="section-title" style="text-align:center; margin-bottom:2px; padding-left:0; margin-top:0;">${esc(t.label)}</div>
        <div class="section-caption" style="text-align:center; margin-bottom:4px; padding-left:0; font-family:var(--font-serif); font-size:0.8rem; font-weight:200; color:var(--text-main); letter-spacing:-0.01em;">${esc(t.caption)}</div>
      </div>`;
      $("#topNav").innerHTML = `<div style="flex:0 0 120px;display:flex;align-items:center;">${back}</div>${centerHtml}<div style="flex:0 0 120px;display:flex;align-items:center;justify-content:flex-end;">${next}</div>`;
    }

    function render() {
      renderTabbar();
      renderTopNav();
      renderMeta();
      $("#screenRoot").innerHTML = RENDERERS[state.screen - 1]();
    }

    /* Re-render without losing scroll position (used for slider/number inputs) */
    function renderKeepScroll() {
      const y = window.scrollY;
      const activeEl = document.activeElement;
      let activeId = null;
      let sStart = null;
      let sEnd = null;
      if (activeEl && activeEl.id && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeId = activeEl.id;
        try {
          sStart = activeEl.selectionStart;
          sEnd = activeEl.selectionEnd;
        } catch (e) { }
      }

      render();
      window.scrollTo(0, y);

      if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
          el.focus();
          if (sStart !== null && sEnd !== null) {
            try { el.setSelectionRange(sStart, sEnd); } catch (e) { }
          }
        }
      }
    }

    /* ---- Theme toggle ---- */
    function setTheme(t) {
      state.theme = t;
      document.documentElement.setAttribute("data-theme", t);
      // Label shows the mode you will switch TO on next click
      $("#themeLabel").textContent = t === "dark" ? "LIGHT" : "DARK";
      localStorage.setItem("wb_theme", t);
    }
    $("#themeToggle").addEventListener("click", () => {
      setTheme(state.theme === "dark" ? "light" : "dark");
    });

    /* ---- Init ---- */
    // Restore saved screen from Streamlit-injected value
    const __initialStep = window.__INITIAL_STEP__ || 1;
    if (__initialStep > 1 && __initialStep <= 8) {
      state.screen = __initialStep;
    }
    // Restore completed steps from localStorage, and mark all steps before current as completed
    try {
      if (__initialStep > 1) {
        var saved = JSON.parse(localStorage.getItem("__wb_completed_steps") || "[]");
        saved.forEach(function(s) { state.completedSteps.add(s); });
      } else {
        localStorage.removeItem("__wb_completed_steps");
      }
    } catch(e) {}
    for (var i = 1; i < state.screen; i++) { state.completedSteps.add(i); }
    try { localStorage.setItem("__wb_completed_steps", JSON.stringify(Array.from(state.completedSteps))); } catch(e) {}
    // Restore searchTerm, searchMode, resolvedEntities from injected stepData or localStorage
    try {
      var sd = window.__STEP_DATA__ || {};
      var savedTerm = sd.searchTerm || localStorage.getItem("__wb_search_term");
      if (savedTerm) state.searchTerm = savedTerm;
      
      var savedMode = sd.searchMode || localStorage.getItem("__wb_search_mode");
      if (savedMode) state.searchMode = savedMode;
      
      var savedEntities = sd.resolvedEntities || sd.confirmed_mrelg_ids;
      if (savedEntities && Array.isArray(savedEntities)) {
        state.resolvedEntities = savedEntities;
      } else {
        var localEntities = localStorage.getItem("__wb_resolved_entities");
        if (localEntities) state.resolvedEntities = JSON.parse(localEntities);
      }
    } catch(e) {}
    // Persist initial step to localStorage (current + visited)
    try {
      localStorage.setItem("__wb_current_step", String(state.screen));
      var visited = JSON.parse(localStorage.getItem("__wb_visited_steps") || "[]");
      if (visited.indexOf(state.screen) === -1) visited.push(state.screen);
      localStorage.setItem("__wb_visited_steps", JSON.stringify(visited));
    } catch(e) {}
    // Restore saved preference; fall back to "light" (the default)
    const savedTheme = localStorage.getItem("wb_theme") || "light";
    state.theme = savedTheme;
    setTheme(savedTheme);
    // Restore pipeline state (so progress bar shows when user returns)
    restorePipelineState();
    render();

    /* ---------- Auto-fit iframe height ----------
       Removed the Streamlit-specific auto-resize logic because in Next.js, 
       the iframe is set to 100vh and scrolling happens naturally inside it. 
       This prevents the infinite height-expansion loop. */
  </script>
