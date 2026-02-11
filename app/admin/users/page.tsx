import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import { query } from "@/lib/db";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default async function AdminUsersPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login");
  }

  const payload = verifyJwt(token);
  if (!payload) {
    redirect("/login");
  }

  if (payload.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const res = await query<UserRow>(
    `SELECT id, username, display_name, role, is_active, created_at
     FROM users
     ORDER BY username ASC`
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="text-blue-600 hover:underline">
            Back to Admin
          </Link>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600 border-b">
            <tr>
              <th className="py-2 pr-4">Username</th>
              <th className="py-2 pr-4">Display Name</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.map((user) => (
              <tr key={user.id} className="border-b last:border-b-0">
                <td className="py-2 pr-4">{user.username}</td>
                <td className="py-2 pr-4">{user.display_name}</td>
                <td className="py-2 pr-4">{user.role}</td>
                <td className="py-2 pr-4">
                  {user.is_active ? "Yes" : "No"}
                </td>
                <td className="py-2 pr-4">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
