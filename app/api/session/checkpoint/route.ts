import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/snowflake";
import { saveCheckpoint } from "@/lib/sessionManager";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest) {
  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    // malformed body
  }

  const cookieStore = req.cookies;
  const userEmail = cookieStore.get("wb_email")?.value || "";
  const sessionId = cookieStore.get("wb_session_id")?.value || "";
  const step = Number(payload?.step || 0) || 0;
  const stepData = payload?.stepData || payload?.step_data || {};

  if (!sessionId || !step) {
    return NextResponse.json({ ok: false, reason: "missing_session_or_step" }, { status: 400 });
  }

  try {
    await withConnection(async (run) => {
      await saveCheckpoint(run, sessionId, step, stepData, userEmail || undefined);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
