"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";

type Role = "teacher" | "student" | "parent" | "admin";

const ROLE_STYLE: Record<Role, { accent: string; text: string; label: string }> = {
  teacher: { accent: "bg-teacher", text: "text-teacher", label: "Teacher" },
  student: { accent: "bg-student", text: "text-student", label: "Student" },
  parent: { accent: "bg-parent", text: "text-parent", label: "Parent" },
  admin: { accent: "bg-ink", text: "text-ink", label: "Admin" },
};

const NAV_LINKS: Record<Role, { href: string; label: string }[]> = {
  teacher: [
    { href: "/teacher/dashboard", label: "Dashboard" },
    { href: "/teacher/classes", label: "Classes" },
    { href: "/teacher/calendar", label: "Calendar" },
    { href: "/teacher/search", label: "Search" },
  ],
  student: [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/practice", label: "Practice" },
  ],
  parent: [{ href: "/parent/dashboard", label: "Dashboard" }],
  admin: [{ href: "/admin/dashboard", label: "Overview" }],
};

export function AppShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const style = ROLE_STYLE[role];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <div className={`h-1 w-full ${style.accent}`} />
      <header className="border-b border-ink/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={`/${role}/dashboard`} className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white ${style.accent}`}
              >
                L
              </span>
              <span className="font-display text-base font-semibold">LearnNest</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_LINKS[role].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {role !== "admin" && <NotificationBell accentColor={role} />}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{userName}</p>
              <p className={`text-xs font-medium leading-tight ${style.text}`}>
                {style.label}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink/60 hover:border-ink/20 hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-ink/5 px-4 py-1.5 sm:hidden">
          {NAV_LINKS[role].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-lg px-3 py-1 text-xs text-ink/60 hover:bg-ink/5"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="dot-grid">{children}</div>
    </div>
  );
}
