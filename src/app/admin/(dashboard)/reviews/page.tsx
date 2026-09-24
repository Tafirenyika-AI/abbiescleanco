import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listAllReviewsForAdmin } from "@/lib/server/reviews";
import { isDatabaseConfigured } from "@/lib/db";
import ReviewsManager from "@/components/admin/ReviewsManager";

export default async function AdminReviewsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_REVIEWS")) {
    redirect("/admin");
  }

  const reviews = await listAllReviewsForAdmin();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
      <p className="mt-1 text-sm text-slate-600">
        Approve genuine submissions and choose which ones are featured on the homepage. Never edit
        what a customer wrote.
      </p>
      {!isDatabaseConfigured && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-slate-900">
          No DATABASE_URL is configured, reviews save to the local mock store (<code>.data/reviews.json</code>).
        </p>
      )}
      <div className="mt-6">
        <ReviewsManager reviews={reviews} />
      </div>
    </div>
  );
}
