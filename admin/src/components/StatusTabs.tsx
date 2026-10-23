import { humanize } from "../lib/format";

// row of filter buttons: All | Pending | Active ...
export const StatusTabs = ({
  options,
  value,
  onChange,
  label = "Status",
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) => (
  <div className="seg" role="group" aria-label={label}>
    <button className={value === "" ? "on" : ""} onClick={() => onChange("")}>
      All
    </button>
    {options.map((o) => (
      <button key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
        {humanize(o)}
      </button>
    ))}
  </div>
);
