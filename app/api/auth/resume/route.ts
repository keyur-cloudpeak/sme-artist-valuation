import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/snowflake";
import { abandonOpenSessions, createNewSession } from "@/lib/sessionManager";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = String(form.get("action") || "");

  const store = req.cookies;
  const email = store.get("wb_email")?.value || "";
  const pendingRaw = store.get("wb_pending_resume")?.value;
  const pending = pendingRaw ? JSON.parse(pendingRaw) : null;

  return withConnection(async (run) => {
    const res = NextResponse.redirect(new URL("/workbench", req.url), 303);
    res.cookies.delete("wb_pending_resume");

    if (action === "continue" && pending) {
      res.cookies.set("wb_session_id", pending.session_id, COOKIE_OPTS);
      res.cookies.set("wb_current_step", String(pending.current_step), COOKIE_OPTS);
    } else {
      if (email) await abandonOpenSessions(run, email);
      const newSession = await createNewSession(run, email);
      res.cookies.set("wb_session_id", newSession.session_id, COOKIE_OPTS);
      res.cookies.set("wb_current_step", String(newSession.current_step), COOKIE_OPTS);
    }

    return res;
  });
}
