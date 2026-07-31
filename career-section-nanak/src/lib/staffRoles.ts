export const STAFF_DESIGNATIONS = [
  "sales_executive",
  "cre",
  "sales_manager",
  "sales_head",
  "branch_manager",
  "gm",
  "ceo",
  "md",
] as const;

export type StaffDesignation = (typeof STAFF_DESIGNATIONS)[number];

export const DESIGNATION_LABELS: Record<StaffDesignation, string> = {
  sales_executive: "Sales Executive",
  cre: "CRE",
  sales_manager: "Sales Manager",
  sales_head: "Sales Head",
  branch_manager: "Branch Manager",
  gm: "General Manager",
  ceo: "CEO",
  md: "Managing Director",
};

/** Org chart order (top → bottom). */
export const DESIGNATION_RANK: Record<StaffDesignation, number> = {
  md: 100,
  ceo: 90,
  gm: 80,
  branch_manager: 70,
  sales_head: 60,
  sales_manager: 40,
  cre: 30,
  sales_executive: 20,
};

export function designationLabel(designation?: string | null) {
  if (!designation) return "Staff";
  return DESIGNATION_LABELS[designation as StaffDesignation] || designation;
}
