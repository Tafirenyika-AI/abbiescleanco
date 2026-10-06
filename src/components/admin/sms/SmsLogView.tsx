import Link from "next/link";
import { ArrowLeftRight, MessageSquareText } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import type { SmsMessagePage } from "@/lib/server/smsMessageStore";
import { formatDateTime } from "@/lib/adminDate";

const statusTone: Record<string, "neutral" | "info" | "success" | "error" | "warning"> = {
  queued: "info",
  sent: "info",
  delivered: "success",
  received: "neutral",
  failed: "error",
  skipped: "warning",
};

export default function SmsLogView({ result }: { result: SmsMessagePage }) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">SMS log</h1>
      <p className="mt-1 text-sm text-admin-text-muted">{result.total} messages -- every customer-care text sent or received, with delivery status.</p>

      <div className="mt-6">
        {result.items.length === 0 ? (
          <Card><EmptyState icon={MessageSquareText} title="No SMS activity yet" description="Outbound and inbound texts will show up here once SMS sending is enabled." /></Card>
        ) : (
          <Card padded={false}>
            <table className="w-full text-left text-sm">
              <thead className="bg-admin-bg">
                <tr>
                  <th className="p-3.5 font-semibold text-admin-text">When</th>
                  <th className="p-3.5 font-semibold text-admin-text">Direction</th>
                  <th className="p-3.5 font-semibold text-admin-text">Customer</th>
                  <th className="p-3.5 font-semibold text-admin-text">Number</th>
                  <th className="p-3.5 font-semibold text-admin-text">Category</th>
                  <th className="p-3.5 font-semibold text-admin-text">Message</th>
                  <th className="p-3.5 font-semibold text-admin-text">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((m) => (
                  <tr key={m.id} className="border-t border-admin-border align-top">
                    <td className="p-3.5 whitespace-nowrap text-admin-text-muted">{formatDateTime(m.createdAt)}</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 text-admin-text-muted">
                        <ArrowLeftRight className="size-3.5" aria-hidden /> {m.direction === "IN" ? "Inbound" : "Outbound"}
                      </span>
                    </td>
                    <td className="p-3.5 text-admin-text">{m.customerName || "—"}</td>
                    <td className="p-3.5 text-admin-text-muted">{m.direction === "IN" ? m.fromAddress : m.toAddress}</td>
                    <td className="p-3.5 text-admin-text-muted">{m.category || "—"}</td>
                    <td className="p-3.5 max-w-xs truncate text-admin-text" title={m.body}>{m.body}</td>
                    <td className="p-3.5">
                      {m.status ? <Badge tone={statusTone[m.status] ?? "neutral"}>{m.status}</Badge> : "—"}
                      {m.errorMessage && <p className="mt-1 text-xs text-admin-error">{m.errorMessage}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-admin-text-muted">
          <span>Page {result.page} of {totalPages}</span>
          <div className="flex gap-2">
            {result.page > 1 && <Link href={`/admin/sms?page=${result.page - 1}`} className="text-admin-teal-hover hover:underline">Previous</Link>}
            {result.page < totalPages && <Link href={`/admin/sms?page=${result.page + 1}`} className="text-admin-teal-hover hover:underline">Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
