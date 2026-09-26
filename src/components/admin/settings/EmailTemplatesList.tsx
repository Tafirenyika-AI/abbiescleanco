"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import { formatDateTime } from "@/lib/adminDate";
import type { EmailTemplateListItem } from "@/lib/server/emailTemplates";

export default function EmailTemplatesList({ templates }: { templates: EmailTemplateListItem[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {templates.map((t) => (
        <Link key={t.key} href={`/admin/settings/email-templates/${t.key}`} className="block">
          <Card className="h-full transition hover:border-admin-teal/40">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-admin-teal-hover" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-admin-text">{t.name}</p>
                  <p className="mt-0.5 text-xs text-admin-text-muted">{t.description}</p>
                </div>
              </div>
              {t.isCustomized ? <Badge tone="teal">Customized</Badge> : <Badge tone="neutral">Default</Badge>}
            </div>
            <p className="mt-2 truncate text-xs text-admin-text-muted">Subject: {t.subject.replace(/\{\{\w+\}\}/g, "…")}</p>
            {t.isCustomized && t.updatedAt && (
              <p className="mt-1 text-xs text-admin-text-muted">Last edited {formatDateTime(t.updatedAt)}{t.updatedByName ? ` by ${t.updatedByName}` : ""}</p>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
