import { prisma, isDatabaseConfigured } from "@/lib/db";

export interface ReportsSummary {
  rangeStart: string;
  rangeEnd: string;
  leadsCount: number;
  leadsBySource: { source: string; count: number }[];
  leadsByStatus: { status: string; count: number }[];
  leadsByService: { service: string; count: number }[];
  quotesSent: number;
  quotesAccepted: number;
  quotesDeclined: number;
  acceptedValue: number; // cents
  bookingsScheduledOrConfirmed: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  totalBookings: number;
  conversionRate: number | null; // quotesAccepted / leadsCount
  cancellationRate: number | null; // bookingsCancelled / totalBookings
  totalExpenses: number; // cents
  netRevenue: number; // acceptedValue - totalExpenses, cents
}

export async function getReportsSummary(rangeStart: Date, rangeEnd: Date): Promise<ReportsSummary> {
  const empty: ReportsSummary = {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    leadsCount: 0,
    leadsBySource: [],
    leadsByStatus: [],
    leadsByService: [],
    quotesSent: 0,
    quotesAccepted: 0,
    quotesDeclined: 0,
    acceptedValue: 0,
    bookingsScheduledOrConfirmed: 0,
    bookingsCompleted: 0,
    bookingsCancelled: 0,
    totalBookings: 0,
    conversionRate: null,
    cancellationRate: null,
    totalExpenses: 0,
    netRevenue: 0,
  };
  if (!isDatabaseConfigured || !prisma) return empty;

  const where = { createdAt: { gte: rangeStart, lte: rangeEnd }, deletedAt: null };

  const leads = await prisma.lead.findMany({ where, include: { service: true, quotes: true } });
  const quotes = await prisma.quote.findMany({ where: { createdAt: { gte: rangeStart, lte: rangeEnd }, deletedAt: null } });
  const bookings = await prisma.booking.findMany({ where });
  const expenses = await prisma.expense.findMany({ where: { date: { gte: rangeStart, lte: rangeEnd }, deletedAt: null } });
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const bySource = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byService = new Map<string, number>();
  for (const l of leads) {
    bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
    byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);
    byService.set(l.service.name, (byService.get(l.service.name) ?? 0) + 1);
  }

  const quotesSent = quotes.filter((q) => q.status !== "DRAFT").length;
  const quotesAccepted = quotes.filter((q) => q.status === "ACCEPTED").length;
  const quotesDeclined = quotes.filter((q) => q.status === "DECLINED").length;
  const acceptedValue = quotes.filter((q) => q.status === "ACCEPTED").reduce((sum, q) => sum + q.total, 0);

  const bookingsScheduledOrConfirmed = bookings.filter((b) => ["CONFIRMED", "SCHEDULED"].includes(b.status)).length;
  const bookingsCompleted = bookings.filter((b) => b.status === "COMPLETED").length;
  const bookingsCancelled = bookings.filter((b) => b.status === "CANCELLED").length;

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    leadsCount: leads.length,
    leadsBySource: [...bySource.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    leadsByStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    leadsByService: [...byService.entries()].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count),
    quotesSent,
    quotesAccepted,
    quotesDeclined,
    acceptedValue,
    bookingsScheduledOrConfirmed,
    bookingsCompleted,
    bookingsCancelled,
    totalBookings: bookings.length,
    // Real bug found + fixed here: this used to divide quotesAccepted (quotes CREATED in this
    // window) by leads.length (leads CREATED in this window) -- two different cohorts, since a
    // quote created this period can belong to a lead created long before it (e.g. an existing
    // customer books again). That let the "rate" exceed 100%. Conversion is now "of leads created
    // in this window, how many have an accepted quote (created any time)" -- a real percentage.
    conversionRate: leads.length > 0 ? leads.filter((l) => l.quotes.some((q) => q.status === "ACCEPTED")).length / leads.length : null,
    cancellationRate: bookings.length > 0 ? bookingsCancelled / bookings.length : null,
    totalExpenses,
    netRevenue: acceptedValue - totalExpenses,
  };
}

/** Real payments received (status PAID), bucketed per day -- for a dashboard revenue trend chart. Oldest first. */
export async function getDailyRevenue(days: number): Promise<{ date: string; cents: number }[]> {
  const out: { date: string; cents: number }[] = [];
  if (!isDatabaseConfigured || !prisma) return out;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const payments = await prisma.payment.findMany({ where: { status: "PAID", createdAt: { gte: start } }, select: { amount: true, createdAt: true } });

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const cents = payments.filter((p) => p.createdAt >= dayStart && p.createdAt <= dayEnd).reduce((sum, p) => sum + p.amount, 0);
    out.push({ date: dayStart.toISOString().slice(0, 10), cents });
  }
  return out;
}
