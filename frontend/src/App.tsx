import * as d3 from "d3";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Filter, Layers3, MessageSquare, Search, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clustersData from "./data/clusters.json";

type Cluster = (typeof clustersData)[number];
type ClusterItem = Cluster["items"][number];
type ClusterStatus = Cluster["statuses"][number];
type Metric = "requests" | "votes" | "comments";

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
  boardFilter: string;
  statusFilter: string;
  metric: Metric;
};

type MetricCardProps = {
  label: string;
  value: string | number;
  muted?: boolean;
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getPriorityScore(cluster: Cluster) {
  return cluster.request_count * 3 + cluster.total_votes * 2 + cluster.total_comments;
}

function BubbleChart({ data, activeId, onSelect, search, boardFilter, statusFilter, metric }: BubbleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<BubbleNode[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const renderRef = useRef<(() => void) | null>(null);
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

      const matchesBoard = boardFilter === "all" || cluster.boards.includes(boardFilter);
      const matchesStatus =
        statusFilter === "all" ||
        cluster.statuses.some(([status]) => status === statusFilter);

      return matchesSearch && matchesBoard && matchesStatus;
    });
  }, [data, search, boardFilter, statusFilter]);

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
          return d.total_votes || 1;
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
      .scaleExtent([0.6, 3])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        renderRef.current?.();
      });

    d3.select(canvas).call(zoomBehavior);

    return () => {
      d3.select(canvas).on(".zoom", null);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <canvas
        ref={canvasRef}
        className="h-[70vh] min-h-[560px] w-full"
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
            {hoveredNode.request_count} requests · {hoveredNode.total_votes} votes · {hoveredNode.total_comments} comments
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

export default function BufferFeatureClustersUI() {
  const [clusters] = useState(clustersData);
  const [search, setSearch] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [metric, setMetric] = useState<Metric>("requests");
  const [activeClusterId, setActiveClusterId] = useState(clustersData[0]?.cluster_id ?? null);

  const boards = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c) => c.boards))).sort();
  }, [clusters]);

  const statuses = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c: Cluster) => c.statuses.map(([status]: ClusterStatus) => status)))).sort();
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clusters.filter((cluster: Cluster) => {
      const matchesSearch = !q || [
        cluster.category,
        ...cluster.representative_titles,
        ...cluster.items.map((item: ClusterItem) => item.summary),
      ].join(" ").toLowerCase().includes(q);

      const matchesBoard = boardFilter === "all" || cluster.boards.includes(boardFilter);
      const matchesStatus = statusFilter === "all" || cluster.statuses.some(([status]) => status === statusFilter);
      return matchesSearch && matchesBoard && matchesStatus;
    });
  }, [clusters, search, boardFilter, statusFilter]);

  const activeCluster = useMemo(() => {
    return filteredClusters.find((c) => c.cluster_id === activeClusterId) ?? filteredClusters[0] ?? null;
  }, [filteredClusters, activeClusterId]);

  const totals = useMemo(() => {
    return filteredClusters.reduce(
      (acc, cluster: Cluster) => {
        acc.requests += cluster.request_count;
        acc.votes += cluster.total_votes;
        acc.comments += cluster.total_comments;
        return acc;
      },
      { requests: 0, votes: 0, comments: 0 }
    );
  }, [filteredClusters]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <Layers3 className="h-3.5 w-3.5" />
                  Feature request intelligence
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
              <div className="relative xl:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories, titles, or summaries"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none ring-0 transition focus:border-slate-300"
                />
              </div>

              <select
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="all">All boards</option>
                {boards.map((board) => (
                  <option key={board} value={board}>{board}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard label="Visible clusters" value={filteredClusters.length} muted />
            <MetricCard label="Requests in view" value={totals.requests} />
            <MetricCard label="Votes / comments" value={`${totals.votes} / ${totals.comments}`} muted />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <BubbleChart
            data={clusters}
            activeId={activeCluster?.cluster_id}
            onSelect={(d) => setActiveClusterId(d.cluster_id)}
            search={search}
            boardFilter={boardFilter}
            statusFilter={statusFilter}
            metric={metric}
          />

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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
                    <MetricCard label="Votes" value={activeCluster.total_votes} muted />
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
                            <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {item.votes ?? 0}</span>
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
    </div>
  );
}
