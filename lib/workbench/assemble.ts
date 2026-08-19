// Assembles the full workbench HTML document from the static partials — port of the
// `_read_html` / `_logo_data_uri` / concatenation logic at the bottom of app.py.

import fs from "fs";
import path from "path";

const PARTIALS_DIR = path.join(process.cwd(), "lib", "workbench", "partials");

function readPartial(filename: string): string {
  return fs.readFileSync(path.join(PARTIALS_DIR, filename), "utf-8");
}

function logoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "sonymusic.png");
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "/sonymusic.png";
  }
}

export interface AssembleParams {
  injectedData: Record<string, any>;
  currentStep: number;
  catalogCreated: boolean;
  userEmail: string;
  sessionId: string;
  stepData?: Record<string, any>;
}

export function assembleWorkbenchHtml(params: AssembleParams): string {
  const { injectedData, currentStep, catalogCreated, userEmail, sessionId, stepData } = params;
  const dataJson = JSON.stringify(injectedData);

  const htmlParts = [
    // <head> with XLSX shim (contains <!DOCTYPE>, <html>, <head>, inline <script>)
    readPartial("head_xlsx_shim.html"),
    // Inject data into window BEFORE body_open reads it
    "<script>",
    `window.__INJECTED_DATA__ = ${dataJson};`,
    `window.__INITIAL_STEP__ = ${currentStep};`,
    `window.__CATALOG_CREATED__ = ${catalogCreated ? "true" : "false"};`,
    `window.__USER_EMAIL__ = ${JSON.stringify(userEmail)};`,
      `window.__SESSION_ID__ = ${JSON.stringify(sessionId)};`,
      `window.__STEP_DATA__ = ${JSON.stringify(stepData || {})};`,
      // client helper to persist checkpoints without a full navigation
      `window.__saveCheckpoint = function(step, stepData) { try { return fetch('/api/session/checkpoint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ step: step, stepData: stepData }) }).catch(function(){return null;}); } catch(e) { return null; } };`,
    "</script>",
    // CSS (already wrapped in <style>...</style>)
    readPartial("styles.html"),
    // Body open: header, nav, main container, footer, inline script reading DATA
    readPartial("body_open.html"),
    // JS partials: shared_js.js opens <script>, main_render.js closes </script>
    readPartial("shared_js.js"),
    readPartial("nav_buttons.js"),
    readPartial("step1_catalog.js"),
    readPartial("step2_ambiguity.js"),
    readPartial("step3_metadata.js"),
    readPartial("step4_territory.js"),
    readPartial("step5_analytics.js"),
    readPartial("step6_revenue.js"),
    readPartial("step7_albums.js"),
    readPartial("step8_export.js"),
    readPartial("main_render.js"),
    // Close body/html
    readPartial("body_close.html"),
  ];

  let htmlFull = htmlParts.join("\n");

  // Replace the logo file reference with an inline data URI so it renders inside the srcDoc iframe.
  htmlFull = htmlFull.replace('src="sonymusic.png"', `src="${logoDataUri()}"`);

  return htmlFull;
}
