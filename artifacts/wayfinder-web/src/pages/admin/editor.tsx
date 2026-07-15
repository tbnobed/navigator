import { useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadUrl } from "@/lib/sites";
import {
  siteIsNavigable,
  type StoredSite,
  type StoredSiteNode,
  type StoredNodeKind,
} from "@/lib/siteTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Upload,
  Ruler,
  MousePointer2,
  DoorOpen,
  CircleDot,
  MapPin,
  Spline,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "select" | "entrance" | "junction" | "poi" | "connect" | "delete" | "scale";

const TOOLS: { id: Tool; icon: typeof MousePointer2; label: string; hint: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select", hint: "Click a point to edit its details." },
  { id: "entrance", icon: DoorOpen, label: "Entrance", hint: "Click the map where an entrance QR poster will hang." },
  { id: "junction", icon: CircleDot, label: "Waypoint", hint: "Click along corridors to add path waypoints." },
  { id: "poi", icon: MapPin, label: "Destination", hint: "Click the map to add a destination visitors can pick." },
  { id: "connect", icon: Spline, label: "Connect", hint: "Click two points to connect them with a walkable path." },
  { id: "delete", icon: Trash2, label: "Delete", hint: "Click a point or a path line to remove it." },
  { id: "scale", icon: Ruler, label: "Scale", hint: "Click both ends of a known distance (e.g. a corridor), then enter its length in meters." },
];

const NODE_COLORS: Record<StoredNodeKind, string> = {
  entrance: "#16a34a",
  junction: "#64748b",
  poi: "#2563eb",
};

let nodeCounter = 0;
function newNodeId(kind: StoredNodeKind, existing: StoredSiteNode[]): string {
  const prefix = kind === "entrance" ? "entrance" : kind === "poi" ? "dest" : "wp";
  for (;;) {
    const id = `${prefix}-${++nodeCounter}`;
    if (!existing.some((n) => n.id === id)) return id;
  }
}

