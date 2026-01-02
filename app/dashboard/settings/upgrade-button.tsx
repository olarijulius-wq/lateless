"use client";

import { useState } from "react";

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      if (!data?.url) throw new Error("Missing checkout URL");

      window.location.href = data.url;
    } catch (e: any) {
      alert(e?.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={startCheckout}
      disabled={loading}
      className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
    >
      {loading ? "Suunan…" : "Upgrade"}
    </button>
  );
}