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
    <div style={{ background: "#F1EFE7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 1020, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ marginTop: 8, marginBottom: 6, textAlign: "center", transform: 'translateY(-12px)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <img src="/sonymusic.png" alt="Sony Music" style={{ height: 36, width: 36, objectFit: "contain" }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.6, color: '#0f172a' }}>SONY MUSIC</span>
              <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>LATIN</span>
            </div>
          </div>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 23, padding: "60px 56px 56px", width: "140%", boxShadow: "0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #eef1f6", marginBottom: 4 }}>
          <h2 style={{ color: "#111827", fontSize: 32, fontWeight: 800, margin: "0 0 10px 0", textAlign: "center" }}>Welcome back!</h2>

          <div style={{ color: "#6b7280", fontSize: 16, marginBottom: 10, textAlign: "center" }}>
            {sessions.length > 1 ? `You have ${sessions.length} catalogues in progress` : "Pick up where you left off or start fresh"}
          </div>

          <div style={sessions.length > 2 ? { maxHeight: 390, overflowY: "auto", paddingRight: 6 } : undefined}>
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
              <div key={pending.session_id} style={{ background: "#f9fafb", borderRadius: 23, padding: 5, border: "2px solid #f0e7e5", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "0px 10px 0px" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", margin: "0 10px 14px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
                  <span>Overall progress</span>
                  <span>{currentStep} of {MAX_STEP} steps</span>
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 10px 0px", padding: "4px 0" }}>
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

          <div style={{ marginTop: 30, display: "flex", gap: 16, textAlign: "center" }}>
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
  );
}
