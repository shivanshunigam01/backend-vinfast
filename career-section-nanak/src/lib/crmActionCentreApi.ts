import { adminGet } from "@/lib/api";

export type ActionCentreRow = {
  _id: string;
  name: string;
  mobile?: string;
  model?: string;
  status?: string;
  buyerType?: string;
  remarks?: string;
  nextFollowUp?: string | null;
  followUpHighlight?: string;
  assignedTo?: { _id: string; name: string } | null;
  interestLevel?: string;
  isFavourite?: boolean;
  ageDays?: number;
  bucket?: string;
  priorityScore?: number;
  suggestedHot?: boolean;
  recommendedNextAction?: string;
  href?: string;
  slotDate?: string;
  slotTime?: string;
  bookingId?: string;
};

export type ActionCentreCounts = {
  newEnquiries: number;
  followUpToday: number;
  overdueFollowUps: number;
  tdToday: number;
  hotFavourite: number;
  upcomingFollowUps: number;
  negotiation: number;
  bookingPending: number;
  deliveryPending: number;
  newUpdates: number;
};

export type ActionCentreData = {
  counts: ActionCentreCounts;
  preview: Record<string, ActionCentreRow[]>;
  priority: {
    critical: ActionCentreRow[];
    dueToday: ActionCentreRow[];
    upcoming: ActionCentreRow[];
  };
  team?: {
    members: Array<{
      _id: string;
      name: string;
      email?: string;
      designation?: string;
      newEnquiry: number;
      followUpToday: number;
      overdue: number;
      tdToday: number;
      hot: number;
      booking: number;
      delivery: number;
    }>;
  };
};

export async function fetchActionCentre(): Promise<ActionCentreData> {
  const { data } = await adminGet<ActionCentreData>("/admin/crm/leads/action-centre");
  return data;
}
