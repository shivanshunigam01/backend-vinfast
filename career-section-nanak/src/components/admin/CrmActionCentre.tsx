import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, MessageSquare, CalendarClock, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActionCentreCounts, ActionCentreData, ActionCentreRow } from "@/lib/crmActionCentreApi";
import { cn } from "@/lib/utils";

const CARDS: { key: keyof ActionCentreCounts; label: string }[] = [
  { key: "newEnquiries", label: "New Enquiries" },
  { key: "followUpToday", label: "Follow-up Today" },
  { key: "overdueFollowUps", label: "Overdue Follow-ups" },
  { key: "tdToday", label: "Test Drive Today" },
  { key: "hotFavourite", label: "HOT / Favourite" },
  { key: "upcomingFollowUps", label: "Upcoming Follow-ups" },
  { key: "negotiation", label: "Negotiation" },
  { key: "bookingPending", label: "Booking Pending" },
  { key: "deliveryPending", label: "Delivery Pending" },
  { key: "newUpdates", label: "New Updates" },
];

const PREVIEW_KEY: Record<keyof ActionCentreCounts, string> = {
  newEnquiries: "newEnquiries",
  followUpToday: "followUpToday",
  overdueFollowUps: "overdueFollowUps",
  tdToday: "tdToday",
  hotFavourite: "hotFavourite",
  upcomingFollowUps: "upcomingFollowUps",
  negotiation: "negotiation",
  bookingPending: "bookingPending",
  deliveryPending: "deliveryPending",
  newUpdates: "newUpdates",
};

function waLink(mobile?: string) {
  const d = String(mobile || "").replace(/\D/g, "").slice(-10);
  return d ? `https://wa.me/91${d}` : undefined;
}

function telLink(mobile?: string) {
  const d = String(mobile || "").replace(/\D/g, "").slice(-10);
  return d ? `tel:+91${d}` : undefined;
}

type Props = {
  data: ActionCentreData | null;
};

export function CrmActionCentre({ data }: Props) {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!data?.counts) return null;
  const rows = openKey ? data.preview?.[PREVIEW_KEY[openKey as keyof ActionCentreCounts] || openKey] || [] : [];

  const openLead = (row: ActionCentreRow) => {
    if (row.href && row.href.includes("/td/")) {
      navigate(row.href);
      return;
    }
    navigate(`/admin/crm/leads?lead=${row._id}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">My Action Centre</h2>
        <p className="text-xs text-muted-foreground">What needs your attention today. Every count opens the customer list.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {CARDS.map((c) => {
          const value = data.counts[c.key] || 0;
          const urgent = c.key === "overdueFollowUps" && value > 0;
          const today = c.key === "followUpToday" && value > 0;
          return (
            <Card
              key={c.key}
              role="button"
              tabIndex={0}
              onClick={() => setOpenKey(c.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setOpenKey(c.key);
              }}
              className={cn(
                "p-3 cursor-pointer border-border/50 hover:border-primary/40 transition-colors",
                urgent && "border-red-500/40 bg-red-500/5",
                today && "border-orange-500/40 bg-orange-500/5",
              )}
            >
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <p className={cn("text-2xl font-bold mt-1", urgent ? "text-red-600" : today ? "text-orange-600" : "text-foreground")}>
                {value}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        {[
          { label: "Priority 1 — Critical", rows: data.priority?.critical || [], tone: "text-red-600" },
          { label: "Priority 2 — Due today", rows: data.priority?.dueToday || [], tone: "text-orange-600" },
          { label: "Priority 3 — Upcoming", rows: data.priority?.upcoming || [], tone: "text-foreground" },
        ].map((col) => (
          <Card key={col.label} className="p-3 border-border/50">
            <p className={cn("text-xs font-semibold mb-2", col.tone)}>{col.label}</p>
            {col.rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-2">
                {col.rows.slice(0, 6).map((r) => (
                  <li key={r._id}>
                    <button type="button" className="text-left w-full text-xs hover:text-primary" onClick={() => openLead(r)}>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground"> · {r.model}</span>
                      {r.recommendedNextAction ? (
                        <span className="block text-[10px] text-muted-foreground">{r.recommendedNextAction}</span>
                      ) : null}
                      {r.suggestedHot ? (
                        <span className="block text-[10px] text-amber-600">Suggest HOT (2+ HOT follow-ups)</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(openKey)} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{CARDS.find((c) => c.key === openKey)?.label || "Customers"}</DialogTitle>
          </DialogHeader>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No matching customers.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2">Customer</th>
                    <th className="py-2 pr-2">Mobile</th>
                    <th className="py-2 pr-2">Model</th>
                    <th className="py-2 pr-2">Stage</th>
                    <th className="py-2 pr-2">Buyer type</th>
                    <th className="py-2 pr-2">Remarks</th>
                    <th className="py-2 pr-2">Follow-up</th>
                    <th className="py-2 pr-2">Assigned</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="border-b border-border/40">
                      <td className="py-2 pr-2 font-medium">
                        {r.name}
                        {r.suggestedHot ? <span className="block text-[10px] text-amber-600">Suggest HOT</span> : null}
                      </td>
                      <td className="py-2 pr-2 font-mono">{r.mobile}</td>
                      <td className="py-2 pr-2">{r.model}</td>
                      <td className="py-2 pr-2"><Badge variant="outline" className="text-[10px]">{r.status}</Badge></td>
                      <td className="py-2 pr-2">{r.buyerType || "—"}</td>
                      <td className="py-2 pr-2 max-w-[10rem] truncate">{r.remarks || "—"}</td>
                      <td className="py-2 pr-2">{r.nextFollowUp ? new Date(r.nextFollowUp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                      <td className="py-2 pr-2">{r.assignedTo?.name || "—"}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {telLink(r.mobile) ? (
                            <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                              <a href={telLink(r.mobile)}><Phone className="w-3 h-3" /></a>
                            </Button>
                          ) : null}
                          {waLink(r.mobile) ? (
                            <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                              <a href={waLink(r.mobile)} target="_blank" rel="noreferrer"><MessageSquare className="w-3 h-3" /></a>
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openLead(r)}>
                            {r.bucket === "tdToday" ? <CalendarClock className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
