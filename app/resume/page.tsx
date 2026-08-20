import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAX_STEP, MIN_STEP, STEP_LABELS } from "@/lib/config";

export default function ResumePage() {
  const store = cookies();
  const pendingRaw = store.get("wb_pending_resume")?.value;
  if (!pendingRaw) redirect("/");

  const pendingValue = JSON.parse(pendingRaw!);
  const sessions = (Array.isArray(pendingValue) ? pendingValue : [pendingValue]).filter(Boolean);

  const pillStyle: any = {
    completed: { background: "#16a34a", color: "#fff" },
    current: { background: "#dc2626", color: "#fff", boxShadow: "0 0 0 3px rgba(220,38,38,0.2)" },
    future: { background: "#eef1f6", color: "#9ca3af" },
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .resume-page { overflow-x: hidden; }
        .resume-page > div { box-sizing: border-box; max-width: 1400px !important; }
        .resume-topbar { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 0 18px; border-bottom: 1.5px solid #141210; }
        .resume-brand { display: flex; align-items: center; gap: 14px; flex: 0 0 220px; }
        .resume-brand-text { line-height: 1.2; display: flex; flex-direction: column; }
        .resume-brand-name { font-size: 13px; font-weight: 600; letter-spacing: 2.8px; color: #141210; padding-bottom: 5px; border-bottom: 1px solid #c9c5bb; margin-bottom: 4px; }
        .resume-brand-sub { font-size: 11px; font-weight: 600; letter-spacing: 2.8px; color: #141210; }
        .resume-topbar-center { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex: 1; margin: 0 20px; }
        .resume-topbar-title { font-weight: 800; font-size: 30px; line-height: 1.1; color: #c51616; }
        .resume-topbar-desc { color: #5a564c; font-size: 14px; line-height: 1.4; max-width: 925px; }
        .resume-topbar-actions { display: flex; align-items: center; justify-content: flex-end; gap: 14px; flex: 0 0 220px; }
        .resume-theme { display: flex; align-items: center; gap: 10px; color: #5a564c; font-size: 10px; letter-spacing: .08em; }
        .resume-theme-track { width: 43px; height: 24px; padding: 3px; border: 1px solid #bdb9af; border-radius: 20px; background: #dad7cc; }
        .resume-theme-thumb { display: block; width: 16px; height: 16px; margin-left: 17px; border-radius: 50%; background: #e1261c; }
        .resume-logout { height: 38px; padding: 0 22px; border: 1px solid #d0ccc3; border-radius: 10px; background: #fff; color: #141210; font-size: 13px; font-weight: 700; cursor: pointer; }
        .resume-panel { box-sizing: border-box; width: 100% !important; max-width: 1400px; }
        .resume-session-card, .resume-session-card * { box-sizing: border-box; }
        @media (max-width: 1100px) and (min-width: 701px) {
          .resume-page { padding: 24px 16px !important; }
          .resume-panel { padding: 44px 32px 36px !important; }
          .resume-session-header button { width: 34% !important; }
        }
        @media (max-width: 700px) {
          .resume-page { align-items: flex-start !important; padding: 20px 12px !important; }
          .resume-topbar { align-items: flex-start; flex-wrap: wrap; gap: 18px; padding-bottom: 14px; }
          .resume-brand { flex-basis: auto; }
          .resume-topbar-center { order: 3; flex-basis: 100%; margin: 0; }
          .resume-topbar-title { font-size: 22px; }
          .resume-topbar-desc { font-size: 12px; }
          .resume-topbar-actions { flex-basis: auto; margin-left: auto; }
          .resume-theme { display: none; }
          .resume-panel { width: 100% !important; padding: 34px 14px 24px !important; border-radius: 16px !important; }
          .resume-panel h2 { font-size: 26px !important; }
          .resume-session-list { max-height: 360px !important; overflow-y: auto !important; padding-right: 2px !important; }
          .resume-session-card { border-radius: 14px !important; padding: 8px !important; }
          .resume-session-header { flex-wrap: wrap !important; gap: 10px !important; margin: 0 4px !important; }
          .resume-session-header form { flex: 1 1 100% !important; width: 100% !important; margin: 0 0 6px !important; }
          .resume-session-header button { width: 100% !important; height: 40px !important; font-size: 13px !important; }
          .resume-progress-summary { margin: 8px 4px 10px !important; }
          .resume-progress-pills { margin: 0 4px !important; }
          .resume-actions { margin-top: 20px !important; }
          .resume-actions button { width: 100% !important; }
        }
      ` }} />
      <div className="resume-page" style={{ background: "#F1EFE7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 1020, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <header className="resume-topbar">
          <div className="resume-brand">
            <img src="/sonymusic.png" alt="Sony Music" height={42} width={42} style={{ objectFit: "contain" }} />
            <div className="resume-brand-text">
              <span className="resume-brand-name">SONY MUSIC</span>
              <span className="resume-brand-sub">LATIN</span>
            </div>
          </div>
          <div className="resume-topbar-center">
            <div className="resume-topbar-title">M&amp;A CATALOG VALUATION PLATFORM</div>
            <div className="resume-topbar-desc">An intelligent solution that identifies music catalogues, resolves artist and catalogue ambiguities, maps ownership and distribution territories, and generates decision-ready valuation insights.</div>
          </div>
          <div className="resume-topbar-actions">
            <div className="resume-theme" aria-label="Dark theme"><span>DARK</span><span className="resume-theme-track"><span className="resume-theme-thumb" /></span></div>
            <form action="/api/auth/logout" method="POST">
              <button className="resume-logout" type="submit">Logout</button>
            </form>
          </div>
        </header>
        <div style={{ height: 20 }}>
        </div>

        <div className="resume-panel" style={{ background: "#ffffff66", borderRadius: 23, padding: "60px 56px 56px", width: "140%", boxShadow: "0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #eef1f6", marginBottom: 4 }}>
          <h2 style={{ color: "#111827", fontSize: 32, fontWeight: 800, margin: "0 0 10px 0", textAlign: "center" }}>Welcome back!</h2>

          <div style={{ color: "#6b7280", fontSize: 16, marginBottom: 10, textAlign: "center" }}>
            {sessions.length > 1 ? `You have ${sessions.length} catalogues in progress` : "Pick up where you left off or start fresh"}
          </div>

          <div className="resume-session-list" style={sessions.length > 2 ? { maxHeight: 390, overflowY: "auto", paddingRight: 6 } : undefined}>
            {sessions.map((pending: any) => {
            const currentStep = pending.current_step || MIN_STEP;
            const stepData = pending.step_data || {};
            const artistName = (stepData.searchTerm as string) || "Catalogue";
            const initials = (artistName.split(/\s+/).slice(0, 2).map((word: string) => (word[0] || "").toUpperCase()).join("")) || "CA";
            const isReturning = currentStep > MIN_STEP || Object.keys(stepData).length > 0;
            const pills = STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const cls = stepNum < currentStep ? "completed" : stepNum === currentStep ? "current" : "future";
              return { cls, inner: `${stepNum} · ${label}`, key: stepNum };
            });

            return (
              <div className="resume-session-card" key={pending.session_id} style={{ background: "#f9fafb", borderRadius: 23, padding: 5, border: "2px solid #f0e7e5", marginBottom: 4 }}>
                <div className="resume-session-header" style={{ display: "flex", alignItems: "center", gap: 16, margin: "0px 10px 0px" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #e56eac 0%, #3b5de7 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{initials}</div>
                  <div>
                    <div style={{ color: "#111827", fontWeight: 600, fontSize: 18 }}>{artistName}</div>
                    <div style={{ color: "#6b7280", fontSize: 14, marginTop: 3 }}>Catalogue valuation {isReturning ? "in progress" : "ready"}</div>
                  </div>
                    <form action="/api/auth/resume" method="POST" style={{ margin: "0 10px 10px", flex: 1, display: "flex", justifyContent: "flex-end" }}>
                      <input type="hidden" name="action" value="continue" />
                      <input type="hidden" name="session_id" value={pending.session_id} />
                      <button type="submit" style={{ width: "26%", height: 30, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        Continue with {artistName}
                      </button>
                    </form>
                </div>
                <div className="resume-progress-summary" style={{ display: "flex", justifyContent: "space-between", margin: "0 10px 14px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
                  <span>Overall progress</span>
                  <span>{currentStep} of {MAX_STEP} steps</span>
                </div>
                <div className="resume-progress-pills" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 10px 0px", padding: "4px 0" }}>
                  {pills.map((p) => (
                    <span key={p.key} style={{ ...(pillStyle as any)[p.cls], padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {p.cls === "completed" ? `✓ ${p.inner}` : p.inner}
                    </span>
                  ))}
                </div>
              </div>
            );
            })}
          </div>

          <div className="resume-actions" style={{ marginTop: 30, display: "flex", gap: 16, textAlign: "center" }}>
            {sessions.length ? (
              <>
                <form action="/api/auth/resume" method="POST" style={{ flex: 1 }}>
                  <input type="hidden" name="action" value="start_new" />
                  <button type="submit" style={{ width: "40%", height: 40, background: "#3b5de7", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Start new
                  </button>
                </form>
              </>
            ) : (
              <form action="/api/auth/resume" method="POST" style={{ flex: 1 }}>
                <input type="hidden" name="action" value="start_new" />
                <button type="submit" style={{ width: "40%", height: 40, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Start new
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
