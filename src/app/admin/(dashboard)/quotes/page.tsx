import { listQuotes } from "@/lib/server/quoteStore";
import QuotesView from "@/components/admin/quotes/QuotesView";

export default async function AdminQuotesPage() {
  const quotes = await listQuotes();
  return <QuotesView quotes={quotes} />;
}
