import { useMemo } from "react";
import { encodeModelTrim, decodeModelTrim, MODEL_TRIM_COMBO_BOTH } from "@/data/vinfastModels";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";

type Props = {
  id?: string;
  model: string;
  variant: string;
  onChange: (model: string, variant: string) => void;
  className?: string;
  /** Contact: “Not sure — which model” */
  includeNotSureBoth?: boolean;
  /** MPV 7 is part of the catalog everywhere; pass false only where it must be hidden. */
  includeMpv7?: boolean;
};

/**
 * Model + trim dropdown driven by the admin-managed vehicle model master
 * (with the static catalog as fallback while it loads).
 */
export function ModelTrimSelect({
  id,
  model,
  variant,
  onChange,
  className,
  includeNotSureBoth,
  includeMpv7 = true,
}: Props) {
  const { catalog } = useVehicleCatalog();

  const groups = useMemo(() => {
    const visible = includeMpv7 ? catalog : catalog.filter((m) => m.name !== "VF MPV 7");
    return visible.map((m) => ({
      model: m.name,
      options: m.variants.length ? m.variants.map((t) => `${m.name} ${t}`) : [m.name],
    }));
  }, [catalog, includeMpv7]);

  const optionValues = useMemo(() => {
    const set = new Set<string>();
    if (includeNotSureBoth) set.add(MODEL_TRIM_COMBO_BOTH);
    groups.forEach((g) => g.options.forEach((label) => set.add(encodeModelTrim(g.model, label))));
    return set;
  }, [groups, includeNotSureBoth]);

  const encoded = encodeModelTrim(model, variant);
  let value: string;
  if (optionValues.has(encoded)) {
    value = encoded;
  } else if (model === "Both") {
    value = MODEL_TRIM_COMBO_BOTH;
  } else {
    const group = groups.find((g) => g.model === model) ?? groups[0];
    value = group ? encodeModelTrim(group.model, group.options[0]) : "";
  }

  const notSureLabel = `Not sure — ${groups.map((g) => g.model).join(", ").replace(/, ([^,]*)$/, ", or $1")}`;

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        const next = decodeModelTrim(e.target.value);
        onChange(next.model, next.variant);
      }}
      className={className}
    >
      {includeNotSureBoth && <option value={MODEL_TRIM_COMBO_BOTH}>{notSureLabel}</option>}
      {groups.map((g) => (
        <optgroup key={g.model} label={`VinFast ${g.model}`}>
          {g.options.map((label) => (
            <option key={label} value={encodeModelTrim(g.model, label)}>
              {label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
