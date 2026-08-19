import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/snowflake";
import { abandonOpenSessions } from "@/lib/sessionManager";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/" };

async function doLogout(req: NextRequest) {
  const store = req.cookies;
  const email = store.get("wb_email")?.value || "";

  try {
    await withConnection(async (run) => {
      if (email) {
        try {
          await abandonOpenSessions(run, email);
        } catch {
          // best-effort
        }
      }
    });
  } catch {
    // ignore DB errors and continue to clear cookies
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete("wb_email");
  res.cookies.delete("wb_session_id");
  res.cookies.delete("wb_current_step");
  res.cookies.delete("wb_pending_resume");
  res.cookies.delete("wb_isrc_table");
  return res;
}

export async function GET(req: NextRequest) {
  return doLogout(req);
}

export async function POST(req: NextRequest) {
  return doLogout(req);
}
