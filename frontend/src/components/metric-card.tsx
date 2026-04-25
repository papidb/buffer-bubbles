import { classNames } from "@/lib/cluster-utils";

export type MetricCardProps = {
  label: string;
  value: string | number;
  muted?: boolean;
};

export function MetricCard({ label, value, muted = false }: MetricCardProps) {
  return (
    <div
      className={classNames(
        "rounded-2xl border p-4 shadow-sm",
        muted
          ? "border-slate-200 bg-white"
          : "border-slate-900 bg-slate-900 text-white",
      )}
    >
      <div
        className={classNames(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          muted ? "text-slate-500" : "text-slate-300",
        )}
      >
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
