import * as d3 from "d3";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Filter, Layers3, MessageSquare, Search, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const sampleData = {
  clusters: [
    {
      cluster_id: 1,
      category: "WhatsApp publishing and group support",
      request_count: 18,
      total_votes: 264,
      total_comments: 41,
      boards: ["feature suggestions", "new channel requests"],
      statuses: [["open", 10], ["under review", 8]],
      representative_titles: [
        "Support posting to WhatsApp groups",
        "Allow WhatsApp business publishing",
        "Schedule updates for WhatsApp communities"
      ],
      representative_urls: [
        "https://suggestions.buffer.com/example/whatsapp-groups",
        "https://suggestions.buffer.com/example/whatsapp-business",
        "https://suggestions.buffer.com/example/whatsapp-communities"
      ],
      items: [
        {
          title: "Support posting to WhatsApp groups",
          summary: "Users want Buffer to support publishing to WhatsApp groups and not just individual destinations.",
          url: "https://suggestions.buffer.com/example/whatsapp-groups",
          board: "new channel requests",
          status: "open",
          votes: 91,
          comments: 16,
        },
        {
          title: "Allow WhatsApp business publishing",
          summary: "People want WhatsApp as a supported publishing channel with native scheduling.",
          url: "https://suggestions.buffer.com/example/whatsapp-business",
          board: "feature suggestions",
          status: "under review",
          votes: 103,
          comments: 12,
        },
        {
          title: "Schedule updates for WhatsApp communities",
          summary: "Users describe WhatsApp communities as a team communication destination and want scheduled publishing.",
          url: "https://suggestions.buffer.com/example/whatsapp-communities",
          board: "feature suggestions",
          status: "open",
          votes: 70,
          comments: 13,
        }
      ]
    },
    {
      cluster_id: 2,
      category: "Analytics / reporting / attribution",
      request_count: 14,
      total_votes: 210,
      total_comments: 31,
      boards: ["feature suggestions", "buffer api"],
      statuses: [["open", 9], ["planned", 5]],
      representative_titles: [
        "Better campaign attribution in reports",
        "Custom report exports with filters",
        "API access for engagement analytics"
      ],
      representative_urls: [
        "https://suggestions.buffer.com/example/attribution",
        "https://suggestions.buffer.com/example/export-filters",
        "https://suggestions.buffer.com/example/api-analytics"
      ],
      items: [
        {
          title: "Better campaign attribution in reports",
          summary: "Users want to understand what content led to clicks and conversions more clearly.",
          url: "https://suggestions.buffer.com/example/attribution",
          board: "feature suggestions",
          status: "planned",
          votes: 96,
          comments: 11,
        },
        {
          title: "Custom report exports with filters",
          summary: "Teams want exportable reports with segment, channel, and date filtering.",
          url: "https://suggestions.buffer.com/example/export-filters",
          board: "feature suggestions",
          status: "open",
          votes: 64,
          comments: 9,
        },
        {
          title: "API access for engagement analytics",
          summary: "Developers want API endpoints for reporting and engagement metrics.",
          url: "https://suggestions.buffer.com/example/api-analytics",
          board: "buffer api",
          status: "open",
          votes: 50,
          comments: 11,
        }
      ]
    },
    {
      cluster_id: 3,
      category: "Approval flows / permissions / collaboration",
      request_count: 11,
      total_votes: 158,
      total_comments: 29,
      boards: ["feature suggestions"],
      statuses: [["open", 7], ["in progress", 4]],
      representative_titles: [
        "Granular approval workflows by team",
        "Require review before publishing",
        "Role based permissions for drafts"
      ],
      representative_urls: [
        "https://suggestions.buffer.com/example/approval-flows",
        "https://suggestions.buffer.com/example/review-before-publish",
        "https://suggestions.buffer.com/example/role-permissions"
      ],
      items: [
        {
          title: "Granular approval workflows by team",
          summary: "Agencies want approval chains based on team structure and account ownership.",
          url: "https://suggestions.buffer.com/example/approval-flows",
          board: "feature suggestions",
          status: "open",
          votes: 78,
          comments: 13,
        },
        {
          title: "Require review before publishing",
          summary: "Users want to enforce review states before content can go live.",
          url: "https://suggestions.buffer.com/example/review-before-publish",
          board: "feature suggestions",
          status: "in progress",
          votes: 46,
          comments: 8,
        },
        {
          title: "Role based permissions for drafts",
          summary: "Teams want finer editing and publishing permission controls.",
          url: "https://suggestions.buffer.com/example/role-permissions",
          board: "feature suggestions",
          status: "in progress",
          votes: 34,
          comments: 8,
        }
      ]
    },
    {
      cluster_id: 4,
      category: "Instagram / reels / stories publishing",
      request_count: 9,
      total_votes: 124,
      total_comments: 17,
      boards: ["feature suggestions", "new channel requests"],
      statuses: [["open", 5], ["planned", 4]],
      representative_titles: [
        "Schedule Instagram story posts",
        "Better reel publishing options",
        "Multi asset posting for Instagram"
      ],
      representative_urls: [
        "https://suggestions.buffer.com/example/instagram-stories",
        "https://suggestions.buffer.com/example/reels-options",
        "https://suggestions.buffer.com/example/multi-asset-instagram"
      ],
      items: [
        {
          title: "Schedule Instagram story posts",
          summary: "Creators want story scheduling to be more complete and less reminder based.",
          url: "https://suggestions.buffer.com/example/instagram-stories",
          board: "feature suggestions",
          status: "planned",
          votes: 55,
          comments: 5,
        },
        {
          title: "Better reel publishing options",
          summary: "Users want more flexible reel publishing support and previews.",
          url: "https://suggestions.buffer.com/example/reels-options",
          board: "feature suggestions",
          status: "open",
          votes: 41,
          comments: 7,
        },
        {
          title: "Multi asset posting for Instagram",
          summary: "People want improved handling for mixed media post types and scheduling.",
          url: "https://suggestions.buffer.com/example/multi-asset-instagram",
          board: "new channel requests",
          status: "open",
          votes: 28,
          comments: 5,
        }
      ]
    },
    {
      cluster_id: 5,
      category: "Bulk scheduling / calendar / recurring posts",
      request_count: 13,
      total_votes: 139,
      total_comments: 19,
      boards: ["feature suggestions", "buffer api"],
      statuses: [["open", 8], ["under review", 5]],
      representative_titles: [
        "Recurring post templates",
        "Bulk reschedule from calendar",
        "API for mass queue management"
      ],
      representative_urls: [
        "https://suggestions.buffer.com/example/recurring-templates",
        "https://suggestions.buffer.com/example/bulk-reschedule",
        "https://suggestions.buffer.com/example/api-queue"
      ],
      items: [
        {
          title: "Recurring post templates",
          summary: "Users want content templates and recurring scheduling for evergreen content.",
          url: "https://suggestions.buffer.com/example/recurring-templates",
          board: "feature suggestions",
          status: "open",
          votes: 63,
          comments: 7,
        },
        {
          title: "Bulk reschedule from calendar",
          summary: "Teams want drag and drop and multi select operations to reschedule many posts fast.",
          url: "https://suggestions.buffer.com/example/bulk-reschedule",
          board: "feature suggestions",
          status: "under review",
          votes: 42,
          comments: 6,
        },
        {
          title: "API for mass queue management",
          summary: "Developers want queue and schedule updates in batch through the API.",
          url: "https://suggestions.buffer.com/example/api-queue",
          board: "buffer api",
          status: "open",
          votes: 34,
          comments: 6,
        }
      ]
    }
  ]
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getPriorityScore(cluster) {
  return cluster.request_count * 3 + cluster.total_votes * 2 + cluster.total_comments;
}

function BubbleChart({ data, activeId, onSelect, search, boardFilter, statusFilter, metric }) {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 620 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((cluster) => {
      const matchesSearch = !q || [
        cluster.category,
        ...cluster.representative_titles,
        ...cluster.items.map((item) => item.summary),
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

  useEffect(() => {
    if (!svgRef.current) return;

    const width = size.width;
    const height = size.height;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const valueAccessor = (d) => {
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

    const radius = d3
      .scaleSqrt()
      .domain([0, d3.max(filtered, valueAccessor) || 1])
      .range([28, 95]);

    const nodes = filtered.map((d) => ({
      ...d,
      radius: radius(valueAccessor(d)),
      x: width / 2,
      y: height / 2,
    }));

    const categoryGroup = (name) => {
      const lower = name.toLowerCase();
      if (lower.includes("whatsapp") || lower.includes("instagram")) return "channel";
      if (lower.includes("analytics") || lower.includes("report")) return "analytics";
      if (lower.includes("approval") || lower.includes("permission") || lower.includes("collaboration")) return "workflow";
      if (lower.includes("calendar") || lower.includes("scheduling") || lower.includes("queue") || lower.includes("recurring")) return "scheduling";
      return "other";
    };

    const centers = {
      analytics: { x: width * 0.28, y: height * 0.34 },
      channel: { x: width * 0.72, y: height * 0.34 },
      workflow: { x: width * 0.28, y: height * 0.72 },
      scheduling: { x: width * 0.72, y: height * 0.72 },
      other: { x: width * 0.5, y: height * 0.5 },
    };

    const color = d3.scaleOrdinal()
      .domain(["analytics", "channel", "workflow", "scheduling", "other"])
      .range(["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"]);

    const simulation = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX((d) => centers[categoryGroup(d.category)].x).strength(0.12))
      .force("y", d3.forceY((d) => centers[categoryGroup(d.category)].y).strength(0.12))
      .force("charge", d3.forceManyBody().strength(4))
      .force("collision", d3.forceCollide((d) => d.radius + 4).strength(1))
      .stop();

    for (let i = 0; i < 260; i += 1) simulation.tick();

    const g = svg.append("g");

    const node = g
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (_, d) => onSelect(d));

    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => color(categoryGroup(d.category)))
      .attr("fill-opacity", (d) => (d.cluster_id === activeId ? 0.95 : 0.78))
      .attr("stroke", (d) => (d.cluster_id === activeId ? "#0f172a" : "white"))
      .attr("stroke-width", (d) => (d.cluster_id === activeId ? 3 : 2))
      .attr("filter", "drop-shadow(0px 10px 20px rgba(15,23,42,0.15))");

    node
      .append("text")
      .text((d) => d.category)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .style("fontSize", (d) => `${Math.max(10, Math.min(16, d.radius / 4))}px`)
      .style("fontWeight", 700)
      .style("pointer-events", "none")
      .each(function (d) {
        const self = d3.select(this);
        const words = d.category.split(/\s+/);
        const maxWidth = d.radius * 1.6;
        const lines = [];
        let current = [];

        words.forEach((word) => {
          const trial = [...current, word].join(" ");
          const test = self.append("tspan").text(trial).style("visibility", "hidden");
          const tooWide = test.node().getComputedTextLength() > maxWidth;
          test.remove();

          if (tooWide && current.length) {
            lines.push(current.join(" "));
            current = [word];
          } else {
            current.push(word);
          }
        });

        if (current.length) lines.push(current.join(" "));

        self.text(null);
        lines.slice(0, 3).forEach((line, idx) => {
          self
            .append("tspan")
            .attr("x", 0)
            .attr("dy", idx === 0 ? "-0.3em" : "1.15em")
            .text(line);
        });
      });

    node
      .append("text")
      .attr("y", (d) => d.radius * 0.56)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.92)")
      .style("fontSize", "12px")
      .style("fontWeight", 600)
      .style("pointer-events", "none")
      .text((d) => `${valueAccessor(d)} ${metric}`);

    const legend = svg.append("g").attr("transform", `translate(18, 18)`);
    const legendData = [
      ["analytics", "Analytics"],
      ["channel", "Channels"],
      ["workflow", "Workflow"],
      ["scheduling", "Scheduling"],
      ["other", "Other"],
    ];

    legendData.forEach(([key, label], idx) => {
      const row = legend.append("g").attr("transform", `translate(0, ${idx * 24})`);
      row.append("circle").attr("r", 7).attr("cx", 7).attr("cy", 7).attr("fill", color(key));
      row.append("text")
        .attr("x", 22)
        .attr("y", 11)
        .attr("fill", "#334155")
        .style("fontSize", "12px")
        .style("fontWeight", 600)
        .text(label);
    });
  }, [filtered, size, activeId, onSelect, metric]);

  return (
    <div ref={wrapperRef} className="w-full rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <svg ref={svgRef} className="h-[70vh] min-h-[560px] w-full" />
      {filtered.length === 0 && (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">
          No clusters match the current filters.
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, muted }) {
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
  const [clusters] = useState(sampleData.clusters);
  const [search, setSearch] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [metric, setMetric] = useState("requests");
  const [activeCluster, setActiveCluster] = useState(sampleData.clusters[0]);

  const boards = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c) => c.boards))).sort();
  }, [clusters]);

  const statuses = useMemo(() => {
    return Array.from(new Set(clusters.flatMap((c) => c.statuses.map(([status]) => status)))).sort();
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clusters.filter((cluster) => {
      const matchesSearch = !q || [
        cluster.category,
        ...cluster.representative_titles,
        ...cluster.items.map((item) => item.summary),
      ].join(" ").toLowerCase().includes(q);

      const matchesBoard = boardFilter === "all" || cluster.boards.includes(boardFilter);
      const matchesStatus = statusFilter === "all" || cluster.statuses.some(([status]) => status === statusFilter);
      return matchesSearch && matchesBoard && matchesStatus;
    });
  }, [clusters, search, boardFilter, statusFilter]);

  useEffect(() => {
    if (!activeCluster || !filteredClusters.some((c) => c.cluster_id === activeCluster.cluster_id)) {
      setActiveCluster(filteredClusters[0] || null);
    }
  }, [filteredClusters, activeCluster]);

  const totals = useMemo(() => {
    return filteredClusters.reduce(
      (acc, cluster) => {
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
                  onClick={() => setMetric(key)}
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
            onSelect={setActiveCluster}
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
                    {activeCluster.statuses.map(([status, count]) => (
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
