import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/budget",
  "/transactions",
  "/add-expense",
  "/savings",
  "/summary",
  "/report",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard protected routes.
  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Demo mode: cookie set by AuthContext when user enters demo.
  const demoCookie = request.cookies.get("auto-audit-demo");
  if (demoCookie?.value === "1") {
    return NextResponse.next();
  }

  // Supabase session check.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return response;
  }

  // Not authenticated — redirect to landing page.
  const url = request.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
