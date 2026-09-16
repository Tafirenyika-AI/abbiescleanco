"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} className="text-sm text-surface-200 hover:text-teal-300">
      Sign out
    </button>
  );
}
