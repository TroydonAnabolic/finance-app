"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? "/dashboard" : "/auth");
  }, [user, loading, router]);
  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-volt border-t-transparent animate-spin" />
    </div>
  );
}
