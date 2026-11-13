"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  GitBranch,
  Info,
  Link2,
  Network,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiDisclosure } from "@/components/shared/ai-disclosure";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { MockDataBadge } from "@/components/shared/demo-notices";
import { CategoryBadge } from "@/components/shared/status-badges";
import { getIncidentGraph, listIncidents } from "@/lib/api";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import type { GraphEdge, IncidentCategory } from "@/lib/types/api";
import {
  RELATIONSHIP_META,
  categoryMeta,
  type RelationshipKind,
} from "@/lib/utils/categories";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";

type PatternNodeData = {
  label: string;
  category: IncidentCategory;
  root: boolean;
};

type PatternNode = Node<PatternNodeData, "pattern">;

const HANDLE_SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

function PatternGraphNode({ data, selected }: NodeProps<PatternNode>) {
  const meta = categoryMeta(data.category);
  return (
    <div
      className={cn(
        "w-[196px] rounded-xl border bg-card px-3.5 py-3 text-left shadow-[0_6px_20px_-12px_rgba(11,18,16,0.35)] transition-shadow",
        data.root
          ? "border-primary/60 ring-2 ring-primary/15"
          : "border-border",
        selected && "ring-2 ring-ring/40",
      )}
    >
      {HANDLE_SIDES.map(({ id, position }) => (
        <React.Fragment key={id}>
          <Handle
            id={`target-${id}`}
            type="target"
            position={position}
            className="!size-1.5 !border-0 !bg-transparent"
          />
          <Handle
            id={`source-${id}`}
            type="source"
            position={position}
            className="!size-1.5 !border-0 !bg-transparent"
          />
        </React.Fragment>
      ))}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {data.root ? "This incident" : "Related incident"}
        </span>
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", meta.dotClassName)}
        />
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-foreground">
        {data.label}
      </p>
      <p className="mt-1.5 text-[10px] text-muted-foreground">{meta.label}</p>
    </div>
  );
}

const NODE_TYPES = { pattern: PatternGraphNode };

const KIND_STROKE: Record<RelationshipKind, string> = {
  suggested: "#8a6a24",
  user_reported: "#0f5a4e",
};

type HandleSide = (typeof HANDLE_SIDES)[number]["id"];

const OPPOSITE_SIDE: Record<HandleSide, HandleSide> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

function handleSideFor(
  from: { x: number; y: number },
  to: { x: number; y: number },
): HandleSide {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function buildGraphElements(
  rootId: string,
  nodes: { id: string; label: string; category: IncidentCategory }[],
  edges: GraphEdge[],
) {
  const root = nodes.find((node) => node.id === rootId);
  const related = nodes.filter((node) => node.id !== rootId);
  const radius = related.length <= 4 ? 240 : related.length <= 8 ? 290 : 340;

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootId, { x: 0, y: 0 });
  related.forEach((node, index) => {
    const angle = (index / Math.max(1, related.length)) * Math.PI * 2 - Math.PI / 2;
    positions.set(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.78,
    });
  });

  const flowNodes: PatternNode[] = nodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      type: "pattern",
      position,
      data: {
        label: node.label,
        category: node.category,
        root: node.id === rootId,
      },
      draggable: false,
      connectable: false,
      selectable: true,
      ariaLabel: `${node.label}${node.id === rootId ? ", this incident" : ""}`,
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => {
    const meta = RELATIONSHIP_META[edge.relationship];
    const stroke = KIND_STROKE[meta.kind];
    const sourcePosition = positions.get(edge.source) ?? { x: 0, y: 0 };
    const targetPosition = positions.get(edge.target) ?? { x: 0, y: 0 };
    const sourceSide = handleSideFor(sourcePosition, targetPosition);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: `source-${sourceSide}`,
      targetHandle: `target-${OPPOSITE_SIDE[sourceSide]}`,
      type: "smoothstep",
      label: meta.short,
      animated: meta.kind === "suggested",
      style: {
        stroke,
        strokeWidth: meta.kind === "user_reported" ? 1.8 : 1.4,
        strokeDasharray: meta.kind === "suggested" ? "6 4" : undefined,
      },
      labelStyle: {
        fill: "#3f4a46",
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: "#ffffff",
        fillOpacity: 0.94,
      },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 14,
        height: 14,
      },
      data: { kind: meta.kind },
    };
  });

  return {
    nodes: flowNodes,
    edges: flowEdges,
    rootFound: Boolean(root),
  };
}

