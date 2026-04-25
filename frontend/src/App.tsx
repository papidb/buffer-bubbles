import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect, useMemo, useRef, useState } from "react";
import clustersData from "./data/clusters.json";
import { AboutModal } from "@/components/about-modal";
import { AppHeader } from "@/components/app-header";
import { BubbleChart } from "@/components/bubble-chart";
import { ClusterDetailPanel } from "@/components/cluster-detail-panel";
import { ClusterList } from "@/components/cluster-list";
import { DashboardHero } from "@/components/dashboard-hero";
import { MetricCard } from "@/components/metric-card";
import { getClusterVoteTotal, getPriorityScore } from "@/lib/cluster-utils";
import type { Cluster, ClusterStatus, Metric, SortKey, ViewMode } from "@/types/clusters";

type DriverInstance = ReturnType<typeof driver>;

export default function BufferFeatureClustersUI() {
  const ABOUT_MODAL_STORAGE_KEY = "buffer-bubbles-about-seen";
  const [clusters] = useState(clustersData as Cluster[]);
  const [search, setSearch] = useState("");
  const [boardFilters, setBoardFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [metric, setMetric] = useState<Metric>("requests");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [activeClusterId, setActiveClusterId] = useState(clustersData[0]?.cluster_id ?? null);
  const [showAbout, setShowAbout] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(ABOUT_MODAL_STORAGE_KEY);
  });
  const driverRef = useRef<DriverInstance | null>(null);

  const boards = useMemo(() => Array.from(new Set(clusters.flatMap((c) => c.boards))).sort(), [clusters]);

  const statuses = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c: Cluster) => c.statuses.map(([status]: ClusterStatus) => String(status))))).sort();
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clusters.filter((cluster: Cluster) => {
      const matchesSearch = !q || [cluster.category, ...cluster.representative_titles, ...cluster.items.map((item) => item.summary)].join(" ").toLowerCase().includes(q);
      const matchesBoard = boardFilters.length === 0 || boardFilters.some((board) => cluster.boards.includes(board));
      const matchesStatus = statusFilters.length === 0 || cluster.statuses.some(([status]) => statusFilters.includes(String(status)));
      return matchesSearch && matchesBoard && matchesStatus;
    });
  }, [clusters, search, boardFilters, statusFilters]);

  const activeCluster = useMemo(() => {
    return filteredClusters.find((c) => c.cluster_id === activeClusterId) ?? filteredClusters[0] ?? null;
  }, [filteredClusters, activeClusterId]);

  const totals = useMemo(() => {
    return filteredClusters.reduce(
      (acc, cluster: Cluster) => {
        acc.requests += cluster.request_count;
        acc.votes += getClusterVoteTotal(cluster);
        acc.comments += cluster.total_comments;
        return acc;
      },
      { requests: 0, votes: 0, comments: 0 }
    );
  }, [filteredClusters]);

  const sortedClusters = useMemo(() => {
    const accessor = (c: Cluster) => {
      switch (sortKey) {
        case "requests":
          return c.request_count;
        case "votes":
          return getClusterVoteTotal(c);
        case "comments":
          return c.total_comments;
        case "priority":
        default:
          return getPriorityScore(c);
      }
    };

    return [...filteredClusters].sort((a, b) => accessor(b) - accessor(a));
  }, [filteredClusters, sortKey]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  const dismissAbout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ABOUT_MODAL_STORAGE_KEY, "true");
    }

    setShowAbout(false);
  };

  const startTour = () => {
    const previousViewMode = viewMode;
    const nextActiveClusterId = activeCluster?.cluster_id ?? filteredClusters[0]?.cluster_id ?? null;

    driverRef.current?.destroy();
    driverRef.current = null;

    dismissAbout();
    setViewMode("chart");

    if (nextActiveClusterId !== null) {
      setActiveClusterId(nextActiveClusterId);
    }

    const tour = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: "rgba(15, 23, 42, 0.55)",
      overlayOpacity: 0.55,
      stagePadding: 14,
      stageRadius: 24,
      popoverClass: "buffer-bubbles-tour-popover",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      onDestroyed: () => {
        driverRef.current = null;

        if (previousViewMode !== "chart") {
          setViewMode(previousViewMode);
        }
      },
      steps: [
        {
          element: "#tour-search",
          popover: {
            title: "Search",
            description: "Search across all clusters by category, title, or request summary.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-filters",
          popover: {
            title: "Filters",
            description: "Filter by board or status to narrow the view.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-view-toggle",
          popover: {
            title: "Views",
            description: "Switch between the bubble chart and a priority-sorted list.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-controls",
          popover: {
            title: "Sizing and sorting",
            description: "Change how bubbles are sized or how the list is sorted.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-metrics",
          popover: {
            title: "Live metrics",
            description: "Live counts that update as you filter.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "#tour-chart",
          popover: {
            title: "Bubble chart",
            description: "Explore clusters visually. Click a bubble to select it, scroll to zoom, drag to pan.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#tour-detail",
          popover: {
            title: "Detail panel",
            description: "Inspect the selected cluster. See priority, stats, and the original requests with links back to Buffer.",
            side: "left",
            align: "start",
          },
        },
      ],
    });

    driverRef.current = tour;
    window.setTimeout(() => {
      driverRef.current?.drive();
    }, 120);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader onAbout={() => setShowAbout(true)} onTour={startTour} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <DashboardHero
            search={search}
            onSearchChange={setSearch}
            boards={boards}
            statuses={statuses}
            boardFilters={boardFilters}
            statusFilters={statusFilters}
            onBoardFiltersChange={setBoardFilters}
            onStatusFiltersChange={setStatusFilters}
            metric={metric}
            onMetricChange={setMetric}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
          />

          <div id="tour-metrics" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard label="Visible clusters" value={filteredClusters.length} muted />
            <MetricCard label="Requests in view" value={totals.requests} />
            <MetricCard label="Votes / comments" value={`${totals.votes} / ${totals.comments}`} muted />
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <div id="tour-chart" className="h-[70vh] min-h-[560px] w-full self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {viewMode === "chart" ? (
              <BubbleChart
                data={clusters}
                activeId={activeCluster?.cluster_id}
                onSelect={(d) => setActiveClusterId(d.cluster_id)}
                search={search}
                boardFilters={boardFilters}
                statusFilters={statusFilters}
                metric={metric}
              />
            ) : (
              <ClusterList
                clusters={sortedClusters}
                activeId={activeCluster?.cluster_id}
                onSelect={(d) => setActiveClusterId(d.cluster_id)}
                sortKey={sortKey}
              />
            )}
          </div>

          <ClusterDetailPanel activeCluster={activeCluster} />
        </div>
      </div>

      <AboutModal show={showAbout} onClose={dismissAbout} onTakeTour={startTour} />
    </div>
  );
}
