'use client'

import React, { useMemo, useEffect, useRef, useState, useCallback, memo } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force'
import { zoom, zoomIdentity, ZoomBehavior, D3ZoomEvent, ZoomTransform } from 'd3-zoom'
import { select } from 'd3-selection'
import { format } from 'date-fns'
import { FileText, Mic, Link2, ImageIcon } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import type { Memory, MemoryType } from '@/components/aether/types'

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface MemoryNode extends SimulationNodeDatum {
  id: string
  memory: Memory
  type: MemoryType
  connectionCount: number
  phase: number
}

interface MemoryLink extends SimulationLinkDatum<MemoryNode> {
  source: MemoryNode | string
  target: MemoryNode | string
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const TYPE_COLORS: Record<MemoryType, string> = {
  text: '#9D8BA7',
  voice: '#c084fc',
  link: '#67e8f9',
  image: '#86efac',
}

const TYPE_ICONS: Record<MemoryType, React.ComponentType<{ size?: number; className?: string }>> = {
  text: FileText,
  voice: Mic,
  link: Link2,
  image: ImageIcon,
}

const MAX_NODES = 500
const BG_STAR_COUNT = 180
const DRIFT_AMPLITUDE = 0.0003

/* ═══════════════════════════════════════════════════════════════
   SEEDED RANDOM
   ═══════════════════════════════════════════════════════════════ */

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/* ═══════════════════════════════════════════════════════════════
   UNION-FIND for cluster counting
   ═══════════════════════════════════════════════════════════════ */

function countClusters(nodes: MemoryNode[], links: MemoryLink[]): number {
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()

  function find(x: string): string {
    if (!parent.has(x)) {
      parent.set(x, x)
      rank.set(x, 0)
    }
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!))
    }
    return parent.get(x)!
  }

  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    const rankA = rank.get(ra) ?? 0
    const rankB = rank.get(rb) ?? 0
    if (rankA < rankB) parent.set(ra, rb)
    else if (rankA > rankB) parent.set(rb, ra)
    else {
      parent.set(rb, ra)
      rank.set(ra, rankA + 1)
    }
  }

  for (const node of nodes) find(node.id)
  for (const link of links) {
    const srcId = typeof link.source === 'string' ? link.source : (link.source as MemoryNode).id
    const tgtId = typeof link.target === 'string' ? link.target : (link.target as MemoryNode).id
    union(srcId, tgtId)
  }

  const roots = new Set<string>()
  for (const node of nodes) {
    const connected = links.some(l => {
      const sId = typeof l.source === 'string' ? l.source : (l.source as MemoryNode).id
      const tId = typeof l.target === 'string' ? l.target : (l.target as MemoryNode).id
      return sId === node.id || tId === node.id
    })
    if (connected) roots.add(find(node.id))
  }
  return roots.size
}

/* ═══════════════════════════════════════════════════════════════
   NODE RADIUS
   ═══════════════════════════════════════════════════════════════ */

