import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/snowflake";
import { createNewSession } from "@/lib/sessionManager";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = String(form.get("action") || "");

  const store = req.cookies;
  const email = store.get("wb_email")?.value || "";
  const pendingRaw = store.get("wb_pending_resume")?.value;
  const pendingValue = pendingRaw ? JSON.parse(pendingRaw) : null;
  const pendingSessions = Array.isArray(pendingValue) ? pendingValue : pendingValue ? [pendingValue] : [];
  const selectedSessionId = String(form.get("session_id") || "");
  const pending = pendingSessions.find((session: any) => session.session_id === selectedSessionId) || pendingSessions[0];

  return withConnection(async (run) => {
    const res = NextResponse.redirect(new URL("/workbench", req.url), 303);
    res.cookies.delete("wb_pending_resume");

    if (action === "continue" && pending) {
      res.cookies.set("wb_session_id", pending.session_id, COOKIE_OPTS);
      res.cookies.set("wb_current_step", String(pending.current_step), COOKIE_OPTS);
    } else {
      const newSession = await createNewSession(run, email);
      res.cookies.set("wb_session_id", newSession.session_id, COOKIE_OPTS);
      res.cookies.set("wb_current_step", String(newSession.current_step), COOKIE_OPTS);
    }

    return res;
  });
}
