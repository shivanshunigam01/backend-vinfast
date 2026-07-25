export type LeadStatus = "New Lead" | "Contact Attempted" | "Interested" | "Test Drive Scheduled" | "Negotiation" | "Booked" | "Lost" | "Dormant";

export interface Lead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  city: string;
  /** When `city` is `Other`, backend expects this field. */
  otherCity?: string;
  model: string;
  source: string;
  status: LeadStatus;
  assignedTo: string;
  createdAt: string;
  nextFollowUp: string;
  remarks: string;
  financeNeeded: boolean;
  exchangeNeeded: boolean;
}

/** Matches backend `testDriveStatuses` (legacy mock values normalized in admin when using API). */
export type TestDriveStatus = "Pending" | "Scheduled" | "Completed" | "Cancelled" | "No Show";

export interface TestDriveBooking {
  id: string;
  leadId: string;
  customerName: string;
  mobile: string;
  model: string;
  preferredDate: string;
  preferredTime: string;
  branch: string;
  /** Dealership Visit | Home Test Drive */
  preferredTestDriveLocation?: string;
  /** Yes | No */
  ownsCar?: string;
  /** When ownsCar is Yes */
  currentCarDetails?: string;
  /** Purchase intent window */
  purchaseTimeline?: string;
  status: TestDriveStatus;
  assignedExecutive: string;
  feedback: string;
  createdAt: string;
}

export interface Enquiry {
  id: string;
  name: string;
  mobile: string;
  email: string;
  type: string;
  message: string;
  status: "Open" | "In Progress" | "Responded" | "Closed";
  createdAt: string;
}

export const LEAD_STATUSES: LeadStatus[] = ["New Lead", "Contact Attempted", "Interested", "Test Drive Scheduled", "Negotiation", "Booked", "Lost", "Dormant"];

export const mockLeads: Lead[] = [
  { id: "L001", name: "Rahul Kumar", mobile: "9876543210", email: "rahul@email.com", city: "Patna", model: "VF 7", source: "Google Ads", status: "New Lead", assignedTo: "Amit", createdAt: "2026-03-15", nextFollowUp: "2026-03-18", remarks: "Interested in top variant", financeNeeded: true, exchangeNeeded: false },
  { id: "L002", name: "Priya Singh", mobile: "9876543211", email: "priya@email.com", city: "Patna", model: "VF 6", source: "Website", status: "Interested", assignedTo: "Suresh", createdAt: "2026-03-14", nextFollowUp: "2026-03-17", remarks: "Wants EMI options", financeNeeded: true, exchangeNeeded: true },
  { id: "L003", name: "Vikram Thakur", mobile: "9876543212", email: "vikram@email.com", city: "Gaya", model: "VF 7", source: "WhatsApp", status: "Test Drive Scheduled", assignedTo: "Amit", createdAt: "2026-03-13", nextFollowUp: "2026-03-19", remarks: "Test drive on Saturday", financeNeeded: false, exchangeNeeded: false },
  { id: "L004", name: "Anita Devi", mobile: "9876543213", email: "anita@email.com", city: "Muzaffarpur", model: "VF 6", source: "Meta Ads", status: "Negotiation", assignedTo: "Rajesh", createdAt: "2026-03-10", nextFollowUp: "2026-03-16", remarks: "Price discussion pending", financeNeeded: true, exchangeNeeded: true },
  { id: "L005", name: "Sanjay Gupta", mobile: "9876543214", email: "sanjay@email.com", city: "Patna", model: "VF 7", source: "Walk-in", status: "Booked", assignedTo: "Suresh", createdAt: "2026-03-08", nextFollowUp: "2026-03-20", remarks: "Booking amount received", financeNeeded: false, exchangeNeeded: true },
  { id: "L006", name: "Neha Kumari", mobile: "9876543215", email: "neha@email.com", city: "Bhagalpur", model: "VF 6", source: "Google Ads", status: "Contact Attempted", assignedTo: "Amit", createdAt: "2026-03-16", nextFollowUp: "2026-03-18", remarks: "No answer, retry", financeNeeded: false, exchangeNeeded: false },
  { id: "L007", name: "Ravi Shankar", mobile: "9876543216", email: "ravi@email.com", city: "Patna", model: "VF 7", source: "Referral", status: "Lost", assignedTo: "Rajesh", createdAt: "2026-03-05", nextFollowUp: "", remarks: "Chose competitor", financeNeeded: false, exchangeNeeded: false },
  { id: "L008", name: "Deepak Mishra", mobile: "9876543217", email: "deepak@email.com", city: "Darbhanga", model: "VF 6", source: "Website", status: "New Lead", assignedTo: "", createdAt: "2026-03-17", nextFollowUp: "2026-03-18", remarks: "Submitted via EMI calculator", financeNeeded: true, exchangeNeeded: false },
];

export const mockTestDrives: TestDriveBooking[] = [
  { id: "TD001", leadId: "L003", customerName: "Vikram Thakur", mobile: "9876543212", model: "VF 7", preferredDate: "2026-03-19", preferredTime: "10:00 AM", branch: "Patna Showroom", status: "Scheduled", assignedExecutive: "Amit", feedback: "", createdAt: "2026-03-13" },
  { id: "TD002", leadId: "L001", customerName: "Rahul Kumar", mobile: "9876543210", model: "VF 7", preferredDate: "2026-03-20", preferredTime: "2:00 PM", branch: "Patna Showroom", status: "Pending", assignedExecutive: "", feedback: "", createdAt: "2026-03-15" },
  { id: "TD003", leadId: "L005", customerName: "Sanjay Gupta", mobile: "9876543214", model: "VF 7", preferredDate: "2026-03-12", preferredTime: "11:00 AM", branch: "Patna Showroom", status: "Completed", assignedExecutive: "Suresh", feedback: "Loved the car, wants to book", createdAt: "2026-03-08" },
  { id: "TD004", leadId: "L002", customerName: "Priya Singh", mobile: "9876543211", model: "VF 6", preferredDate: "2026-03-21", preferredTime: "4:00 PM", branch: "Patna Showroom", status: "Pending", assignedExecutive: "Suresh", feedback: "", createdAt: "2026-03-14" },
];

export const mockEnquiries: Enquiry[] = [
  { id: "E001", name: "Arun Jha", mobile: "9876543220", email: "arun@email.com", type: "Get Price", message: "Want on-road price for VF 7 Plus", status: "Open", createdAt: "2026-03-17" },
  { id: "E002", name: "Sunita Rai", mobile: "9876543221", email: "sunita@email.com", type: "Finance", message: "Need finance options for VF 6", status: "Responded", createdAt: "2026-03-16" },
  { id: "E003", name: "Manoj Kumar", mobile: "9876543222", email: "manoj@email.com", type: "Exchange", message: "Want to exchange my Creta 2022", status: "Open", createdAt: "2026-03-17" },
  { id: "E004", name: "Kavita Devi", mobile: "9876543223", email: "kavita@email.com", type: "Corporate", message: "Fleet enquiry for 5 vehicles", status: "Open", createdAt: "2026-03-15" },
];
