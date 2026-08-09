import { adminGet } from "@/lib/api";
import type { ReportPeriod } from "@/components/admin/ReportPeriodPresets";

export type DeliveryReportExecutiveRow = {
  executiveId: string | null;
  name: string;
  count: number;
};

export type DeliveryReportCountRow = {
  model?: string;
  source?: string;
  count: number;
};

export type DeliveryReportPeriodRow = {
  bucket: string;
  count: number;
};

export type DeliveryReportLeadRow = {
  leadId: string;
  _id: string;
  name: string;
  mobile: string;
  model: string;
  source: string;
  executiveName: string;
  executiveId: string | null;
  deliveryDate: string;
};

export type DeliveryReport = {
  period: ReportPeriod | string;
  from: string;
  to: string;
  bucketUnit: "day" | "week" | "month" | string;
  totalDeliveries: number;
  byExecutive: DeliveryReportExecutiveRow[];
  byModel: DeliveryReportCountRow[];
  bySource: DeliveryReportCountRow[];
  byPeriod: DeliveryReportPeriodRow[];
  rows: DeliveryReportLeadRow[];
};

export async function fetchDeliveryReport(params: {
  period?: ReportPeriod;
  from?: string;
  to?: string;
  source?: string;
} = {}): Promise<DeliveryReport> {
  const q = new URLSearchParams();
  if (params.period) q.set("period", params.period);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.source && params.source !== "all") q.set("source", params.source);
  const { data } = await adminGet<DeliveryReport>(`/admin/reports/deliveries?${q}`);
  if (!data) throw new Error("Delivery report response was empty");
  return data;
}
