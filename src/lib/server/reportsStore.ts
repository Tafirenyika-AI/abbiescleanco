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

  const leads = await prisma.lead.findMany({ where, include: { service: true } });
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
    conversionRate: leads.length > 0 ? quotesAccepted / leads.length : null,
    cancellationRate: bookings.length > 0 ? bookingsCancelled / bookings.length : null,
    totalExpenses,
    netRevenue: acceptedValue - totalExpenses,
  };
}
