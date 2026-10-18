"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type GraphNode = {
  id: string;
  label: string;
  title: string;
  kind: "endorsed" | "amber" | "orphan";
};

export type GraphEdge = {
  from: string;
  to: string;
  /** sealed payload backlink vs soft tag affinity */
  kind?: "link" | "affinity";
};

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

export type GraphDetail = {
  title: string;
  body: string;
  label: string;
  nid: string;
  href: string;
};

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  className?: string;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  /** Persistent selection card inside the graph stage (avoids clipping below). */
  detail?: GraphDetail | null;
};

const COLORS = {
  endorsed: "#1d4ed8",
  amber: "#b45309",
  orphan: "#94a3b8",
  edge: "rgba(15, 23, 42, 0.22)",
  edgeAffinity: "rgba(15, 23, 42, 0.1)",
  edgeHot: "rgba(29, 78, 216, 0.55)",
  label: "rgba(15, 23, 42, 0.72)",
  bg: "#f8fafc",
};

function hashAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

function shortLabel(label: string) {
  const raw = label.replace(/^\[synthetic\]\s*/i, "").trim();
  return raw.length > 18 ? `${raw.slice(0, 16)}…` : raw;
}

export function ObsidianGraph({
  nodes,
  edges,
  className,
  onSelect,
  selectedId,
  detail,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const nodeMapRef = useRef(new Map<string, SimNode>());
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const selectedRef = useRef(selectedId ?? null);
  const detailRef = useRef(detail ?? null);
  const edgesRef = useRef(edges);
  const edgeIndexRef = useRef(new Map<string, Set<string>>());
  const orderedEdgesRef = useRef<GraphEdge[]>([]);
  const dimsRef = useRef({ w: 800, h: 420 });
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const visibleRef = useRef(true);
  const dirtyRef = useRef(true);
  const energyFramesRef = useRef(0);
  const [hover, setHover] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 420 });

  selectedRef.current = selectedId ?? null;
  detailRef.current = detail ?? null;
  edgesRef.current = edges;

  const edgeIndex = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.from)) m.set(e.from, new Set());
      if (!m.has(e.to)) m.set(e.to, new Set());
      m.get(e.from)!.add(e.to);
      m.get(e.to)!.add(e.from);
    }
    return m;
  }, [edges]);

  edgeIndexRef.current = edgeIndex;

  const orderedEdges = useMemo(
    () =>
      [...edges].sort(
        (a, b) => Number(a.kind === "link") - Number(b.kind === "link"),
      ),
    [edges],
  );
  orderedEdgesRef.current = orderedEdges;

  // Init / sync sim nodes when graph data changes
  useEffect(() => {
    const { w, h } = dims;
    const cx = w / 2;
    const cy = h / 2;
    const prev = new Map(simRef.current.map((n) => [n.id, n]));
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    }

    const next = nodes.map((n, i) => {
      const old = prev.get(n.id);
      const deg = degree.get(n.id) ?? 0;
      const r = 6.5 + Math.min(12, deg * 1.8);
      if (old) return { ...n, x: old.x, y: old.y, vx: old.vx, vy: old.vy, r };
      const a =
        hashAngle(n.id) + i * ((Math.PI * 2) / Math.max(nodes.length, 1));
      const rad = 90 + (i % 5) * 36;
      return {
        ...n,
        x: cx + Math.cos(a) * rad,
        y: cy + Math.sin(a) * rad * 0.85,
        vx: 0,
        vy: 0,
        r,
      };
    });
    simRef.current = next;
    nodeMapRef.current = new Map(next.map((n) => [n.id, n]));
    energyFramesRef.current = 0;
    dirtyRef.current = true;
    wake();
  }, [nodes, edges, dims.w, dims.h]);

  // Fill the parent stage
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const next = {
        w: Math.max(280, Math.floor(width)),
        h: Math.max(240, Math.floor(height)),
      };
      dimsRef.current = next;
      setDims(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pause when off-screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          dirtyRef.current = true;
          wake();
        } else {
          stopLoop();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Redraw when selection changes without restarting physics
  useEffect(() => {
    dirtyRef.current = true;
    wake();
  }, [selectedId, detail]);

  function stopLoop() {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }

  function wake() {
    if (!visibleRef.current) return;
    if (runningRef.current) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick() {
    if (!runningRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      stopLoop();
      return;
    }

    const list = simRef.current;
    const { w, h } = dimsRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const nodeMap = nodeMapRef.current;
    const dragging = Boolean(dragRef.current);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let energy = 0;
    // Physics only while settling or dragging — idle hover just paints
    const shouldSim =
      !reduceMotion && (dragging || energyFramesRef.current < 90);

    if (shouldSim) {
      energyFramesRef.current += 1;
      // Charge (repulsion)
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy;
          if (dist2 < 0.01) {
            dx = 0.4;
            dy = 0.3;
            dist2 = dx * dx + dy * dy;
          }
          const dist = Math.sqrt(dist2);
          const force = 2200 / dist2;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const e of edgesRef.current) {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const soft = e.kind === "affinity";
        const ideal = soft ? 170 : 120;
        const f = (dist - ideal) * (soft ? 0.008 : 0.016);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      const bottomPad = detailRef.current ? 150 : 36;
      for (const n of list) {
        if (dragRef.current?.id === n.id) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (cx - n.x) * 0.004;
        n.vy += (cy - n.y) * 0.004;
        n.vx *= 0.84;
        n.vy *= 0.84;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(n.r + 28, Math.min(w - n.r - 28, n.x));
        n.y = Math.max(n.r + 36, Math.min(h - n.r - bottomPad, n.y));
        energy += n.vx * n.vx + n.vy * n.vy;
      }
      dirtyRef.current = true;
    }

    if (dirtyRef.current) {
      dirtyRef.current = false;
      drawFrame(ctx, w, h, list, nodeMap);
    }

    const settled =
      !shouldSim || (!dragging && energy < 0.02 && energyFramesRef.current > 40);

    if (!visibleRef.current) {
      stopLoop();
      return;
    }

    // Sleep when settled; pointer moves call bump() to wake for a single paint
    if (dragging || !settled) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      stopLoop();
    }
  }

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    list: SimNode[],
    nodeMap: Map<string, SimNode>,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = canvasRef.current!;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Static dust (no per-frame animation)
    ctx.fillStyle = "rgba(15,23,42,0.045)";
    for (let i = 0; i < 20; i++) {
      const x = (i * 97) % w;
      const y = (i * 53) % h;
      ctx.beginPath();
      ctx.arc(x, y, i % 5 === 0 ? 1.2 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const hot = hoverRef.current ?? selectedRef.current ?? null;
    const neighbors = hot ? edgeIndexRef.current.get(hot) : null;

    for (const e of orderedEdgesRef.current) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const lit = hot && (e.from === hot || e.to === hot);
      const affinity = e.kind === "affinity";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (lit) {
        ctx.strokeStyle = COLORS.edgeHot;
        ctx.lineWidth = affinity ? 1 : 1.5;
      } else {
        ctx.strokeStyle = affinity ? COLORS.edgeAffinity : COLORS.edge;
        ctx.lineWidth = affinity ? 0.7 : 1.05;
      }
      if (affinity && !lit) ctx.setLineDash([3, 5]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const n of list) {
      const color = COLORS[n.kind];
      const isHot = hot === n.id || neighbors?.has(n.id);
      const dim = Boolean(hot && !isHot);
      const focused =
        selectedRef.current === n.id || hoverRef.current === n.id;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = dim ? 0.28 : 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (focused) {
        ctx.strokeStyle = "rgba(15,23,42,0.75)";
        ctx.lineWidth = 1.75;
        ctx.stroke();
      }
    }

    const showAllLabels =
      activeRef.current ||
      Boolean(hoverRef.current) ||
      Boolean(selectedRef.current);
    if (showAllLabels) {
      const focusId = hoverRef.current ?? selectedRef.current;
      for (const n of list) {
        const text = shortLabel(n.label);
        const focused = n.id === focusId;
        const faded = Boolean(hot && hot !== n.id && !neighbors?.has(n.id));
        ctx.font = focused
          ? "650 12px Outfit, system-ui, sans-serif"
          : "600 10.5px Outfit, system-ui, sans-serif";
        const tw = ctx.measureText(text).width;
        const padX = focused ? 7 : 5;
        const padY = focused ? 4 : 3;
        const bx = n.x - tw / 2 - padX;
        const by = n.y + n.r + 6;
        const bw = tw + padX * 2;
        const bh = (focused ? 12 : 11) + padY * 2;
        ctx.globalAlpha = focused ? 1 : faded ? 0.45 : 0.92;
        ctx.fillStyle = focused
          ? "rgba(255,255,255,0.96)"
          : "rgba(248,250,252,0.88)";
        ctx.strokeStyle = focused
          ? "rgba(15,23,42,0.18)"
          : "rgba(15,23,42,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = focused ? "rgba(15,23,42,0.88)" : COLORS.label;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, n.x, by + bh / 2);
        ctx.globalAlpha = 1;
        ctx.textBaseline = "alphabetic";
      }
    }
  }

  // kick initial loop once canvas mounts
  useEffect(() => {
    dimsRef.current = dims;
    dirtyRef.current = true;
    wake();
    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.w, dims.h]);

  function hitTest(mx: number, my: number): SimNode | null {
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (const n of simRef.current) {
      const d = (n.x - mx) ** 2 + (n.y - my) ** 2;
      if (d < (n.r + 8) ** 2 && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  function localPos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function bump() {
    dirtyRef.current = true;
    energyFramesRef.current = Math.min(energyFramesRef.current, 30);
    wake();
  }

  const hoverNode = hover ? nodes.find((n) => n.id === hover) : null;
  const showHoverCard = hoverNode && hoverNode.id !== selectedId;

  return (
    <div ref={wrapRef} className={`graph-stage ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onPointerEnter={() => {
          activeRef.current = true;
          bump();
        }}
        onPointerDown={(e) => {
          activeRef.current = true;
          const { x, y } = localPos(e);
          const hit = hitTest(x, y);
          if (hit) {
            dragRef.current = { id: hit.id, ox: x - hit.x, oy: y - hit.y };
            onSelect?.(hit.id);
            canvasRef.current?.setPointerCapture(e.pointerId);
          } else {
            onSelect?.(null);
          }
          bump();
        }}
        onPointerMove={(e) => {
          activeRef.current = true;
          const { x, y } = localPos(e);
          if (dragRef.current) {
            const n = nodeMapRef.current.get(dragRef.current.id);
            if (n) {
              n.x = x - dragRef.current.ox;
              n.y = y - dragRef.current.oy;
              n.vx = 0;
              n.vy = 0;
            }
            bump();
            return;
          }
          const hit = hitTest(x, y);
          const id = hit?.id ?? null;
          if (id !== hoverRef.current) {
            hoverRef.current = id;
            setHover(id);
            bump();
          }
        }}
        onPointerUp={() => {
          dragRef.current = null;
          bump();
        }}
        onPointerLeave={() => {
          dragRef.current = null;
          activeRef.current = false;
          hoverRef.current = null;
          setHover(null);
          bump();
        }}
      />
      <div className="graph-chrome">
        <div className="graph-legend">
          <span>
            <i className="dot leaf" /> endorsed
          </span>
          <span>
            <i className="dot amber" /> unreviewed
          </span>
          <span>solid = backlink · dashed = tag</span>
          <span>drag · hover · click</span>
        </div>
        <div className="graph-chrome-bottom">
          {showHoverCard && (
            <div className="graph-tooltip">
              <p className="text-sm font-semibold text-[var(--ink)]">
                {hoverNode.title}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[var(--mute)]">
                {hoverNode.id}
              </p>
            </div>
          )}
          {detail && (
            <div className="graph-detail">
              <span
                className={`d-chip ${detail.label === "endorsed" ? "ok" : "warn"}`}
              >
                {detail.label}
              </span>
              <h3 className="graph-detail-title">{detail.title}</h3>
              <p className="graph-detail-body">{detail.body}</p>
              <p className="d-data">
                {detail.nid}
                <a
                  className="d-link"
                  href={detail.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on explorer →
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
