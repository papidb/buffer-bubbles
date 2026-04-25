import { getClusterVoteTotal, getPriorityScore, classNames } from "@/lib/cluster-utils";
import type { Cluster, SortKey } from "@/types/clusters";

type ClusterListProps = {
  clusters: Cluster[];
  activeId?: Cluster["cluster_id"];
  onSelect: (cluster: Cluster) => void;
  sortKey: SortKey;
};

export function ClusterList({ clusters, activeId, onSelect, sortKey }: ClusterListProps) {
  return (
    <div className="h-full w-full overflow-y-auto p-3" style={{ scrollbarGutter: "stable" }}>
      {clusters.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">No clusters match the current filters.</div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster, index) => {
            const isActive = cluster.cluster_id === activeId;

            return (
              <button
                key={cluster.cluster_id}
                type="button"
                onClick={() => onSelect(cluster)}
                className={classNames(
                  "block w-full rounded-2xl border p-4 text-left transition",
                  isActive ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={classNames("text-xs font-semibold uppercase tracking-[0.16em]", isActive ? "text-slate-300" : "text-slate-500")}>
                      #{index + 1} by {sortKey}
                    </div>
                    <div className={classNames("mt-2 text-lg font-bold leading-tight", isActive ? "text-white" : "text-slate-900")}>
                      {cluster.category}
                    </div>
                  </div>

                  <div className={classNames("rounded-2xl px-3 py-2 text-right", isActive ? "bg-white/10" : "bg-slate-100")}>
                    <div className={classNames("text-xs font-semibold uppercase tracking-[0.16em]", isActive ? "text-slate-300" : "text-slate-500")}>
                      Priority
                    </div>
                    <div className={classNames("text-lg font-bold", isActive ? "text-white" : "text-slate-900")}>
                      {getPriorityScore(cluster)}
                    </div>
                  </div>
                </div>

                <div className={classNames("mt-3 text-sm leading-6", isActive ? "text-slate-200" : "text-slate-600")}>
                  {cluster.representative_titles.slice(0, 2).join(" · ")}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  {[
                    ["Requests", cluster.request_count],
                    ["Votes", getClusterVoteTotal(cluster)],
                    ["Comments", cluster.total_comments],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className={classNames("rounded-xl border px-3 py-2", isActive ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}
                    >
                      <div className={classNames("text-[11px] font-semibold uppercase tracking-[0.16em]", isActive ? "text-slate-300" : "text-slate-500")}>
                        {label}
                      </div>
                      <div className={classNames("mt-1 text-base font-bold", isActive ? "text-white" : "text-slate-900")}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {cluster.boards.map((board) => (
                    <span key={board} className={classNames("rounded-full px-3 py-1 text-xs font-semibold", isActive ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-700")}>
                      {board}
                    </span>
                  ))}
                  {cluster.statuses.slice(0, 2).map(([status, count]) => (
                    <span
                      key={status}
                      className={classNames("rounded-full px-3 py-1 text-xs font-semibold", isActive ? "bg-emerald-400/15 text-emerald-100" : "bg-emerald-50 text-emerald-700")}
                    >
                      {status} · {count}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
