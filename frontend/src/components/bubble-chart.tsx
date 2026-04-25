import { getClusterVoteTotal } from "@/lib/cluster-utils";
import type {
  BubbleNode,
  Cluster,
  ClusterItem,
  Metric,
} from "@/types/clusters";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

type BubbleChartProps = {
  data: Cluster[];
  activeId?: Cluster["cluster_id"];
  onSelect: (cluster: Cluster) => void;
  search: string;
  boardFilters: string[];
  statusFilters: string[];
  metric: Metric;
};

export function BubbleChart({
  data,
  activeId,
  onSelect,
  search,
  boardFilters,
  statusFilters,
  metric,
}: BubbleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<BubbleNode[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const renderRef = useRef<(() => void) | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    HTMLCanvasElement,
    unknown
  > | null>(null);
  const lastLayoutKeyRef = useRef<string>("");
  const hoveredIdRef = useRef<Cluster["cluster_id"] | null>(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [hoveredNode, setHoveredNode] = useState<BubbleNode | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((cluster: Cluster) => {
      const matchesSearch =
        !q ||
        [
          cluster.category,
          ...cluster.representative_titles,
          ...cluster.items.map((item: ClusterItem) => item.summary),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesBoard =
        boardFilters.length === 0 ||
        boardFilters.some((board) => cluster.boards.includes(board));
      const matchesStatus =
        statusFilters.length === 0 ||
        cluster.statuses.some(([status]) =>
          statusFilters.includes(String(status)),
        );

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
    const radius = d3.scaleSqrt().domain([0, maxValue]).range([18, 112]);

    const nodes: BubbleNode[] = filtered.map((d: Cluster) => ({
      ...d,
      radius: radius(valueAccessor(d)),
      x: width / 2,
      y: height / 2,
    }));

    const boardDomain = Array.from(
      new Set(data.flatMap((cluster: Cluster) => cluster.boards)),
    ).sort();
    const getBoardKey = (cluster: Cluster) => cluster.boards[0] || "other";

    const color = d3
      .scaleOrdinal<string, string>()
      .domain(boardDomain)
      .range(["#4f46e5", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e"]);

    const simulation = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX<BubbleNode>(width / 2).strength(0.08))
      .force("y", d3.forceY<BubbleNode>(height / 2).strength(0.08))
      .force(
        "charge",
        d3
          .forceManyBody<BubbleNode>()
          .strength((d) => -Math.max(18, d.radius * 1.15)),
      )
      .force(
        "collision",
        d3.forceCollide<BubbleNode>((d) => d.radius + 6).strength(1),
      )
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
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );

    const contentPadding = 88;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const fitScale = Math.min(
      1,
      (width - contentPadding * 2) / contentWidth,
      (height - contentPadding * 2) / contentHeight,
    );
    const fitTransform = d3.zoomIdentity
      .translate(
        width / 2 - ((bounds.minX + bounds.maxX) / 2) * fitScale,
        height / 2 - ((bounds.minY + bounds.maxY) / 2) * fitScale,
      )
      .scale(fitScale);

    const layoutKey = `${size.width}x${size.height}:${metric}:${filtered.map((cluster) => cluster.cluster_id).join(",")}`;
    if (lastLayoutKeyRef.current !== layoutKey) {
      lastLayoutKeyRef.current = layoutKey;
      transformRef.current = fitTransform;

      if (canvasRef.current && zoomBehaviorRef.current) {
        d3.select(canvasRef.current).call(
          zoomBehaviorRef.current.transform,
          fitTransform,
        );
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

    const legendData = [...boardDomain.map((board) => [board, board] as const)];

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
        ctx.shadowColor = isActive
          ? "rgba(15,23,42,0.28)"
          : isHovered
            ? "rgba(79,70,229,0.28)"
            : "rgba(15,23,42,0.15)";
        ctx.shadowBlur = isActive ? 28 : isHovered ? 24 : 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = isActive ? 14 : 10;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.strokeStyle = isActive
          ? "#0f172a"
          : isHovered
            ? "rgba(15,23,42,0.7)"
            : "white";
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
          ctx.fillText(
            `${valueAccessor(node)} ${metric}`,
            node.x,
            node.y + node.radius * 0.52,
          );
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
  }, [filtered, size, activeId, metric, data]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
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
    <div
      ref={wrapperRef}
      className="relative h-full w-full overflow-hidden p-3"
    >
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
          <div className="text-sm font-semibold text-slate-900">
            {hoveredNode.category}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {hoveredNode.request_count} requests ·{" "}
            {getClusterVoteTotal(hoveredNode)} votes ·{" "}
            {hoveredNode.total_comments} comments
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {hoveredNode.boards.join(", ")}
          </div>
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