export function PatternGraphView() {
  const incidentsQuery = useAsyncData(
    () => listIncidents({ limit: 100 }),
    "patterns-incidents",
  );
  const [incidentId, setIncidentId] = React.useState("");
  const searchParams = useSearchParams();
  const requestedIncidentId =
    incidentId || searchParams.get("incident") || "";
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);

  const incidents = incidentsQuery.data?.items ?? [];
  const incident =
    incidents.find((item) => item.id === requestedIncidentId) ?? incidents[0];
  const effectiveIncidentId = incident?.id ?? "";

  const graphQuery = useAsyncData(
    () => getIncidentGraph(effectiveIncidentId),
    `pattern-graph-${effectiveIncidentId}`,
    Boolean(effectiveIncidentId),
  );

  const graph = graphQuery.data;

  const elements = React.useMemo(() => {
    if (!graph) return null;
    return buildGraphElements(graph.incident_id, graph.nodes, graph.edges);
  }, [graph]);

  const selectedEdge =
    graph?.edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const relationshipCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    graph?.edges.forEach((edge) => {
      counts.set(edge.relationship, (counts.get(edge.relationship) ?? 0) + 1);
    });
    return Array.from(counts.entries());
  }, [graph]);

  const userReportedCount =
    graph?.edges.filter(
      (edge) => RELATIONSHIP_META[edge.relationship].kind === "user_reported",
    ).length ?? 0;
  const suggestedCount = (graph?.edges.length ?? 0) - userReportedCount;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="PatternGraph"
        title="Explainable relationships"
        description="See how your incidents connect. User-reported links and suggested content similarities are shown differently, with the reason for every connection."
        actions={<MockDataBadge />}
      />

      {incidentsQuery.error ? (
        <ErrorState
          title="Incidents could not be loaded"
          message={incidentsQuery.error}
          onRetry={incidentsQuery.refresh}
        />
      ) : incidentsQuery.loading && !incidentsQuery.data ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-[520px] animate-pulse rounded-lg bg-muted/40" />
          </CardContent>
        </Card>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<Network className="size-5" />}
          title="Create incidents to see patterns"
          description="PatternGraph compares incidents you own. Add at least two records, then return here to explore their relationships."
          action={
            <Button asChild size="sm">
              <Link href="/incidents/new">Create an incident</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <label
                  htmlFor="pattern-incident"
                  className="text-xs font-medium text-foreground"
                >
                  Incident
                </label>
                <Select
                  value={effectiveIncidentId}
                  onValueChange={(value) => {
                    setIncidentId(value);
                    setSelectedEdgeId(null);
                  }}
                >
                  <SelectTrigger id="pattern-incident" className="sm:max-w-md">
                    <SelectValue placeholder="Choose an incident" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidents.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {incident ? (
                  <p className="text-[11px] text-muted-foreground">
                    {pluralize(graph?.edges.length ?? 0, "relationship")} ·{" "}
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open incident
                    </Link>
                  </p>
                ) : null}
              </div>
              {graph ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-[#c9e2d3] bg-[#f1f7f3] text-[#1a5c3d]"
                  >
                    <span className="size-1.5 rounded-full bg-[#1c6b47]" />
                    {pluralize(userReportedCount, "user-reported link")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-[#ecd9b4] bg-[#fbf5e9] text-[#74500a]"
                  >
                    <span className="size-1.5 rounded-full bg-[#8a6a24]" />
                    {pluralize(suggestedCount, "suggestion")}
                  </Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {graphQuery.error ? (
            <ErrorState
              title="The relationship graph could not be loaded"
              message={graphQuery.error}
              onRetry={graphQuery.refresh}
            />
          ) : graphQuery.loading && !graph ? (
            <Card>
              <CardContent className="p-5">
                <div className="h-[520px] animate-pulse rounded-lg bg-muted/40" />
              </CardContent>
            </Card>
          ) : !graph || graph.edges.length === 0 || !elements ? (
            <EmptyState
              icon={<ShieldQuestion className="size-5" />}
              title="No relationships recorded for this incident"
              description="There are no user-reported links or content suggestions involving this record yet. Related events are only shown when the API returns an explanation for the connection."
              className="min-h-[320px]"
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle>Relationship map</CardTitle>
                  <CardDescription>
                    Select a connection to read its explanation. The layout is
                    illustrative; distance does not indicate strength.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative h-[540px] w-full bg-[#fbfaf6]">
                    <ReactFlow
                      nodes={elements.nodes}
                      edges={elements.edges}
                      nodeTypes={NODE_TYPES}
                      onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
                      onPaneClick={() => setSelectedEdgeId(null)}
                      fitView
                      fitViewOptions={{ padding: 0.22 }}
                      minZoom={0.35}
                      maxZoom={1.4}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      edgesFocusable
                      elementsSelectable
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background
                        variant={BackgroundVariant.Dots}
                        gap={22}
                        size={1}
                        color="#d9d6cb"
                      />
                      <Controls
                        showInteractive={false}
                        className="!rounded-lg !border !border-border !bg-card !shadow-sm"
                      />
                      <MiniMap
                        pannable
                        zoomable
                        className="!rounded-lg !border !border-border !bg-card"
                        nodeColor={(node) =>
                          categoryMeta(
                            (node.data as PatternNodeData).category,
                          ).dotClassName.includes("bg-muted-foreground")
                            ? "#8a938f"
                            : "#0f5a4e"
                        }
                        maskColor="rgba(246, 245, 240, 0.72)"
                      />
                      <Panel
                        position="top-left"
                        className="rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground shadow-sm backdrop-blur"
                      >
                        <span className="mr-3 inline-flex items-center gap-1.5">
                          <span className="h-px w-4 bg-[#0f5a4e]" />
                          User-reported
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-px w-4 border-t border-dashed border-[#8a6a24]" />
                          Suggested
                        </span>
                      </Panel>
                    </ReactFlow>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {selectedEdge ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md border",
                            RELATIONSHIP_META[selectedEdge.relationship].kind ===
                              "user_reported"
                              ? "border-[#c9e2d3] bg-[#f1f7f3] text-[#1a5c3d]"
                              : "border-[#ecd9b4] bg-[#fbf5e9] text-[#74500a]",
                          )}
                        >
                          <Link2 className="size-3.5" />
                        </span>
                        <CardTitle className="text-sm">
                          {RELATIONSHIP_META[selectedEdge.relationship].label}
                        </CardTitle>
                      </div>
                      <CardDescription>
                        {RELATIONSHIP_META[selectedEdge.relationship].kind ===
                        "user_reported"
                          ? "You recorded this connection."
                          : "Suggested from content or contact indicators."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm leading-relaxed text-foreground/90">
                        {selectedEdge.explanation}
                      </p>
                      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Confidence
                        </p>
                        <p className="mt-0.5 text-sm font-medium">
                          {selectedEdge.confidence === null
                            ? "Not provided"
                            : `${Math.round(selectedEdge.confidence * 100)}%`}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {selectedEdge.confidence === null
                            ? "The API did not return a confidence value for this link."
                            : "A model or matching score, not a calibrated probability. A high score does not prove a shared person."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[selectedEdge.source, selectedEdge.target].map((id) => {
                          const node = graph.nodes.find((item) => item.id === id);
                          if (!node) return null;
                          return (
                            <Button
                              key={id}
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-auto max-w-full justify-start py-1.5 text-left"
                            >
                              <Link href={`/incidents/${node.id}`}>
                                <ChevronRight className="size-3.5 shrink-0" />
                                <span className="truncate">{node.label}</span>
                              </Link>
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">How to read this</CardTitle>
                      <CardDescription>
                        Connections are explainable suggestions or records you
                        made — not findings of fact.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2.5">
                        <span className="mt-1 h-px w-6 shrink-0 bg-[#0f5a4e]" />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Solid links
                          </span>{" "}
                          are user-reported: the same identifier, or an event you
                          explicitly marked as related.
                        </p>
                      </div>
                      <div className="flex gap-2.5">
                        <span className="mt-1 w-6 shrink-0 border-t border-dashed border-[#8a6a24]" />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Dashed links
                          </span>{" "}
                          are suggested from similar content or a repeated contact
                          pattern.
                        </p>
                      </div>
                      <div className="flex gap-2.5">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Select any connection to read the explanation and
                          confidence. Suggested links do not establish that two
                          incidents involve the same person.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Relationships</CardTitle>
                    <CardDescription>
                      {pluralize(graph.edges.length, "connection")} for this
                      incident.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {relationshipCounts.map(([relationship, count]) => {
                      const meta =
                        RELATIONSHIP_META[
                          relationship as keyof typeof RELATIONSHIP_META
                        ];
                      if (!meta) return null;
                      return (
                        <div
                          key={relationship}
                          className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{meta.label}</p>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                              {meta.kind === "user_reported"
                                ? "User-reported"
                                : "Suggested"}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {count}
                          </Badge>
                        </div>
                      );
                    })}
                    <div className="space-y-1.5 border-t border-border pt-3">
                      {graph.edges.map((edge) => {
                        const meta = RELATIONSHIP_META[edge.relationship];
                        return (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => setSelectedEdgeId(edge.id)}
                            className={cn(
                              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px]",
                              edge.id === selectedEdgeId
                                ? "bg-secondary"
                                : "hover:bg-muted/60",
                            )}
                          >
                            <GitBranch className="size-3 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">
                              {meta?.short ?? edge.relationship}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {edge.confidence === null
                                ? "—"
                                : `${Math.round(edge.confidence * 100)}%`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#e2d7bb] bg-[#fbf7ee]">
                  <CardContent className="space-y-2 p-4 text-[#6d5420]">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <Sparkles className="size-3.5" />
                      Suggested, not proven
                    </p>
                    <p className="text-[11px] leading-relaxed text-[#6d5420]/90">
                      PatternGraph links are based on the content and identifiers
                      in your records. They are informational and do not
                      establish identity, intent or a shared offender.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {incident ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <CategoryBadge category={incident.category} />
              <span>{incident.title}</span>
              <span aria-hidden="true">·</span>
              <Link
                href={`/incidents/${incident.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                View incident record
              </Link>
            </div>
          ) : null}

          <AiDisclosure variant="graph" sample={isMockApiEnabled} />
        </>
      )}
    </div>
  );
}
