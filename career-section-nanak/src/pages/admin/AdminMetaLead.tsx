import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  META_LEADS_API_URL,
  fetchMetaLeadsPayload,
  metaLeadsRows,
  mapMetaLeadRow,
  type MetaLeadsApiPayload,
} from "@/lib/metaLeadsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Megaphone } from "lucide-react";
import { toast } from "sonner";

const AdminMetaLead = () => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<MetaLeadsApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMetaLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchMetaLeadsPayload();
      setPayload(data);
    } catch (e) {
      setPayload(null);
      if (isAxiosError(e)) {
        const status = e.response?.status;
        const apiMsg = (e.response?.data as { message?: string } | undefined)?.message;
        let msg = apiMsg ?? e.message ?? `Request failed (${status ?? "network"})`;
        if (status === 503) {
          msg =
            "Meta API not configured on server. Set META_LEADS_UPSTREAM_URL in backend .env to your Meta leads URL, then restart the API.";
        } else if (status === 404) {
          msg = "404 — deploy the latest backend (public All_leads route missing on live server).";
        }
        setError(msg);
        toast.error(msg);
      } else {
        setError("Failed to load Meta leads");
        toast.error("Failed to load Meta leads");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetaLeads();
  }, [fetchMetaLeads]);

  const rows = useMemo(() => metaLeadsRows(payload).map((d) => mapMetaLeadRow(d)), [payload]);
  const metaBlock = payload?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-primary" />
            Meta Lead
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Public API — no login token. Data comes from Meta via{" "}
            <code className="text-xs bg-secondary px-1 rounded">META_LEADS_UPSTREAM_URL</code> on the server.
          </p>
          <p className="text-muted-foreground text-xs mt-1 break-all font-mono">{META_LEADS_API_URL}</p>
        </div>
        <Button onClick={() => void fetchMetaLeads()} variant="outline" disabled={loading} className="bg-secondary/50">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-destructive/50 bg-destructive/5 text-destructive text-sm">{error}</Card>
      )}

      {metaBlock != null && Object.keys(metaBlock).length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-xs font-medium text-muted-foreground mb-2">Response meta (from Meta / API)</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(metaBlock, null, 2)}</pre>
        </Card>
      )}

      <Card className="bg-card border-border/50 overflow-hidden">
        <div className="p-3 border-b border-border/50 text-sm text-muted-foreground">
          {loading ? "Loading…" : `${rows.length} row(s) in data`}
          {payload?.success === true && " · success: true"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Name</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium whitespace-nowrap">WhatsApp / Mobile</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Email</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">State</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">PIN</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Interested Model</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden lg:table-cell whitespace-nowrap">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Fetching Meta leads…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No rows in <code className="text-xs">data</code>
                  </td>
                </tr>
              )}
              {!loading && rows.length > 0 && (
                <>
                  {rows.map((row, i) => {
                    const whatsappOrMobile = row.whatsappNumber === "—" ? row.mobile : row.whatsappNumber;
                    return (
                      <tr key={row.id || String(i)} className="border-b border-border/20 hover:bg-secondary/20">
                        <td className="p-3 font-medium">{row.name}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{whatsappOrMobile}</td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">{row.email}</td>
                        <td className="p-3 text-muted-foreground">{row.state}</td>
                        <td className="p-3 text-muted-foreground">{row.pin}</td>
                        <td className="p-3">{row.interestedModel}</td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground whitespace-nowrap">{row.createdAt}</td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminMetaLead;
