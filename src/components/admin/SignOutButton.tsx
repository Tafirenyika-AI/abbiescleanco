"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton({
  renderAs,
}: {
  renderAs?: (onClick: () => void, loading: boolean) => React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (renderAs) return <>{renderAs(signOut, loading)}</>;

  return (
    <button type="button" onClick={signOut} disabled={loading} className="text-sm text-surface-200 hover:text-teal-300">
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
