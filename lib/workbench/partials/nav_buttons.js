
    function navButtons(nextDisabled) {
      const back = state.screen > 1 ? `<button class="btn secondary back-btn" onclick="showSpinnerAndGo(${state.screen - 1})">&larr; Back</button>` : `<span></span>`;
      let next = `<span></span>`;
      if (state.screen < 8) {
        const dis = nextDisabled ? ' disabled title="Please fill in the required field to continue"' : '';
        next = `<button class="btn"${dis} onclick="showSpinnerAndGo(${state.screen + 1})">Next &rarr;</button>`;
      }
      return `<div style="margin: 34px 0 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          ${back}<div class="spacer"></div>${next}
        </div>
      </div>`;
    }

    function getAmbiguityMatches() {
      // Dynamic only: return matches for the current search term from live query results
      if (state.searchTerm && DATA.ambiguity_matches[state.searchTerm]) {
        return DATA.ambiguity_matches[state.searchTerm];
      }
      return [];
    }

