export type CustomerUser = {
  _id: string;
  customerId?: string;
  name: string;
  mobile: string;
  email?: string | null;
  city?: string | null;
};

const TOKEN_KEY = "vf_customer_token";
const USER_KEY = "vf_customer_user";

export function getCustomerToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCustomerUser(): CustomerUser | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerUser;
  } catch {
    return null;
  }
}

export function setCustomerSession(token: string, customer: CustomerUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(customer));
}

export function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isCustomerSession(): boolean {
  return Boolean(getCustomerToken());
}
