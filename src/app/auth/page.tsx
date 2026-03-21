"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail, Sparkles, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

const ACTION_CODE_SETTINGS = {
  url: typeof window !== "undefined" ? `${window.location.origin}/auth` : "",
  handleCodeInApp: true,
};

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) { router.replace("/dashboard"); return; }
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let storedEmail = localStorage.getItem("emailForSignIn") || "";
      if (!storedEmail) storedEmail = window.prompt("Please provide your email:") || "";
      if (storedEmail) {
        signInWithEmailLink(auth, storedEmail, window.location.href)
          .then(() => { localStorage.removeItem("emailForSignIn"); router.replace("/dashboard"); })
          .catch(() => toast.error("Invalid or expired link. Please try again."));
      }
    }
  }, [user, loading, router]);

  const handleSendLink = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) return toast.error("Enter a valid email");
    setSubmitting(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        ...ACTION_CODE_SETTINGS,
        url: `${window.location.origin}/auth`,
      });
      localStorage.setItem("emailForSignIn", email);
      setSent(true);
      toast.success("Magic link sent! Check your inbox.");
    } catch (e: any) {
      toast.error(e.message || "Failed to send link");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-volt border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-volt/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-sky-vivid/5 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-volt/20 to-transparent" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-volt mb-4">
            <span className="font-display font-black text-2xl text-obsidian-950">$</span>
          </div>
          <h1 className="font-display font-black text-3xl text-white">Ledger</h1>
          <p className="text-white/40 font-body text-sm mt-1">Personal Finance Visualizer</p>
        </div>

        <div className="bg-obsidian-800/80 border border-obsidian-600/60 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
          {!sent ? (
            <>
              <div className="mb-5">
                <h2 className="font-display font-bold text-white text-xl">Sign in</h2>
                <p className="text-white/40 font-body text-sm mt-1">We&apos;ll send you a magic link — no password needed.</p>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  id="email"
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
                />
                <Button onClick={handleSendLink} disabled={submitting} size="lg" className="w-full">
                  <Mail size={16} />
                  {submitting ? "Sending..." : "Send magic link"}
                </Button>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                {["No password required", "Secure email link", "Works on any device"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs font-body text-white/30">
                    <Sparkles size={11} className="text-volt/50" />
                    {f}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-volt mx-auto mb-4" />
              <h2 className="font-display font-bold text-white text-xl mb-2">Check your inbox</h2>
              <p className="text-white/40 font-body text-sm">We sent a sign-in link to</p>
              <p className="text-volt font-body text-sm font-semibold mt-1">{email}</p>
              <button onClick={() => setSent(false)}
                className="mt-5 text-xs text-white/30 hover:text-white/60 underline underline-offset-2 font-body transition-colors">
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
