import { createClient } from "@/lib/supabase/client";

// Single source of truth for signing out — used by both the AppShell
// button and the voice LOGOUT intent, so voice control triggers the
// exact same action a click does rather than a second implementation
// of it (master prompt section 22).
export async function performSignOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
