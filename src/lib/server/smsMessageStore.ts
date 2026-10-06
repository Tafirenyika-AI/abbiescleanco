import { prisma, isDatabaseConfigured } from "@/lib/db";

export interface SmsMessageItem {
  id: string;
  customerName: string | null;
  direction: string | null;
  fromAddress: string | null;
  toAddress: string;
  body: string;
  category: string | null;
  provider: string | null;
  status: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface SmsMessagePage {
  items: SmsMessageItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Paginated SMS log for admin review (section 14) -- reuses the existing `messages` table (now
 *  extended with direction/provider/status) rather than a parallel log. */
export async function listSmsMessages(page = 1, pageSize = 50): Promise<SmsMessagePage> {
  if (!isDatabaseConfigured || !prisma) return { items: [], total: 0, page, pageSize };

  const where = { channel: "SMS" as const };
  const [rows, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.message.count({ where }),
  ]);

  return {
    items: rows.map((m) => ({
      id: m.id,
      customerName: m.customer ? `${m.customer.firstName} ${m.customer.lastName}`.trim() : null,
      direction: m.direction,
      fromAddress: m.fromAddress,
      toAddress: m.toAddress,
      body: m.body,
      category: m.category,
      provider: m.provider,
      status: m.status,
      errorMessage: m.errorMessage,
      createdAt: m.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}
