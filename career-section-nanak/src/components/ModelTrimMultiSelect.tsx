import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** Stored trim labels, e.g. "VF 7 Earth", "VF 6 Wind". */
  value: string[];
  onChange: (labels: string[]) => void;
  className?: string;
  includeMpv7?: boolean;
  label?: string;
  hint?: string;
};

/**
 * Multi-select for model + trim combinations (admin CRM add/edit lead).
 */
export function ModelTrimMultiSelect({
  id,
  value,
  onChange,
  className,
  includeMpv7 = true,
  label = "Products / models *",
  hint = "Select one or more vehicles",
}: Props) {
  const { catalog } = useVehicleCatalog();

  const groups = useMemo(() => {
    const visible = includeMpv7 ? catalog : catalog.filter((m) => m.name !== "VF MPV 7");
    return visible.map((m) => ({
      model: m.name,
      options: m.variants.length ? m.variants.map((t) => `${m.name} ${t}`) : [m.name],
    }));
  }, [catalog, includeMpv7]);

  const optionSet = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => g.options.forEach((label) => set.add(label)));
    return set;
  }, [groups]);

  const selected = useMemo(
    () => value.map((v) => String(v).trim()).filter((v) => optionSet.has(v)),
    [value, optionSet],
  );

  const toggle = (trimLabel: string) => {
    if (selected.includes(trimLabel)) {
      onChange(selected.filter((l) => l !== trimLabel));
    } else {
      onChange([...selected, trimLabel]);
    }
  };

  return (
    <div id={id} className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-border/60 bg-secondary/20 p-2 space-y-3">
        {groups.map((g) => (
          <div key={g.model}>
            <p className="text-[11px] font-semibold text-muted-foreground px-1 mb-1.5">
              VinFast {g.model}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {g.options.map((trimLabel) => {
                const checked = selected.includes(trimLabel);
                return (
                  <label
                    key={trimLabel}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-colors",
                      checked
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(trimLabel)}
                      className="shrink-0"
                    />
                    <span className="leading-tight">{trimLabel.replace(`${g.model} `, "") || g.model}</span>
                    <span className="sr-only">{trimLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Selected ({selected.length}): {selected.join(", ")}
        </p>
      ) : (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">Select at least one product</p>
      )}
    </div>
  );
}

/** Primary stored model line — first selected trim, or fallback. */
export function primaryTrimFromSelection(selected: string[], fallback = "VF 7 Earth"): string {
  const clean = selected.map((s) => String(s).trim()).filter(Boolean);
  return clean[0] || fallback;
}
