"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"password" | "otp" | "otp-verify">(
    "password"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function redirectByRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const role = (user?.user_metadata as { role?: string })?.role ?? "student";
    router.push(`/${role}/dashboard`);
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return setError(error.message);
    await redirectByRole();
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) return setError(error.message);
    setMode("otp-verify");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    setLoading(false);
    if (error) return setError(error.message);
    await redirectByRole();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Log in to LearnNest</h1>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setMode("password")}
          className={`flex-1 rounded-lg border px-3 py-2 ${
            mode !== "otp" && mode !== "otp-verify"
              ? "border-slate-900 font-medium"
              : "border-slate-200 text-slate-500"
          }`}
        >
          Email &amp; password
        </button>
        <button
          onClick={() => setMode("otp")}
          className={`flex-1 rounded-lg border px-3 py-2 ${
            mode === "otp" || mode === "otp-verify"
              ? "border-slate-900 font-medium"
              : "border-slate-200 text-slate-500"
          }`}
        >
          Mobile OTP
        </button>
      </div>

      {mode === "password" && (
        <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
          <input
            required
            type="email"
            placeholder="Email"
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            required
            type="password"
            placeholder="Password"
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="rounded-lg bg-teacher px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
      )}

      {mode === "otp" && (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
          <input
            required
            type="tel"
            placeholder="Mobile number (+91XXXXXXXXXX)"
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="rounded-lg bg-parent px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Sending OTP…" : "Send OTP"}
          </button>
        </form>
      )}

      {mode === "otp-verify" && (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
          <input
            required
            placeholder="Enter OTP"
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="rounded-lg bg-parent px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & continue"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-slate-500">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </main>
  );
}
