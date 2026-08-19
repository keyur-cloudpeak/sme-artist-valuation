import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAX_STEP, MIN_STEP, STEP_LABELS } from "@/lib/config";

export default function ResumePage() {
  const store = cookies();
  const pendingRaw = store.get("wb_pending_resume")?.value;
  if (!pendingRaw) redirect("/");

  const pending = JSON.parse(pendingRaw!);
  const currentStep: number = pending.current_step || MIN_STEP;
  const stepData = pending.step_data || {};
  const artistName: string = (stepData && stepData.searchTerm) || "Catalogue";
  const initials = artistName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join("") || "CA";
  const progressPct = Math.round(((currentStep - 1) / (MAX_STEP - 1)) * 100);
  const isReturning = currentStep > MIN_STEP || Object.keys(stepData).length > 0;
  const hasCatalogue = currentStep > MIN_STEP || !!(stepData.searchTerm && stepData.searchTerm.trim());

  const pills = STEP_LABELS.map((label, i) => {
    const stepNum = i + 1;
    let cls = "future";
    let inner = `${stepNum} \u00b7 ${label}`;
    if (stepNum < currentStep) {
      cls = "completed";
      inner = `\u2713 ${inner}`;
    } else if (stepNum === currentStep) {
      cls = "current";
    }
    return { cls, inner, key: stepNum };
  });

  const pillStyle: Record<string, React.CSSProperties> = {
    completed: { background: "#16a34a", color: "#fff" },
    current: { background: "#dc2626", color: "#fff", boxShadow: "0 0 0 3px rgba(220,38,38,0.2)" },
    future: { background: "#eef1f6", color: "#9ca3af" },
  };

  return (
    <div style={{ background: "#F1EFE7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif" }}>
      <div style={{ background: "#ffffff", borderRadius: 24, padding: "60px 56px 56px", width: "100%", maxWidth: 1020, boxShadow: "0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #eef1f6" }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/sonymusic.png" alt="Sony Music" style={{ height: 42, objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.5, color: '#111827' }}>SONY MUSIC</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>LATIN</span>
            </div>
          </div>
        </div>
        <h2 style={{ color: "#111827", fontSize: 32, fontWeight: 800, margin: "0 0 10px 0", textAlign: "center" }}>Welcome back!</h2>
        <div style={{ color: "#6b7280", fontSize: 16, marginBottom: 36, textAlign: "center" }}>Pick up where you left off or start fresh</div>

        <div style={{ background: "#f9fafb", borderRadius: 23, padding: 10, border: "2px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "10px 10px 24px" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #4f7cf7 0%, #3b5de7 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ color: "#111827", fontWeight: 600, fontSize: 18 }}>{artistName}</div>
              <div style={{ color: "#6b7280", fontSize: 14, marginTop: 3 }}>Catalogue valuation {isReturning ? "in progress" : "ready"}</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "0 10px 14px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
            <span>Overall progress</span>
            <span>{currentStep} of {MAX_STEP} steps</span>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 10px 20px", padding: "4px 0" }}>
            {pills.map((p) => (
              <span key={p.key} style={{ ...pillStyle[p.cls], padding: "8px 16px", borderRadius: 24, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                {p.inner}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 30, display: "flex", gap: 16 }}>
          {hasCatalogue ? (
            <>
              <form action="/api/auth/resume" method="POST" style={{ flex: 1 }}>
                <input type="hidden" name="action" value="continue" />
                <button type="submit" style={{ width: "100%", height: 48, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Continue where you left off
                </button>
              </form>
              <form action="/api/auth/resume" method="POST" style={{ flex: 1 }}>
                <input type="hidden" name="action" value="start_new" />
                <button type="submit" style={{ width: "100%", height: 48, background: "#3b5de7", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Start new
                </button>
              </form>
            </>
          ) : (
            <form action="/api/auth/resume" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="action" value="start_new" />
              <button type="submit" style={{ width: "100%", height: 48, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Start new
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
