"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-sm text-blue-600 hover:underline"
    >
      Logout
    </button>
  );
}
