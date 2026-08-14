"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "teacher" | "student" | "parent";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<Role>("teacher");
  // Parents can sign up with email/password or phone OTP. Email is the
  // default because phone OTP needs a configured SMS provider (and, in
  // India, DLT sender registration), which many deployments won't have.
  const [parentMethod, setParentMethod] = useState<"email" | "phone">("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState("Class 4");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          ...(role === "student" ? { grade } : {}),
        },
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/${role}/dashboard`);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { data: { role: "parent", full_name: fullName } },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOtpSent(true);
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
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/parent/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Create your LearnNest account</h1>

      <div className="flex gap-2">
        {(["teacher", "student", "parent"] as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
              role === r
                ? "border-teacher bg-teacher-light font-medium"
                : "border-slate-200 text-slate-500"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {role === "parent" && (
        <div className="flex gap-2">
          {(["email", "phone"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setParentMethod(m);
                setError(null);
                setOtpSent(false);
              }}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${
                parentMethod === m
                  ? "border-parent bg-parent-light font-medium"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              {m === "email" ? "Use email" : "Use mobile OTP"}
            </button>
          ))}
        </div>
      )}

      {role !== "parent" || parentMethod === "email" ? (
        <form onSubmit={handleEmailSignup} className="flex flex-col gap-3">
          <input
            required
            placeholder="Full name"
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {role === "student" && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option>Class 3</option>
              <option>Class 4</option>
            </select>
          )}
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
            minLength={8}
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className={`rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50 ${
              role === "parent"
                ? "bg-parent"
                : role === "student"
                  ? "bg-student"
                  : "bg-teacher"
            }`}
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
      ) : !otpSent ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
          <input
            required
            placeholder="Your name"
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
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
      ) : (
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
    </main>
  );
}
