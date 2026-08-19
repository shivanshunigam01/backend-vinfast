import { adminGet, adminPatchJson, adminPostJson } from "@/lib/api";

export type StaffInboxItem = {
  _id: string;
  type: string;
  title: string;
  body?: string;
  customerName?: string;
  leadId?: string;
  href?: string;
  priority?: "urgent" | "today" | "info" | "done";
  readAt?: string | null;
  createdAt: string;
};

export async function fetchStaffNotifications(unread = true): Promise<{
  items: StaffInboxItem[];
  unread: number;
}> {
  const q = unread ? "?unread=1&limit=40" : "?limit=40";
  const res = await adminGet<StaffInboxItem[]>(`/admin/notifications${q}`);
  const items = Array.isArray(res.data) ? res.data : [];
  const unreadCount = Number((res.meta as { unread?: number } | undefined)?.unread ?? items.length);
  return { items, unread: unreadCount };
}

export async function markStaffNotificationRead(id: string): Promise<void> {
  await adminPatchJson(`/admin/notifications/${id}/read`, {});
}

export async function markAllStaffNotificationsRead(): Promise<void> {
  await adminPostJson("/admin/notifications/read-all", {});
}
