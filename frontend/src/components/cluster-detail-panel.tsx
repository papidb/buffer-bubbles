import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Filter, MessageSquare, ThumbsUp } from "lucide-react";
import {
  getClusterVoteTotal,
  getItemVoteCount,
  getPriorityScore,
} from "@/lib/cluster-utils";
import type { Cluster, ClusterStatus } from "@/types/clusters";
import { MetricCard } from "@/components/metric-card";

export function ClusterDetailPanel({
  activeCluster,
}: {
  activeCluster: Cluster | null;
}) {
  return (
    <div
      id="tour-detail"
      className="h-[70vh] min-h-[560px] self-start overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
    >
      <AnimatePresence mode="wait">
        {activeCluster ? (
          <motion.div
            key={activeCluster.cluster_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Selected cluster
                </div>
                <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-900">
                  {activeCluster.category}
                </h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Priority
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {getPriorityScore(activeCluster)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MetricCard
                label="Requests"
                value={activeCluster.request_count}
                muted
              />
              <MetricCard
                label="Votes"
                value={getClusterVoteTotal(activeCluster)}
                muted
              />
              <MetricCard
                label="Comments"
                value={activeCluster.total_comments}
                muted
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {activeCluster.boards.map((board) => (
                <span
                  key={board}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {board}
                </span>
              ))}
              {activeCluster.statuses.map(([status, count]: ClusterStatus) => (
                <span
                  key={status}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {status} · {count}
                </span>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Filter className="h-4 w-4" />
                Representative requests
              </div>
              <div className="space-y-3">
                {activeCluster.items.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          {item.summary}
                        </div>
                      </div>
                      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                      <span>{item.board}</span>
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3.5 w-3.5" />{" "}
                        {getItemVoteCount(item)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />{" "}
                        {item.comments ?? 0}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                        {item.status || "unknown"}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full min-h-[400px] items-center justify-center text-sm text-slate-500"
          >
            Select a bubble to inspect the grouped feature requests.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
