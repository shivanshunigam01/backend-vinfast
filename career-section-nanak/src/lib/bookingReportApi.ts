import { adminGet } from "@/lib/api";
import type { ReportPeriod } from "@/components/admin/ReportPeriodPresets";

export type BookingReportExecutiveRow = {
  executiveId: string | null;
  name: string;
  count: number;
};

export type BookingReportCountRow = {
  model?: string;
  source?: string;
  count: number;
};

export type BookingReportPeriodRow = {
  bucket: string;
  count: number;
};

export type BookingReportLeadRow = {
  leadId: string;
  opportunityId?: string;
  orderNumber?: string;
  bookingNo?: string;
  _id: string;
  customerName: string;
  name: string;
  mobile: string;
  carModel: string;
  carVariant: string;
  colour: string;
  model: string;
  variant: string;
  source: string;
  executiveName: string;
  executiveId: string | null;
  bookingDate: string;
  stage?: string;
};

export type BookingReport = {
  period: ReportPeriod | string;
  from: string;
  to: string;
  bucketUnit: "day" | "week" | "month" | string;
  totalBookings: number;
  byExecutive: BookingReportExecutiveRow[];
  byModel: BookingReportCountRow[];
  bySource: BookingReportCountRow[];
  byPeriod: BookingReportPeriodRow[];
  rows: BookingReportLeadRow[];
};

export async function fetchBookingReport(params: {
  period?: ReportPeriod;
  from?: string;
  to?: string;
  source?: string;
} = {}): Promise<BookingReport> {
  const q = new URLSearchParams();
  if (params.period) q.set("period", params.period);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.source && params.source !== "all") q.set("source", params.source);
  const { data } = await adminGet<BookingReport>(`/admin/reports/bookings?${q}`);
  if (!data) throw new Error("Booking report response was empty");
  return data;
}
