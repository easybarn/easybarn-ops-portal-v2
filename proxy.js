import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs before every request: refreshes the Supabase session cookie and
// keeps signed-out visitors on the public pages.
const PUBLIC = ["/login", "/signup", "/pending"];

export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  const isApi = path.startsWith("/api/");

  if (!user && isApi) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (user && (path === "/" || path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
