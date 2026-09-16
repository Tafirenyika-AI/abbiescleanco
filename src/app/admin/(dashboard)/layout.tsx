import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import Container from "@/components/ui/Container";
import SignOutButton from "@/components/admin/SignOutButton";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-[80vh] bg-surface-50">
      <header className="border-b border-surface-200 bg-navy-950">
        <Container className="flex items-center justify-between py-4">
          <nav className="flex items-center gap-6">
            <Link href="/admin" className="font-display text-lg font-semibold text-white">
              Admin
            </Link>
            <Link href="/admin" className="text-sm text-surface-200 hover:text-teal-300">Dashboard</Link>
            <Link href="/admin/leads" className="text-sm text-surface-200 hover:text-teal-300">Leads</Link>
            <Link href="/admin/pricing" className="text-sm text-surface-200 hover:text-teal-300">Pricing</Link>
          </nav>
          <SignOutButton />
        </Container>
      </header>
      <Container className="py-10">{children}</Container>
    </div>
  );
}