function getNodeRadius(connections: number): number {
  if (connections === 0) return 4
  if (connections <= 2) return 5
  if (connections <= 4) return 6.5
  return 8
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND STARS — absolute pixel coords, rendered once
   ═══════════════════════════════════════════════════════════════ */

function BgStars({ width, height }: { width: number; height: number }) {
  const stars = useMemo(() => {
    const rand = seededRandom(12345)
    return Array.from({ length: BG_STAR_COUNT }, (_, i) => ({
      id: i,
      x: rand() * width,
      y: rand() * height,
      r: 0.5 + rand() * 1.0,
      opacity: 0.1 + rand() * 0.15,
    }))
  }, [width, height])

  return (
    <g>
      {stars.map((s) => (
        <circle
          key={s.id}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="white"
          opacity={s.opacity}
        />
      ))}
    </g>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SVG DEFS — radial gradients per memory type for glow
   ═══════════════════════════════════════════════════════════════ */

function SvgDefs() {
  const types: MemoryType[] = ['text', 'voice', 'link', 'image']
  return (
    <defs>
      {types.map((t) => {
        const c = TYPE_COLORS[t]
        return (
          <React.Fragment key={t}>
            <radialGradient id={`glow-outer-${t}`}>
              <stop offset="0%" stopColor={c} stopOpacity="0.08" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`glow-inner-${t}`}>
              <stop offset="0%" stopColor={c} stopOpacity="0.2" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </React.Fragment>
        )
      })}
      <radialGradient id="bg-vignette" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="100%" stopColor="#0a0015" stopOpacity="0.6" />
      </radialGradient>
    </defs>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TOOLTIP
   ═══════════════════════════════════════════════════════════════ */

interface TooltipData {
  memory: Memory
  connectionCount: number
  screenX: number
  screenY: number
}

const Tooltip = memo(function Tooltip({ data, containerWidth, containerHeight }: { data: TooltipData; containerWidth: number; containerHeight: number }) {
  const { memory, connectionCount, screenX, screenY } = data
  const Icon = TYPE_ICONS[memory.type]
  const color = TYPE_COLORS[memory.type]

  const tooltipW = 220
  const tooltipH = 120
  let left = screenX - tooltipW / 2
  let top = screenY - tooltipH - 16

  if (top < 10) top = screenY + 20
  if (left < 10) left = 10
  if (left + tooltipW > containerWidth - 10) left = containerWidth - tooltipW - 10
  if (top + tooltipH > containerHeight - 10) top = containerHeight - tooltipH - 10

  const dateStr = memory.createdAt
    ? format(new Date(memory.createdAt), 'MMM d, yyyy')
    : ''

  const contentPreview = memory.content
    ? memory.content.slice(0, 60) + (memory.content.length > 60 ? '...' : '')
    : (memory.aiSummary?.slice(0, 60) + (memory.aiSummary && memory.aiSummary.length > 60 ? '...' : '')) || ''

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        maxWidth: tooltipW,
        background: 'rgba(10, 8, 20, 0.92)',
        border: '1px solid rgba(157, 139, 167, 0.25)',
        borderRadius: 12,
        padding: '12px 16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'tooltipIn 150ms ease forwards',
        zIndex: 100,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={11} style={{ color }} />
        <span className="text-[13px] font-medium text-white leading-tight truncate">
          {memory.title || 'Untitled'}
        </span>
      </div>
      <div className="text-[11px] mb-1.5" style={{ color: '#9D8BA7' }}>
        {dateStr}
      </div>
      {contentPreview && (
        <div
          className="text-[12px] leading-snug mb-1.5"
          style={{
            color: 'rgba(255,255,255,0.55)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {contentPreview}
        </div>
      )}
      {connectionCount > 0 && (
        <div className="text-[10px]" style={{ color: 'rgba(157, 139, 167, 0.7)' }}>
          ✦ {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════
   MAIN CONSTELLATIONS COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function ConstellationsInner() {
  const { memories, setSelectedMemoryId, setCurrentView } = useAetherStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const currentTransformRef = useRef<ZoomTransform>(zoomIdentity)
  const animFrameRef = useRef<number>(0)
  const driftTickRef = useRef(0)

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null)
  const [clickFlash, setClickFlash] = useState<string | null>(null)
  const [driftTick, setDriftTick] = useState(0)

  // Cap memories at MAX_NODES, most recent first
  const cappedMemories = useMemo(() => {
    return memories.slice(0, MAX_NODES)
  }, [memories])

  // Build nodes and links from memories
  const { nodes, links } = useMemo(() => {
    const connMap = new Map<string, number>()
    const rand = seededRandom(42)

    const n: MemoryNode[] = cappedMemories.map((m) => ({
      id: m.id,
      memory: m,
      type: m.type,
      connectionCount: 0,
      phase: rand() * Math.PI * 2,
      x: dimensions.width / 2 + (rand() - 0.5) * 200,
      y: dimensions.height / 2 + (rand() - 0.5) * 200,
    }))

    // Build tag -> memory index map
    const tagMap = new Map<string, number[]>()
    cappedMemories.forEach((m, i) => {
      if (m.tags) {
        for (const tag of m.tags) {
          const existing = tagMap.get(tag) || []
          existing.push(i)
          tagMap.set(tag, existing)
        }
      }
    })

    // Build links from shared tags
    const linkSet = new Set<string>()
    const l: MemoryLink[] = []
    for (const [, indices] of tagMap) {
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const a = indices[i]
          const b = indices[j]
          const key = a < b ? `${a}-${b}` : `${b}-${a}`
          if (!linkSet.has(key)) {
            linkSet.add(key)
            l.push({ source: n[a].id, target: n[b].id })
          }
        }
      }
    }

    // Count connections per node
    for (const link of l) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as MemoryNode).id
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as MemoryNode).id
      connMap.set(srcId, (connMap.get(srcId) || 0) + 1)
      connMap.set(tgtId, (connMap.get(tgtId) || 0) + 1)
    }

    // Update connection counts
    for (const node of n) {
      node.connectionCount = connMap.get(node.id) || 0
    }

    return { nodes: n, links: l }
  }, [cappedMemories, dimensions])

  // Run D3 force simulation — returns settled positions
  const settledNodes = useMemo(() => {
    if (nodes.length === 0) return [] as MemoryNode[]

    const simNodes: MemoryNode[] = nodes.map((n) => ({
      ...n,
      index: undefined,
      vx: undefined,
      vy: undefined,
      fx: undefined,
      fy: undefined,
    }))
    const simLinks = links.map((l) => ({ ...l }))

    const sim = forceSimulation<MemoryNode>(simNodes)
      .force(
        'link',
        forceLink<MemoryNode, MemoryLink>(simLinks as MemoryLink[])
          .id((d) => (d as MemoryNode).id)
          .distance(180)
          .strength(0.08)
      )
      .force('charge', forceManyBody().strength(-400))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', forceCollide<MemoryNode>().radius(45))
      .force('x', forceX(dimensions.width / 2).strength(0.02))
      .force('y', forceY(dimensions.height / 2).strength(0.02))
      .stop()

    // Run for 300 ticks
    for (let i = 0; i < 300; i++) {
      sim.tick()
    }

    return simNodes
  }, [nodes, links, dimensions])

  // Stats
  const stats = useMemo(() => {
    const memoryCount = settledNodes.length
    const connectionCount = links.length
    const clusterCount = countClusters(settledNodes, links as MemoryLink[])
    return { memoryCount, connectionCount, clusterCount }
  }, [settledNodes, links])

  // Hovered node's connected IDs for highlighting
  const hoveredConnections = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>()
    const connected = new Set<string>()
    connected.add(hoveredNodeId)
    for (const link of links) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as MemoryNode).id
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as MemoryNode).id
      if (srcId === hoveredNodeId) connected.add(tgtId)
      if (tgtId === hoveredNodeId) connected.add(srcId)
    }
    return connected
  }, [hoveredNodeId, links])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Setup D3 zoom
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const g = svg.querySelector<SVGGElement>('g.zoom-group')
    if (!g) return
    gRef.current = g

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        currentTransformRef.current = event.transform
        if (gRef.current) {
          select(gRef.current).attr('transform', event.transform.toString())
        }
      })

    select(svg).call(zoomBehavior)

    // Double click to reset
    select(svg).on('dblclick.zoom', null)
    select(svg).on('dblclick', () => {
      select(svg).transition().duration(600).call(zoomBehavior.transform, zoomIdentity)
    })

    zoomBehaviorRef.current = zoomBehavior

    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  // Gentle drift animation using requestAnimationFrame
  useEffect(() => {
    if (settledNodes.length === 0) return

    const animate = () => {
      driftTickRef.current++
      const frame = driftTickRef.current
      for (const node of settledNodes) {
        if (node.x !== undefined && node.y !== undefined) {
          node.x += Math.sin(frame * 0.005 + node.phase) * DRIFT_AMPLITUDE
          node.y += Math.cos(frame * 0.004 + node.phase * 1.3) * DRIFT_AMPLITUDE
        }
      }
      // Update drift tick state every 5 frames for subtle re-render
      if (frame % 5 === 0) {
        setDriftTick(frame)
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [settledNodes])

  // Convert simulation-space coordinates to screen-space for tooltip
  const simToScreen = useCallback((simX: number, simY: number): { x: number; y: number } => {
    const t = currentTransformRef.current
    return {
      x: t.applyX(simX),
      y: t.applyY(simY),
    }
  }, [])

  // Click handler
  const handleNodeClick = useCallback(
    (node: MemoryNode) => {
      setClickFlash(node.id)
      setTimeout(() => {
        setSelectedMemoryId(node.id)
        setCurrentView('memory-detail')
      }, 200)
    },
    [setSelectedMemoryId, setCurrentView]
  )

  // Hover handlers
  const handleNodeHover = useCallback(
    (node: MemoryNode | null) => {
      if (node) {
        setHoveredNodeId(node.id)
        const screen = simToScreen(node.x ?? 0, node.y ?? 0)
        setTooltipData({
          memory: node.memory,
          connectionCount: node.connectionCount,
          screenX: screen.x,
          screenY: screen.y,
        })
      } else {
        setHoveredNodeId(null)
        setTooltipData(null)
      }
    },
    [simToScreen]
  )

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const svg = svgRef.current
    const zb = zoomBehaviorRef.current
    if (!svg || !zb) return
    select(svg).transition().duration(300).call(zb.scaleBy, 1.4)
  }, [])

  const handleZoomOut = useCallback(() => {
    const svg = svgRef.current
    const zb = zoomBehaviorRef.current
    if (!svg || !zb) return
    select(svg).transition().duration(300).call(zb.scaleBy, 0.7)
  }, [])

  const handleZoomReset = useCallback(() => {
    const svg = svgRef.current
    const zb = zoomBehaviorRef.current
    if (!svg || !zb) return
    select(svg).transition().duration(600).call(zb.transform, zoomIdentity)
  }, [])

  // After D3 simulation, links may have resolved source/target objects
  // We need to look up node positions from settledNodes
  const getNodeById = useMemo(() => {
    const map = new Map<string, MemoryNode>()
    for (const n of settledNodes) map.set(n.id, n)
    return map
  }, [settledNodes])

  // Empty state: no memories
  if (memories.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#030308' }}>
        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
          <BgStars width={dimensions.width} height={dimensions.height} />
        </svg>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, #0a0015 100%)', opacity: 0.6 }} />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8">
            <div
              className="rounded-full"
              style={{
                width: 120,
                height: 120,
                background: 'radial-gradient(circle, rgba(157,139,167,0.25) 0%, rgba(157,139,167,0.05) 50%, transparent 70%)',
                animation: 'constellationPulse 4s ease-in-out infinite',
              }}
            />
          </div>
          <p className="text-white text-lg font-medium mb-2">Your constellation is empty</p>
          <p className="text-white/30 text-sm">Save your first memory and watch your universe begin</p>
        </div>

        <style>{`
          @keyframes constellationPulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.15); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden" style={{ background: '#030308' }}>
      {/* Stats bar */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none" style={{ padding: '12px 0 0 0' }}>
        <p className="text-center text-[11px] tracking-[0.06em]" style={{ color: '#9D8BA7' }}>
          ✦ {stats.memoryCount} memories · {stats.connectionCount} connection{stats.connectionCount !== 1 ? 's' : ''} · {stats.clusterCount} cluster{stats.clusterCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: hoveredNodeId ? 'pointer' : 'grab' }}
      >
        <SvgDefs />

        {/* Static background layer (not affected by zoom) */}
        <g className="bg-layer">
          <BgStars width={dimensions.width} height={dimensions.height} />
          <rect
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.height}
            fill="url(#bg-vignette)"
          />
        </g>

        {/* Zoomable content layer */}
        <g className="zoom-group">
          {/* Connection lines */}
          <g className="links">
            {links.map((link, i) => {
              const srcId = typeof link.source === 'string' ? link.source : (link.source as MemoryNode).id
              const tgtId = typeof link.target === 'string' ? link.target : (link.target as MemoryNode).id
              const src = getNodeById.get(srcId)
              const tgt = getNodeById.get(tgtId)
              if (!src || !tgt) return null

              const isHighlighted = hoveredNodeId !== null && hoveredConnections.has(srcId) && hoveredConnections.has(tgtId)
              const isFaded = hoveredNodeId !== null && !isHighlighted

              return (
                <line
                  key={`link-${i}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="white"
                  strokeWidth={0.4}
                  opacity={isHighlighted ? 0.25 : isFaded ? 0.015 : 0.06}
                  style={{ transition: 'opacity 250ms ease' }}
                />
              )
            })}
          </g>

          {/* Memory nodes */}
          <g className="nodes">
            {settledNodes.map((node, index) => {
              const color = TYPE_COLORS[node.type]
              const r = getNodeRadius(node.connectionCount)
              const isHovered = hoveredNodeId === node.id
              const isConnected = hoveredNodeId !== null && hoveredConnections.has(node.id) && !isHovered
              const isFaded = hoveredNodeId !== null && !hoveredConnections.has(node.id)
              const isFlashing = clickFlash === node.id

              const baseOpacity = isFaded ? 0.15 : isConnected ? 1 : 1
              const glowOpacity = isFaded ? 0.03 : 1

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                  onMouseEnter={() => handleNodeHover(node)}
                  onMouseLeave={() => handleNodeHover(null)}
                  onClick={() => handleNodeClick(node)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer glow */}
                  <circle
                    r={r * 3.5}
                    fill={`url(#glow-outer-${node.type})`}
                    opacity={glowOpacity}
                    style={{ transition: 'opacity 250ms ease' }}
                  />
                  {/* Inner glow */}
                  <circle
                    r={r * 2}
                    fill={`url(#glow-inner-${node.type})`}
                    opacity={glowOpacity}
                    style={{ transition: 'opacity 250ms ease' }}
                  />
                  {/* Core */}
                  <circle
                    r={r}
                    fill={isFlashing ? 'white' : color}
                    opacity={baseOpacity}
                    style={{
                      transition: 'opacity 250ms ease, fill 200ms ease',
                      animation: `starPulse ${3 + (index % 3)}s ease-in-out infinite`,
                      animationDelay: `${index * 0.3}s`,
                    }}
                  />
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <Tooltip data={tooltipData} containerWidth={dimensions.width} containerHeight={dimensions.height} />
      )}

      {/* No connections hint */}
      {memories.length > 0 && links.length === 0 && (
        <div className="absolute bottom-16 md:bottom-4 left-0 right-0 z-20 pointer-events-none text-center">
          <p className="text-white/20 text-[11px]">Add tags to your memories to reveal connections</p>
        </div>
      )}

      {/* Legend (desktop only) */}
      <div
        className="hidden md:block absolute z-20 pointer-events-none"
        style={{ top: 16, right: 16, background: 'rgba(10, 8, 20, 0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}
      >
        {(['text', 'voice', 'link', 'image'] as MemoryType[]).map((t) => (
          <div key={t} className="flex items-center gap-2 mb-1 last:mb-0">
            <div
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor: TYPE_COLORS[t],
                boxShadow: `0 0 4px ${TYPE_COLORS[t]}`,
              }}
            />
            <span className="text-[11px] text-white/60 capitalize">{t}</span>
          </div>
        ))}
      </div>

      {/* Zoom Controls */}
      <div
        className="absolute z-20 flex flex-col gap-1"
        style={{ bottom: 80, right: 16 }}
      >
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(10, 8, 20, 0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(10, 8, 20, 0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={handleZoomReset}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(10, 8, 20, 0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
          aria-label="Reset view"
        >
          ⊙
        </button>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes starPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes tooltipIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT — wrapped with dynamic SSR:false in page.tsx
   ═══════════════════════════════════════════════════════════════ */

export default memo(ConstellationsInner)
