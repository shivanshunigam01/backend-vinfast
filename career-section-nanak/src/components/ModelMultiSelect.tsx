import { useMemo } from "react";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** Selected base model names (e.g. "VF 6", "VF 7"). */
  value: string[];
  onChange: (models: string[]) => void;
  className?: string;
  /** Hide MPV 7 when needed (rare). */
  includeMpv7?: boolean;
  label?: string;
  hint?: string;
};

/**
 * Public multi-select for all active catalog products (VF 6, VF 7, MPV 7, Limo Green, …).
 */
export function ModelMultiSelect({
  id,
  value,
  onChange,
  className,
  includeMpv7 = true,
  label = "Interested models *",
  hint = "Select one or more vehicles",
}: Props) {
  const { catalog, models } = useVehicleCatalog();

  const options = useMemo(() => {
    const list = includeMpv7 ? models : models.filter((m) => m !== "VF MPV 7");
    return list.length ? list : catalog.map((m) => m.name);
  }, [catalog, models, includeMpv7]);

  const selected = useMemo(() => {
    const set = new Set(value.map((v) => String(v).trim()).filter(Boolean));
    return options.filter((m) => set.has(m));
  }, [value, options]);

  const toggle = (model: string) => {
    if (selected.includes(model)) {
      onChange(selected.filter((m) => m !== model));
    } else {
      onChange([...selected, model]);
    }
  };

  return (
    <div className={cn("space-y-2", className)} id={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
        {options.map((model) => {
          const checked = selected.includes(model);
          return (
            <label
              key={model}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors",
                checked
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background/50 text-muted-foreground hover:border-primary/40",
              )}
            >
              <input
                type="checkbox"
                className="rounded border-border w-4 h-4 text-primary shrink-0"
                checked={checked}
                onChange={() => toggle(model)}
              />
              <span className="font-medium leading-tight">VinFast {model}</span>
            </label>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Selected: {selected.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/** Prefer URL/preselect model when present in the list; else first selected; else VF 7 / first catalog. */
export function primaryModelFromSelection(selected: string[], fallback = "VF 7"): string {
  const clean = selected.map((s) => String(s).trim()).filter(Boolean);
  if (clean.includes(fallback)) return fallback;
  return clean[0] || fallback;
}
