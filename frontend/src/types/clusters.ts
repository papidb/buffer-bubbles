import clustersData from "@/data/clusters.json";
import * as d3 from "d3";

export type Cluster = (typeof clustersData)[number];
export type ClusterItem = Cluster["items"][number];
export type ClusterStatus = Cluster["statuses"][number];

export type Metric = "requests" | "votes" | "comments";
export type ViewMode = "chart" | "list";
export type SortKey = "priority" | "requests" | "votes" | "comments";

export type BubbleNode = Cluster &
  d3.SimulationNodeDatum & {
    radius: number;
    x: number;
    y: number;
  };

