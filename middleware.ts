import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_PREFIX: Record<string, string> = {
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isRolePrefixed = Object.values(ROLE_PREFIX).some((p) => path.startsWith(p));
  // /admin is handled separately from the role-prefix map below: an
  // admin account is promoted by directly editing public.users.role
  // (see migration 0013), not through signup, so the JWT's
  // user_metadata.role can be stale for an admin. Middleware here only
  // enforces "must be logged in" for /admin; the actual role check
  // happens in the admin page itself against a live database read.
  const isAdminPath = path.startsWith("/admin");
  const isProtected = isRolePrefixed || isAdminPath;

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isRolePrefixed && user) {
    const role = (user.user_metadata as { role?: string })?.role;
    const allowedPrefix = role ? ROLE_PREFIX[role] : undefined;
    if (!allowedPrefix || !path.startsWith(allowedPrefix)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*", "/parent/:path*", "/admin/:path*"],
};
