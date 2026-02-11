import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Admin</h1>
      <p className="text-gray-600 mb-6">
        Logged in as role: <strong>ADMIN</strong>
      </p>

      <div className="space-y-4">
        <section>
          <h2 className="text-lg font-medium">Users</h2>
          <p className="text-gray-600">Manage user accounts and access.</p>
        </section>
        <section>
          <h2 className="text-lg font-medium">Roles</h2>
          <p className="text-gray-600">Define and assign role permissions.</p>
        </section>
        <section>
          <h2 className="text-lg font-medium">System</h2>
          <p className="text-gray-600">View system health and settings.</p>
        </section>
      </div>
    </div>
  );
}