export default function AdminEditor() {
  const [, params] = useRoute("/admin/site/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const siteId = params?.id ?? "";

  const [draft, setDraft] = useState<StoredSite | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [scalePoints, setScalePoints] = useState<{ px: number; py: number }[]>([]);
  const [scaleMeters, setScaleMeters] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["admin-site", siteId],
    queryFn: async () => {
      const data = await api<{ site: StoredSite }>(`/admin/sites/${siteId}`);
      setDraft(data.site);
      setDirty(false);
      return data.site;
    },
    enabled: !!siteId,
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    mutationFn: (site: StoredSite) =>
      api<{ site: StoredSite }>(`/admin/sites/${siteId}`, {
        method: "PUT",
        body: JSON.stringify(site),
      }),
    onSuccess: (data) => {
      setDraft(data.site);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["admin-sites"] });
      queryClient.invalidateQueries({ queryKey: ["public-sites"] });
      toast({ title: "Saved", description: "Site saved successfully." });
    },
    onError: (err) =>
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }),
  });

  const update = (patch: Partial<StoredSite>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  const updateNode = (id: string, patch: Partial<StoredSiteNode>) => {
    setDraft((d) =>
      d ? { ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) } : d,
    );
    setDirty(true);
  };

  const removeNode = (id: string) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            nodes: d.nodes.filter((n) => n.id !== id),
            edges: d.edges.filter((e) => e.a !== id && e.b !== id),
          }
        : d,
    );
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  };

  const handleUpload = async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    try {
      const { imageFile } = await api<{ imageFile: string }>(`/admin/sites/${siteId}/image`, {
        method: "POST",
        body: form,
      });
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Could not read image"));
        img.src = uploadUrl(imageFile);
      });
      update({ imageFile, imageWidth: dims.w, imageHeight: dims.h });
      toast({ title: "Floor plan uploaded", description: "Now set the scale, then draw your map. Don't forget to save." });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const svgPoint = (e: React.MouseEvent): { px: number; py: number } | null => {
    const svg = svgRef.current;
    if (!svg || !draft) return null;
    const rect = svg.getBoundingClientRect();
    return {
      px: Math.round(((e.clientX - rect.left) / rect.width) * draft.imageWidth),
      py: Math.round(((e.clientY - rect.top) / rect.height) * draft.imageHeight),
    };
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (!draft) return;
    const pt = svgPoint(e);
    if (!pt) return;

    if (tool === "entrance" || tool === "junction" || tool === "poi") {
      const kind = tool as StoredNodeKind;
      const node: StoredSiteNode = {
        id: newNodeId(kind, draft.nodes),
        px: pt.px,
        py: pt.py,
        kind,
        ...(kind === "entrance" ? { label: "Entrance", facingBearing: 0 } : {}),
        ...(kind === "poi" ? { label: "", category: "Destination" } : {}),
      };
      update({ nodes: [...draft.nodes, node] });
      setSelectedId(node.id);
      if (kind !== "junction") setTool("select");
    } else if (tool === "scale") {
      const next = [...scalePoints, pt].slice(-2);
      setScalePoints(next);
    } else {
      setSelectedId(null);
      setConnectFrom(null);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, node: StoredSiteNode) => {
    e.stopPropagation();
    if (!draft) return;
    if (tool === "delete") {
      removeNode(node.id);
    } else if (tool === "connect") {
      if (!connectFrom) {
        setConnectFrom(node.id);
      } else if (connectFrom !== node.id) {
        const exists = draft.edges.some(
          (ed) =>
            (ed.a === connectFrom && ed.b === node.id) ||
            (ed.b === connectFrom && ed.a === node.id),
        );
        if (!exists) update({ edges: [...draft.edges, { a: connectFrom, b: node.id }] });
        setConnectFrom(node.id);
      }
    } else {
      setSelectedId(node.id);
      if (tool !== "select") setTool("select");
    }
  };

  const applyScale = () => {
    if (scalePoints.length !== 2 || !draft) return;
    const meters = parseFloat(scaleMeters);
    if (!(meters > 0)) return;
    const [a, b] = scalePoints;
    const pixels = Math.hypot(b.px - a.px, b.py - a.py);
    if (pixels < 2) return;
    update({ metersPerPixel: meters / pixels });
    setScalePoints([]);
    setScaleMeters("");
    setTool("select");
    toast({ title: "Scale set", description: `1 pixel = ${(meters / pixels).toFixed(4)} m` });
  };

  const validation = useMemo(() => (draft ? siteIsNavigable(draft) : null), [draft]);
  const selected = draft?.nodes.find((n) => n.id === selectedId) ?? null;

  if (query.isLoading || !draft) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">
          {query.isError ? "Site not found or not signed in." : "Loading site..."}
        </p>
      </div>
    );
  }

  const vw = draft.imageWidth || 1;
  const vh = draft.imageHeight || 1;
  const r = Math.max(vw, vh) / 90; // node radius in image px
  const activeTool = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground safe-area-pt safe-area-pb flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 bg-card sticky top-0 z-20">
        <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setLocation("/admin")} data-testid="button-back-admin">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-10 rounded-xl font-bold text-lg border-transparent hover:border-input focus:border-input px-2"
            data-testid="input-site-name"
          />
          <p className="text-xs text-muted-foreground px-2 mt-0.5">
            Site code: <span className="font-mono font-semibold">{draft.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 mr-1">
            <Label htmlFor="published" className="text-sm">Published</Label>
            <Switch
              id="published"
              checked={draft.published}
              disabled={!draft.published && !(validation?.ok ?? false)}
              onCheckedChange={(v) => update({ published: v })}
              data-testid="switch-published"
            />
          </div>
          <Button onClick={() => draft && save.mutate(draft)} disabled={!dirty || save.isPending} className="rounded-xl" data-testid="button-save-site">
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Saving..." : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Map area */}
        <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
          {!draft.imageFile ? (
            <div className="flex-1 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-10 text-center">
              <Upload className="w-10 h-10 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">Upload a floor plan</h2>
              <p className="text-muted-foreground mb-6 max-w-sm">
                A PNG, JPEG or WebP image of the floor. You'll then mark entrances, destinations and
                walkable paths on it.
              </p>
              <Button onClick={() => fileRef.current?.click()} data-testid="button-upload-floorplan">
                <Upload className="w-4 h-4 mr-2" /> Choose image
              </Button>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap gap-1 bg-card border rounded-2xl p-1.5 items-center">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors",
                      tool === t.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                    onClick={() => {
                      setTool(t.id);
                      setConnectFrom(null);
                      if (t.id !== "scale") setScalePoints([]);
                    }}
                    data-testid={`tool-${t.id}`}
                  >
                    <t.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
                <div className="ml-auto pr-2">
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1.5" /> Replace image
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground px-1">
                {tool === "connect" && connectFrom
                  ? "Now click the next point to connect. Keep clicking to chain a path."
                  : activeTool.hint}
              </p>

              {tool === "scale" && (
                <div className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                  <span className="text-sm font-medium">
                    {scalePoints.length < 2
                      ? `Click ${2 - scalePoints.length} more point${scalePoints.length === 1 ? "" : "s"} on the map...`
                      : "Real distance between the two points:"}
                  </span>
                  {scalePoints.length === 2 && (
                    <>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={scaleMeters}
                        onChange={(e) => setScaleMeters(e.target.value)}
                        placeholder="meters"
                        className="w-28 h-9 rounded-xl"
                        data-testid="input-scale-meters"
                      />
                      <Button size="sm" className="rounded-xl" onClick={applyScale} disabled={!(parseFloat(scaleMeters) > 0)} data-testid="button-apply-scale">
                        Set scale
                      </Button>
                    </>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    Current: 1 px = {draft.metersPerPixel.toFixed(4)} m
                  </span>
                </div>
              )}

              {/* Canvas */}
              <div className="border rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-900">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${vw} ${vh}`}
                  className="w-full h-auto block cursor-crosshair select-none touch-manipulation"
                  onClick={handleMapClick}
                  data-testid="svg-map-editor"
                >
                  <image href={uploadUrl(draft.imageFile)} width={vw} height={vh} />

                  {/* Edges */}
                  {draft.edges.map((edge, i) => {
                    const a = draft.nodes.find((n) => n.id === edge.a);
                    const b = draft.nodes.find((n) => n.id === edge.b);
                    if (!a || !b) return null;
                    return (
                      <line
                        key={i}
                        x1={a.px}
                        y1={a.py}
                        x2={b.px}
                        y2={b.py}
                        stroke="#2563eb"
                        strokeWidth={r * 0.45}
                        strokeLinecap="round"
                        opacity={0.75}
                        className={tool === "delete" ? "cursor-pointer" : undefined}
                        onClick={(e) => {
                          if (tool !== "delete") return;
                          e.stopPropagation();
                          update({ edges: draft.edges.filter((_, j) => j !== i) });
                        }}
                      />
                    );
                  })}

                  {/* Scale measurement line */}
                  {scalePoints.length > 0 && (
                    <>
                      {scalePoints.length === 2 && (
                        <line
                          x1={scalePoints[0].px}
                          y1={scalePoints[0].py}
                          x2={scalePoints[1].px}
                          y2={scalePoints[1].py}
                          stroke="#dc2626"
                          strokeWidth={r * 0.4}
                          strokeDasharray={`${r} ${r * 0.6}`}
                        />
                      )}
                      {scalePoints.map((p, i) => (
                        <circle key={i} cx={p.px} cy={p.py} r={r * 0.7} fill="#dc2626" />
                      ))}
                    </>
                  )}

                  {/* Nodes */}
                  {draft.nodes.map((node) => (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={(e) => handleNodeClick(e, node)}
                      data-testid={`node-${node.id}`}
                    >
                      <circle
                        cx={node.px}
                        cy={node.py}
                        r={node.kind === "junction" ? r * 0.75 : r}
                        fill={NODE_COLORS[node.kind]}
                        stroke={
                          node.id === selectedId || node.id === connectFrom ? "#f59e0b" : "white"
                        }
                        strokeWidth={node.id === selectedId || node.id === connectFrom ? r * 0.4 : r * 0.22}
                      />
                      {node.kind === "entrance" && node.facingBearing !== undefined && (
                        <line
                          x1={node.px}
                          y1={node.py}
                          x2={node.px + Math.sin((node.facingBearing * Math.PI) / 180) * r * 2.2}
                          y2={node.py - Math.cos((node.facingBearing * Math.PI) / 180) * r * 2.2}
                          stroke={NODE_COLORS.entrance}
                          strokeWidth={r * 0.3}
                          strokeLinecap="round"
                        />
                      )}
                      {node.label && node.kind !== "junction" && (
                        <text
                          x={node.px}
                          y={node.py - r * 1.5}
                          textAnchor="middle"
                          fontSize={r * 1.6}
                          fontWeight="700"
                          fill="#0f172a"
                          stroke="white"
                          strokeWidth={r * 0.25}
                          paintOrder="stroke"
                        >
                          {node.label}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: NODE_COLORS.entrance }} /> Entrance</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: NODE_COLORS.poi }} /> Destination</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: NODE_COLORS.junction }} /> Waypoint</span>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Side panel */}
        <div className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l p-4 space-y-6">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg capitalize">
                  {selected.kind === "poi" ? "Destination" : selected.kind === "junction" ? "Waypoint" : "Entrance"}
                </h3>
                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => removeNode(selected.id)} data-testid="button-delete-node">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {selected.kind !== "junction" && (
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={selected.label ?? ""}
                    onChange={(e) => updateNode(selected.id, { label: e.target.value })}
                    placeholder={selected.kind === "poi" ? "e.g. Studio A" : "e.g. Main Entrance"}
                    className="rounded-xl"
                    data-testid="input-node-label"
                  />
                </div>
              )}
              {selected.kind === "poi" && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={selected.category ?? ""}
                    onChange={(e) => updateNode(selected.id, { category: e.target.value })}
                    placeholder="e.g. Studio, Meeting Room"
                    className="rounded-xl"
                    data-testid="input-node-category"
                  />
                </div>
              )}
              {selected.kind === "entrance" && (
                <div className="space-y-2">
                  <Label>Facing direction: {selected.facingBearing ?? 0}°</Label>
                  <p className="text-xs text-muted-foreground">
                    The direction (on the map) a visitor faces right after walking in. 0° = up,
                    90° = right. Shown as the small line on the entrance dot.
                  </p>
                  <div className="flex gap-2">
                    {[0, 90, 180, 270].map((deg) => (
                      <Button
                        key={deg}
                        size="sm"
                        variant={(selected.facingBearing ?? 0) === deg ? "default" : "outline"}
                        className="rounded-xl flex-1"
                        onClick={() => updateNode(selected.id, { facingBearing: deg })}
                      >
                        {deg}°
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={359}
                    value={selected.facingBearing ?? 0}
                    onChange={(e) =>
                      updateNode(selected.id, {
                        facingBearing: Math.min(359, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <h3 className="font-bold text-foreground text-lg mb-2">How to build a map</h3>
              <ol className="list-decimal ml-4 space-y-1.5">
                <li>Upload the floor-plan image.</li>
                <li>Set the scale with a known distance.</li>
                <li>Place entrances and destinations.</li>
                <li>Add waypoints along corridors.</li>
                <li>Use Connect to draw walkable paths between points.</li>
                <li>Save, then publish when the checklist is green.</li>
              </ol>
            </div>
          )}

          {/* Validation */}
          {validation && (
            <div className="space-y-2">
              <h3 className="font-bold flex items-center gap-2">
                {validation.ok ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-600" /> Ready to publish</>
                ) : (
                  <><AlertTriangle className="w-5 h-5 text-amber-500" /> Before publishing</>
                )}
              </h3>
              {validation.ok ? (
                <p className="text-sm text-muted-foreground">
                  Every entrance can reach every destination. {draft.published ? "This site is live." : "Flip the Published switch, then save."}
                </p>
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  {validation.problems.slice(0, 6).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {draft.published && (
                <Badge className="bg-green-600 hover:bg-green-600">Published</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
