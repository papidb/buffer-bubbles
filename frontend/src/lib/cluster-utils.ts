import type { Cluster, ClusterItem, SortKey } from "@/types/clusters";

export function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getItemVoteCount(item: ClusterItem) {
  if (typeof item.votes === "number" && item.votes > 0) return item.votes;

  const match = item.summary.match(/What's New\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function getClusterVoteTotal(cluster: Cluster) {
  if (typeof cluster.total_votes === "number" && cluster.total_votes > 0) {
    return cluster.total_votes;
  }

  return cluster.items.reduce((sum, item) => sum + getItemVoteCount(item), 0);
}

export function getPriorityScore(cluster: Cluster) {
  return cluster.request_count * 3 + getClusterVoteTotal(cluster) * 2 + cluster.total_comments;
}

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "priority", label: "Priority" },
  { key: "requests", label: "Requests" },
  { key: "votes", label: "Votes" },
  { key: "comments", label: "Comments" },
];
