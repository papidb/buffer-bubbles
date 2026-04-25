import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { SORT_OPTIONS, classNames } from "@/lib/cluster-utils";
import type { Metric, SortKey, ViewMode } from "@/types/clusters";

type DashboardHeroProps = {
  search: string;
  onSearchChange: (value: string) => void;
  boards: string[];
  statuses: string[];
  boardFilters: string[];
  statusFilters: string[];
  onBoardFiltersChange: (values: string[]) => void;
  onStatusFiltersChange: (values: string[]) => void;
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  sortKey: SortKey;
  onSortKeyChange: (sortKey: SortKey) => void;
};

export function DashboardHero({
  search,
  onSearchChange,
  boards,
  statuses,
  boardFilters,
  statusFilters,
  onBoardFiltersChange,
  onStatusFiltersChange,
  metric,
  onMetricChange,
  viewMode,
  onViewModeChange,
  sortKey,
  onSortKeyChange,
}: DashboardHeroProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Interactive view of aggregated Buffer feature requests</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
        Each bubble is a request cluster. Bigger bubbles indicate stronger demand. Click a bubble to inspect the actual requests grouped under that theme.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div id="tour-search" className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search categories, titles, or summaries"
            className="pl-10"
          />
        </div>

        <div id="tour-filters" className="grid gap-3 md:grid-cols-2 xl:col-span-2">
          <MultiSelect options={boards} placeholder="All boards" selected={boardFilters} onChange={onBoardFiltersChange} />
          <MultiSelect options={statuses} placeholder="All statuses" selected={statusFilters} onChange={onStatusFiltersChange} />
        </div>
      </div>

      <div id="tour-view-toggle" className="mt-4 flex flex-wrap gap-2">
        {[
          ["chart", "Bubble chart"],
          ["list", "Priority list"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onViewModeChange(key as ViewMode)}
            className={classNames(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              viewMode === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="tour-controls" className="mt-3 flex flex-wrap gap-2">
        {viewMode === "chart" ? (
          <>
            {[
              ["requests", "Size by requests"],
              ["votes", "Size by votes"],
              ["comments", "Size by comments"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onMetricChange(key as Metric)}
                className={classNames(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  metric === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                {label}
              </button>
            ))}
          </>
        ) : (
          <>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSortKeyChange(key)}
                className={classNames(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  sortKey === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                Sort by {label.toLowerCase()}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
