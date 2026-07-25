import { adminGet } from "@/lib/api";

export type CustomerTimelineEvent = {
  type:
    | "lead_created"
    | "status_change"
    | "assignment"
    | "edit"
    | "follow_up"
    | "test_drive_booked"
    | "test_drive_completed"
    | "feedback"
    | "post_delivery_feedback"
    | "referral"
    | "sale_conversion";
  at: string;
  title: string;
  detail?: string;
  by?: string;
  executive?: string | null;
  rating?: number | null;
  customerPhotoUrl?: string | null;
  location?: { lat: number; lng: number } | null;
};

export type CustomerHistorySummary = {
  firstEnquiryAt?: string;
  totalLeads: number;
  openLeads: number;
  testDrivesBooked: number;
  testDrivesCompleted: number;
  followUps: number;
  feedbacks: number;
  referralsMade: number;
  purchases: number;
  hasCompletedTestDrive: boolean;
  hasActiveBooking: boolean;
  hasPendingApproval: boolean;
  canBookTestDrive: boolean;
  repeatRequiresAdminApproval: boolean;
};

export type CustomerHistory = {
  customer: {
    _id: string;
    customerId?: string;
    name: string;
    mobile: string;
    email?: string | null;
    city?: string | null;
    since?: string;
  };
  summary: CustomerHistorySummary;
  leads: {
    _id: string;
    leadId?: string;
    opportunityId?: string;
    model?: string;
    source?: string;
    status: string;
    executive?: string | null;
    enquiryDate?: string;
    converted: boolean;
    convertedCustomer?: { customerId?: string; name?: string } | null;
  }[];
  bookings: {
    _id: string;
    bookingId: string;
    bookingStatus: string;
    slotDate?: string;
    slotTime?: string;
    model?: string;
    isRepeat: boolean;
    approvalStatus: string;
    executive?: string | null;
    vehicle?: { model?: string; registrationNo?: string } | null;
  }[];
  timeline: CustomerTimelineEvent[];
};

export type CustomerLookupResult =
  | { existingCustomer: false; customer: null; history: null }
  | ({ existingCustomer: true } & CustomerHistory);

/** Existing-customer lookup by mobile — powers the returning-customer history popup. */
export async function lookupCrmCustomerByMobile(mobile: string): Promise<CustomerLookupResult> {
  const { data } = await adminGet<CustomerLookupResult>(
    `/admin/crm/customers/lookup?mobile=${encodeURIComponent(mobile)}`,
  );
  return data;
}

/** Full lifecycle history by PVCustomer _id or PVCUST code. */
export async function fetchCrmCustomerHistory(idOrCode: string): Promise<CustomerHistory> {
  const { data } = await adminGet<CustomerHistory>(
    `/admin/crm/customers/${encodeURIComponent(idOrCode)}/history`,
  );
  return data;
}
