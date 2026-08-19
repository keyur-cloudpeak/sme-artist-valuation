import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/snowflake";
import {
  isValidEmail,
  ensureSessionTables,
  getOpenSession,
  createNewSession,
} from "@/lib/sessionManager";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.redirect(new URL("/?error=invalid_email", req.url), 303);
  }

  return withConnection(async (run) => {
    try {
      await ensureSessionTables(run);
    } catch {
      // best effort, mirrors Python
    }

    const openSession = await getOpenSession(run, email);
    const res = NextResponse.redirect(
      new URL(openSession ? "/resume" : "/workbench", req.url),
      303
    );
    res.cookies.set("wb_email", email, COOKIE_OPTS);

    if (openSession) {
      res.cookies.set(
        "wb_pending_resume",
        JSON.stringify(openSession),
        COOKIE_OPTS
      );
    } else {
      const newSession = await createNewSession(run, email);
      res.cookies.set("wb_session_id", newSession.session_id, COOKIE_OPTS);
      res.cookies.set("wb_current_step", String(newSession.current_step), COOKIE_OPTS);
    }

    return res;
  });
}
