import { BIHAR_DISTRICTS, DISTRICT_OTHER } from "@/data/biharDistricts";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  label?: string;
  /** Merged with default label styles; use `sr-only` to match placeholder-only inputs in a grid row. */
  labelClassName?: string;
  selectClassName: string;
  otherInputClassName?: string;
  value: string;
  otherValue: string;
  onDistrictChange: (district: string) => void;
  onOtherChange: (detail: string) => void;
  disabled?: boolean;
  /**
   * When true, the district `<select>` stays in the grid cell next to model; if "Other" is chosen,
   * the free-text field renders on the next row spanning the full form width (avoids a tall right column).
   */
  fullWidthOtherRow?: boolean;
  /** Label above the free-text field when `fullWidthOtherRow` is on (and Other is selected). */
  otherFieldLabel?: string;
  /** Extra classes on the select’s grid cell when `fullWidthOtherRow` (e.g. MPV7 pre-book grid spans). */
  selectWrapperClassName?: string;
  /** Classes on the full-width row wrapper for the free-text field; default spans 2 cols on `sm+`. */
  otherRowClassName?: string;
};

/**
 * District dropdown (all Bihar districts) + optional free text when "Other (outside Bihar)".
 * Stored field names elsewhere remain `city` / `otherCity` for API compatibility.
 */
export function BiharDistrictField({
  id,
  label,
  labelClassName,
  selectClassName,
  otherInputClassName,
  value,
  otherValue,
  onDistrictChange,
  onOtherChange,
  disabled,
  fullWidthOtherRow = false,
  otherFieldLabel = "City / state / district",
  selectWrapperClassName,
  otherRowClassName = "sm:col-span-2",
}: Props) {
  const otherClass = otherInputClassName ?? selectClassName;
  const otherId = id ? `${id}-other-city` : "bihar-district-other-city";

  const selectEl = (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onDistrictChange(v);
      }}
      className={selectClassName}
      aria-label={label ? undefined : "District (Bihar)"}
    >
      {BIHAR_DISTRICTS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      <option value={DISTRICT_OTHER}>Other (outside Bihar)</option>
    </select>
  );

  const otherInput =
    value === DISTRICT_OTHER ? (
      <input
        type="text"
        placeholder="City / state / district"
        value={otherValue}
        onChange={(e) => onOtherChange(e.target.value)}
        className={otherClass}
        autoFocus
        id={fullWidthOtherRow ? otherId : undefined}
        aria-label={fullWidthOtherRow ? undefined : "City, state, or district outside Bihar"}
      />
    ) : null;

  const labelCn = label
    ? cn("text-xs font-medium text-muted-foreground", labelClassName)
    : "";

  if (!fullWidthOtherRow) {
    return (
      <div className="flex min-w-0 w-full flex-col gap-2">
        {label ? (
          <label htmlFor={id} className={labelCn}>
            {label}
          </label>
        ) : null}
        {selectEl}
        {otherInput}
      </div>
    );
  }

  return (
    <>
      <div className={cn("flex min-w-0 w-full flex-col gap-2", selectWrapperClassName)}>
        {label ? (
          <label htmlFor={id} className={labelCn}>
            {label}
          </label>
        ) : null}
        {selectEl}
      </div>
      {otherInput ? (
        <div className={cn("flex min-w-0 w-full flex-col gap-2", otherRowClassName)}>
          <label htmlFor={otherId} className="text-xs font-medium text-muted-foreground">
            {otherFieldLabel}
          </label>
          {otherInput}
        </div>
      ) : null}
    </>
  );
}
