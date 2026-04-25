import * as d3 from "d3";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Filter, HelpCircle, Info, Layers3, MessageSquare, Search, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import clustersData from "./data/clusters.json";

type Cluster = (typeof clustersData)[number];
type ClusterItem = Cluster["items"][number];
type ClusterStatus = Cluster["statuses"][number];
type Metric = "requests" | "votes" | "comments";
type ViewMode = "chart" | "list";
type SortKey = "priority" | "requests" | "votes" | "comments";

type BubbleNode = Cluster &
  d3.SimulationNodeDatum & {
    radius: number;
    x: number;
    y: number;
  };

type BubbleChartProps = {
  data: Cluster[];
  activeId?: Cluster["cluster_id"];
  onSelect: (cluster: Cluster) => void;
  search: string;
  boardFilters: string[];
  statusFilters: string[];
  metric: Metric;
};

type MetricCardProps = {
  label: string;
  value: string | number;
  muted?: boolean;
};

type AboutModalProps = {
  show: boolean;
  onClose: () => void;
  onTakeTour: () => void;
};

type DriverInstance = ReturnType<typeof driver>;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getPriorityScore(cluster: Cluster) {
  return cluster.request_count * 3 + getClusterVoteTotal(cluster) * 2 + cluster.total_comments;
}

