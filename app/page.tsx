import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function WelcomePage() {
  const store = cookies();
  const userEmail = store.get("wb_email")?.value;
  const pendingResume = store.get("wb_pending_resume")?.value;

  if (userEmail) {
    if (pendingResume) redirect("/resume");
    redirect("/workbench");
  }

  return (
    <div
      style={{
        margin: 0,
        background: "#F1EFE7",
        minHeight: "100vh",
        paddingTop: 75,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif",
      }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: -43, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'center', transform: 'translateY(-12px)' }}>
                <img src="/sonymusic.png" alt="Sony Music" style={{ height: 36, width: 36, objectFit: 'contain', display: 'block' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.6, color: '#0f172a' }}>SONY MUSIC</span>
                  <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>LATIN</span>
                </div>
              </div>
            </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: "48px 40px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}
          >
            
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: "#16a34a" }}>Welcome!</h1>
            <p style={{ lineHeight: 1.6, margin: "0 0 8px 0", color: "#1a1a2e" }}>
              To the <strong style={{ color: "#dc2626" }}>Sony Music M&amp;A Catalogue Valuation Platform</strong>.
            </p>
            <p style={{ lineHeight: 1.6, margin: 0, color: "#4b5563", opacity: 0.65 }}>
              Use this tool to explore catalogue data, run valuation scenarios, and analyse growth trends across the
              portfolio.
            </p>
          </div>

          <form action="/api/auth/login" method="POST" style={{ marginTop: 30 }}>
            <label
              htmlFor="email"
              style={{ display: "block", color: "#1a1a2e", fontSize: 14, fontWeight: 600, marginBottom: 8 }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@sonymusic.com"
              style={{
                width: "100%",
                boxSizing: "border-box",
                color: "#1a1a2e",
                background: "#ffffff",
                border: "2px solid #d1d5db",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              style={{
                marginTop: 30,
                width: "100%",
                background: "#3b5de7",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "14px 0",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Get Started
            </button>
          </form>
      </div>
    </div>
  );
}
