import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exteriorColoursFor } from "@/data/stockColourOptions";
import type { VehicleCatalog } from "@/hooks/useVehicleCatalog";

export type PoLineDraft = {
  key: string;
  model: string;
  variant: string;
  colour: string;
  qty: string;
  basicPrice: string;
};

type Props = {
  index: number;
  line: PoLineDraft;
  catalogModels: string[];
  trimsFor: VehicleCatalog["trimsFor"];
  onChange: (line: PoLineDraft) => void;
  onRemove?: () => void;
  removable?: boolean;
};

export function emptyPoLineDraft(model = "", variant = "", colour = ""): PoLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    model,
    variant,
    colour,
    qty: "1",
    basicPrice: "",
  };
}

export default function PoLineEditorRow({
  index,
  line,
  catalogModels,
  trimsFor,
  onChange,
  onRemove,
  removable,
}: Props) {
  const variants = trimsFor(line.model);
  const colours = exteriorColoursFor(line.model, line.variant);

  const setModel = (model: string) => {
    const variant = trimsFor(model)[0] ?? "";
    onChange({
      ...line,
      model,
      variant,
      colour: exteriorColoursFor(model, variant)[0] ?? "",
    });
  };

  const setVariant = (variant: string) => {
    const nextColours = exteriorColoursFor(line.model, variant);
    onChange({
      ...line,
      variant,
      colour: nextColours.includes(line.colour) ? line.colour : (nextColours[0] ?? ""),
    });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Line {index + 1} · one model / variant / colour
        </p>
        {removable && onRemove ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Model *</Label>
          <Select value={line.model || undefined} onValueChange={setModel}>
            <SelectTrigger className="bg-background/80"><SelectValue placeholder="Select model" /></SelectTrigger>
            <SelectContent>
              {catalogModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Variant</Label>
          {variants.length === 0 ? (
            <Input value="Standard lineup" disabled className="bg-background/80" />
          ) : (
            <Select value={line.variant || undefined} onValueChange={setVariant}>
              <SelectTrigger className="bg-background/80"><SelectValue placeholder="Variant" /></SelectTrigger>
              <SelectContent>
                {variants.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Colour</Label>
          <Select
            value={line.colour || undefined}
            onValueChange={(colour) => onChange({ ...line, colour })}
            disabled={colours.length === 0}
          >
            <SelectTrigger className="bg-background/80"><SelectValue placeholder="Colour" /></SelectTrigger>
            <SelectContent>
              {colours.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min={1}
            value={line.qty}
            onChange={(e) => onChange({ ...line, qty: e.target.value })}
            className="bg-background/80"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Basic Price (₹)</Label>
          <Input
            type="number"
            value={line.basicPrice}
            onChange={(e) => onChange({ ...line, basicPrice: e.target.value })}
            className="bg-background/80"
          />
        </div>
      </div>
    </div>
  );
}

export function formatPoLineLabel(line: { model: string; variant?: string; colour?: string }) {
  return [line.model, line.variant, line.colour].filter(Boolean).join(" · ");
}