function getItemVoteCount(item: ClusterItem) {
  if (typeof item.votes === "number" && item.votes > 0) return item.votes;

  const match = item.summary.match(/What's New\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function getClusterVoteTotal(cluster: Cluster) {
  if (typeof cluster.total_votes === "number" && cluster.total_votes > 0) {
    return cluster.total_votes;
  }

  return cluster.items.reduce((sum, item) => sum + getItemVoteCount(item), 0);
}

function BubbleChart({ data, activeId, onSelect, search, boardFilters, statusFilters, metric }: BubbleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<BubbleNode[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const renderRef = useRef<(() => void) | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const lastLayoutKeyRef = useRef<string>("");
  const hoveredIdRef = useRef<Cluster["cluster_id"] | null>(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [hoveredNode, setHoveredNode] = useState<BubbleNode | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((cluster: Cluster) => {
      const matchesSearch = !q || [
        cluster.category,
        ...cluster.representative_titles,
        ...cluster.items.map((item: ClusterItem) => item.summary),
      ].join(" ").toLowerCase().includes(q);

      const matchesBoard = boardFilters.length === 0 || boardFilters.some((board) => cluster.boards.includes(board));
      const matchesStatus =
        statusFilters.length === 0 ||
        cluster.statuses.some(([status]) => statusFilters.includes(String(status)));

      return matchesSearch && matchesBoard && matchesStatus;
    });
  }, [data, search, boardFilters, statusFilters]);

  useEffect(() => {
    const update = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setSize({
        width: Math.max(640, rect.width),
        height: Math.max(560, Math.min(760, window.innerHeight - 220)),
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const getNodeAtPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const x = transformRef.current.invertX(screenX);
    const y = transformRef.current.invertY(screenY);

    for (let i = nodesRef.current.length - 1; i >= 0; i -= 1) {
      const node = nodesRef.current[i];
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.hypot(dx, dy) < node.radius) return node;
    }

    return null;
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = size.width;
    const height = size.height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const valueAccessor = (d: Cluster) => {
      switch (metric) {
        case "votes":
          return getClusterVoteTotal(d) || 1;
        case "comments":
          return d.total_comments || 1;
        case "requests":
        default:
          return d.request_count || 1;
      }
    };

    const maxValue = d3.max(filtered, valueAccessor) || 1;
    const radius = d3
      .scaleSqrt()
      .domain([0, maxValue])
      .range([18, 112]);

    const nodes: BubbleNode[] = filtered.map((d: Cluster) => ({
      ...d,
      radius: radius(valueAccessor(d)),
      x: width / 2,
      y: height / 2,
    }));

    const boardDomain = Array.from(new Set(data.flatMap((cluster: Cluster) => cluster.boards))).sort();
    const getBoardKey = (cluster: Cluster) => cluster.boards[0] || "other";

    const color = d3.scaleOrdinal<string, string>()
      .domain(boardDomain)
      .range(["#4f46e5", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e"]);

    const simulation = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX<BubbleNode>(width / 2).strength(0.08))
      .force("y", d3.forceY<BubbleNode>(height / 2).strength(0.08))
      .force("charge", d3.forceManyBody<BubbleNode>().strength((d) => -Math.max(18, d.radius * 1.15)))
      .force("collision", d3.forceCollide<BubbleNode>((d) => d.radius + 6).strength(1))
      .stop();

    for (let i = 0; i < 320; i += 1) simulation.tick();
    nodesRef.current = nodes;

    const bounds = nodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.x - node.radius),
        maxX: Math.max(acc.maxX, node.x + node.radius),
        minY: Math.min(acc.minY, node.y - node.radius),
        maxY: Math.max(acc.maxY, node.y + node.radius),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const contentPadding = 88;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const fitScale = Math.min(
      1,
      (width - contentPadding * 2) / contentWidth,
      (height - contentPadding * 2) / contentHeight
    );
    const fitTransform = d3.zoomIdentity
      .translate(
        width / 2 - ((bounds.minX + bounds.maxX) / 2) * fitScale,
        height / 2 - ((bounds.minY + bounds.maxY) / 2) * fitScale
      )
      .scale(fitScale);

    const layoutKey = `${size.width}x${size.height}:${metric}:${filtered.map((cluster) => cluster.cluster_id).join(",")}`;
    if (lastLayoutKeyRef.current !== layoutKey) {
      lastLayoutKeyRef.current = layoutKey;
      transformRef.current = fitTransform;

      if (canvasRef.current && zoomBehaviorRef.current) {
        d3.select(canvasRef.current).call(zoomBehaviorRef.current.transform, fitTransform);
      }
    }

    const getWrappedLines = (text: string, maxWidth: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current: string[] = [];

      words.forEach((word: string) => {
        const trial = [...current, word].join(" ");
        const tooWide = ctx.measureText(trial).width > maxWidth;

        if (tooWide && current.length) {
          lines.push(current.join(" "));
          current = [word];
        } else {
          current.push(word);
        }
      });

      if (current.length) lines.push(current.join(" "));

      return lines.slice(0, 3);
    };

    const legendData = [
      ...boardDomain.map((board) => [board, board] as const),
    ];

    renderRef.current = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      nodes.forEach((node: BubbleNode) => {
        const fill = color(getBoardKey(node));
        const labelFontSize = Math.max(11, Math.min(20, node.radius / 3.8));
        const showCategoryLabel = node.radius >= 34;
        const showMetricLabel = node.radius >= 52;
        const isActive = node.cluster_id === activeId;
        const isHovered = node.cluster_id === hoveredIdRef.current;

        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.globalAlpha = isActive ? 0.95 : isHovered ? 0.88 : 0.78;
        ctx.shadowColor = isActive ? "rgba(15,23,42,0.28)" : isHovered ? "rgba(79,70,229,0.28)" : "rgba(15,23,42,0.15)";
        ctx.shadowBlur = isActive ? 28 : isHovered ? 24 : 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = isActive ? 14 : 10;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.strokeStyle = isActive ? "#0f172a" : isHovered ? "rgba(15,23,42,0.7)" : "white";
        ctx.lineWidth = isActive ? 3.5 : isHovered ? 2.5 : 2;
        ctx.stroke();
        ctx.restore();

        if (isHovered && !isActive) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(79,70,229,0.35)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        if (showCategoryLabel) {
          ctx.save();
          ctx.fillStyle = "white";
          ctx.font = `700 ${labelFontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";

          const lines = getWrappedLines(node.category, node.radius * 1.5);
          const lineHeight = labelFontSize * 1.12;
          const totalHeight = lines.length * lineHeight;
          const startY = node.y - totalHeight * 0.45;

          lines.forEach((line: string, idx: number) => {
            ctx.fillText(line, node.x, startY + idx * lineHeight);
          });
          ctx.restore();
        }

        if (showMetricLabel) {
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = `600 ${Math.max(11, Math.min(14, node.radius / 6))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(`${valueAccessor(node)} ${metric}`, node.x, node.y + node.radius * 0.52);
          ctx.restore();
        }
      });

      ctx.restore();

      legendData.forEach(([key, label], idx: number) => {
        const rowY = 18 + idx * 24;

        ctx.save();
        ctx.beginPath();
        ctx.arc(25, rowY + 7, 7, 0, Math.PI * 2);
        ctx.fillStyle = color(key);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "#334155";
        ctx.font = "600 12px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(label, 40, rowY + 11);
        ctx.restore();
      });
    };

    renderRef.current();
  }, [filtered, size, activeId, onSelect, metric]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        renderRef.current?.();
      });

    zoomBehaviorRef.current = zoomBehavior;

    d3.select(canvas).call(zoomBehavior);

    return () => {
      zoomBehaviorRef.current = null;
      d3.select(canvas).on(".zoom", null);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative h-full w-full overflow-hidden p-3">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onClick={(event) => {
          const node = getNodeAtPoint(event.clientX, event.clientY);
          if (node) onSelect(node);
        }}
        onMouseMove={(event) => {
          if (!canvasRef.current) return;
          const node = getNodeAtPoint(event.clientX, event.clientY);
          canvasRef.current.style.cursor = node ? "pointer" : "default";

          const nextHoveredId = node?.cluster_id ?? null;
          if (hoveredIdRef.current !== nextHoveredId) {
            hoveredIdRef.current = nextHoveredId;
            renderRef.current?.();
          }

          if (!wrapperRef.current || !node) {
            setHoveredNode(null);
            return;
          }

          const rect = wrapperRef.current.getBoundingClientRect();
          setHoveredNode(node);
          setHoverPosition({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }}
        onMouseLeave={() => {
          if (!canvasRef.current) return;
          canvasRef.current.style.cursor = "default";
          if (hoveredIdRef.current !== null) {
            hoveredIdRef.current = null;
            renderRef.current?.();
          }
          setHoveredNode(null);
        }}
      />
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
          style={{
            left: Math.min(hoverPosition.x + 16, size.width - 260),
            top: Math.max(hoverPosition.y - 16, 16),
          }}
        >
          <div className="text-sm font-semibold text-slate-900">{hoveredNode.category}</div>
          <div className="mt-1 text-xs text-slate-600">
            {hoveredNode.request_count} requests · {getClusterVoteTotal(hoveredNode)} votes · {hoveredNode.total_comments} comments
          </div>
          <div className="mt-1 text-xs text-slate-500">{hoveredNode.boards.join(", ")}</div>
        </div>
      )}
      {filtered.length === 0 && (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">
          No clusters match the current filters.
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, muted = false }: MetricCardProps) {
  return (
    <div className={classNames(
      "rounded-2xl border p-4 shadow-sm",
      muted ? "border-slate-200 bg-white" : "border-slate-900 bg-slate-900 text-white"
    )}>
      <div className={classNames("text-xs font-semibold uppercase tracking-[0.18em]", muted ? "text-slate-500" : "text-slate-300")}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function AboutModal({ show, onClose, onTakeTour }: AboutModalProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-buffer-bubbles-title"
            className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <Info className="h-3.5 w-3.5" />
                  About Buffer Bubbles
                </div>
                <h2 id="about-buffer-bubbles-title" className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Why this project exists
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600 sm:text-[15px]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What it does</div>
                <p className="mt-2">
                  Buffer Bubbles turns public Buffer suggestion boards into an interactive map of feature demand so repeated themes are easier to spot than they are in a long chronological list of posts.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How clustering works</div>
                <p className="mt-2">
                  The pipeline collects public requests, cleans the text, groups semantically similar ideas into clusters, and then rolls up the evidence behind each theme with request counts, votes, comments, boards, and statuses.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How to use the UI</div>
                <p className="mt-2">
                  Search or filter the dataset, switch between the bubble chart and the ranked list, change the sizing or sorting controls, and select a cluster to inspect the original Buffer requests linked in the detail panel.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={onTakeTour}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <HelpCircle className="h-4 w-4" />
                Take a tour
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "priority", label: "Priority" },
  { key: "requests", label: "Requests" },
  { key: "votes", label: "Votes" },
  { key: "comments", label: "Comments" },
];

function ClusterList({
  clusters,
  activeId,
  onSelect,
  sortKey,
}: {
  clusters: Cluster[];
  activeId?: Cluster["cluster_id"];
  onSelect: (cluster: Cluster) => void;
  sortKey: SortKey;
}) {
  return (
    <div className="h-full w-full overflow-y-auto p-3" style={{ scrollbarGutter: "stable" }}>
      {clusters.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          No clusters match the current filters.
        </div>
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
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
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
                      className={classNames(
                        "rounded-xl border px-3 py-2",
                        isActive ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                      )}
                    >
                      <div className={classNames("text-[11px] font-semibold uppercase tracking-[0.16em]", isActive ? "text-slate-300" : "text-slate-500")}>
                        {label}
                      </div>
                      <div className={classNames("mt-1 text-base font-bold", isActive ? "text-white" : "text-slate-900")}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {cluster.boards.map((board) => (
                    <span
                      key={board}
                      className={classNames(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        isActive ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {board}
                    </span>
                  ))}
                  {cluster.statuses.slice(0, 2).map(([status, count]) => (
                    <span
                      key={status}
                      className={classNames(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        isActive ? "bg-emerald-400/15 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                      )}
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

export default function BufferFeatureClustersUI() {
  const ABOUT_MODAL_STORAGE_KEY = "buffer-bubbles-about-seen";
  const [clusters] = useState(clustersData);
  const [search, setSearch] = useState("");
  const [boardFilters, setBoardFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [metric, setMetric] = useState<Metric>("requests");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [activeClusterId, setActiveClusterId] = useState(clustersData[0]?.cluster_id ?? null);
  const [showAbout, setShowAbout] = useState(false);
  const driverRef = useRef<DriverInstance | null>(null);

  const boards = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c) => c.boards))).sort();
  }, [clusters]);

  const statuses = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c: Cluster) => c.statuses.map(([status]: ClusterStatus) => String(status))))).sort();
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clusters.filter((cluster: Cluster) => {
      const matchesSearch = !q || [
        cluster.category,
        ...cluster.representative_titles,
        ...cluster.items.map((item: ClusterItem) => item.summary),
      ].join(" ").toLowerCase().includes(q);

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
        case "requests": return c.request_count;
        case "votes": return getClusterVoteTotal(c);
        case "comments": return c.total_comments;
        case "priority":
        default: return getPriorityScore(c);
      }
    };
    return [...filteredClusters].sort((a, b) => accessor(b) - accessor(a));
  }, [filteredClusters, sortKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasSeenAbout = window.localStorage.getItem(ABOUT_MODAL_STORAGE_KEY);
    if (!hasSeenAbout) {
      setShowAbout(true);
      window.localStorage.setItem(ABOUT_MODAL_STORAGE_KEY, "true");
    }
  }, []);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  const startTour = () => {
    const previousViewMode = viewMode;
    const nextActiveClusterId = activeCluster?.cluster_id ?? filteredClusters[0]?.cluster_id ?? null;

    driverRef.current?.destroy();
    driverRef.current = null;

    setShowAbout(false);
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
      <style>{`
        .buffer-bubbles-tour-popover.driver-popover {
          max-width: 22rem;
          border: 1px solid rgb(226 232 240);
          border-radius: 1.5rem;
          background: rgba(15, 23, 42, 0.98);
          color: rgb(248 250 252);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
        }

        .buffer-bubbles-tour-popover .driver-popover-title {
          color: rgb(255 255 255);
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .buffer-bubbles-tour-popover .driver-popover-description {
          color: rgb(203 213 225);
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .buffer-bubbles-tour-popover .driver-popover-footer {
          margin-top: 1rem;
          border-top: 1px solid rgba(148, 163, 184, 0.2);
          padding-top: 0.9rem;
        }

        .buffer-bubbles-tour-popover .driver-popover-progress-text {
          color: rgb(148 163 184);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .buffer-bubbles-tour-popover .driver-popover-prev-btn,
        .buffer-bubbles-tour-popover .driver-popover-next-btn {
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          color: rgb(241 245 249);
          font-weight: 600;
          text-shadow: none;
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        .buffer-bubbles-tour-popover .driver-popover-next-btn {
          background: rgb(255 255 255);
          border-color: rgb(255 255 255);
          color: rgb(15 23 42);
        }

        .buffer-bubbles-tour-popover .driver-popover-prev-btn:hover,
        .buffer-bubbles-tour-popover .driver-popover-next-btn:hover {
          filter: none;
          box-shadow: none;
        }

        .buffer-bubbles-tour-popover .driver-popover-prev-btn:hover {
          background: rgba(255, 255, 255, 0.16);
        }

        .buffer-bubbles-tour-popover .driver-popover-next-btn:hover {
          background: rgb(241 245 249);
        }

        .buffer-bubbles-tour-popover .driver-popover-close-btn {
          color: rgb(203 213 225);
        }

        .buffer-bubbles-tour-popover .driver-popover-close-btn:hover {
          color: rgb(255 255 255);
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    <Layers3 className="h-3.5 w-3.5" />
                    Feature request intelligence
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAbout(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    <Info className="h-3.5 w-3.5" />
                    About
                  </button>

                  <button
                    type="button"
                    onClick={startTour}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Take a tour
                  </button>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Interactive view of aggregated Buffer feature requests
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                  Each bubble is a request cluster. Bigger bubbles indicate stronger demand. Click a bubble to inspect the
                  actual requests grouped under that theme.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div id="tour-search" className="relative xl:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories, titles, or summaries"
                  className="pl-10"
                />
              </div>

              <div id="tour-filters" className="grid gap-3 md:grid-cols-2 xl:col-span-2">
                <MultiSelect
                  options={boards}
                  placeholder="All boards"
                  selected={boardFilters}
                  onChange={setBoardFilters}
                />

                <MultiSelect
                  options={statuses}
                  placeholder="All statuses"
                  selected={statusFilters}
                  onChange={setStatusFilters}
                />
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
                  onClick={() => setViewMode(key as ViewMode)}
                  className={classNames(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    viewMode === key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                      onClick={() => setMetric(key as Metric)}
                      className={classNames(
                        "rounded-full px-4 py-2 text-sm font-semibold transition",
                        metric === key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                      onClick={() => setSortKey(key)}
                      className={classNames(
                        "rounded-full px-4 py-2 text-sm font-semibold transition",
                        sortKey === key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      Sort by {label.toLowerCase()}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

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

          <div id="tour-detail" className="h-[70vh] min-h-[560px] self-start overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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
                    <MetricCard label="Requests" value={activeCluster.request_count} muted />
                    <MetricCard label="Votes" value={getClusterVoteTotal(activeCluster)} muted />
                    <MetricCard label="Comments" value={activeCluster.total_comments} muted />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {activeCluster.boards.map((board) => (
                      <span key={board} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {board}
                      </span>
                    ))}
                    {activeCluster.statuses.map(([status, count]: ClusterStatus) => (
                      <span key={status} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
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
                      {activeCluster.items.map((item: ClusterItem) => (
                        <a
                          key={item.url}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                              <div className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</div>
                            </div>
                            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                            <span>{item.board}</span>
                            <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {getItemVoteCount(item)}</span>
                            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {item.comments ?? 0}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.status || "unknown"}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-[400px] items-center justify-center text-sm text-slate-500">
                  Select a bubble to inspect the grouped feature requests.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <AboutModal show={showAbout} onClose={() => setShowAbout(false)} onTakeTour={startTour} />
    </div>
  );
}
