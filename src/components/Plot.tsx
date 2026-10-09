import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { formatEng } from '../lib/netlist'
import { toPlotArray } from '../lib/results'

export interface PlotSeries {
  label: string
  color: string
  data: Float64Array
}

interface Props {
  x: Float64Array
  series: PlotSeries[]
  xLabel: string
  yLabel: string
  xUnit: string
  yUnit: string
  logX: boolean
  /** Pinned cursor x-positions (data units), drawn as vertical lines. */
  marks: number[]
  onPick: (x: number) => void
  /** Changes when the theme changes so colors are re-read. */
  themeKey: string
  height?: number
}

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function Plot({ x, series, xLabel, yLabel, xUnit, yUnit, logX, marks, onPick, themeKey, height = 300 }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)
  const marksRef = useRef(marks)
  const pickRef = useRef(onPick)
  useEffect(() => {
    marksRef.current = marks
    pickRef.current = onPick
  })

  useEffect(() => {
    const el = host.current
    if (!el || x.length === 0) return
    const fg = css('--chart-fg')
    const grid = css('--grid')
    const strong = css('--grid-strong')
    const axis = { stroke: fg, grid: { stroke: grid, width: 1 }, ticks: { stroke: strong, width: 1 } }
    const opts: uPlot.Options = {
      width: Math.max(200, el.clientWidth),
      height,
      cursor: { drag: { x: true, y: false, setScale: true }, points: { size: 6 } },
      scales: { x: { time: false, distr: logX ? 3 : 1 } },
      axes: [
        { ...axis, label: xLabel, labelSize: 18, values: (_u, s) => s.map((v) => (v == null ? '' : formatEng(v, '', 3))), size: 36 },
        { ...axis, label: yLabel, labelSize: 18, values: (_u, s) => s.map((v) => (v == null ? '' : formatEng(v, '', 3))), size: 64 },
      ],
      series: [
        { label: xLabel, value: (_u, v) => (v == null ? '--' : formatEng(v, xUnit, 4)) },
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 1.6,
          spanGaps: false,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? '--' : formatEng(v, yUnit, 4)),
        })),
      ],
      hooks: {
        draw: [
          (u) => {
            const ctx = u.ctx
            ctx.save()
            ctx.strokeStyle = css('--ref-line')
            ctx.lineWidth = 1.5
            ctx.setLineDash([5, 4])
            marksRef.current.forEach((m, i) => {
              const px = Math.round(u.valToPos(m, 'x', true))
              if (px < u.bbox.left || px > u.bbox.left + u.bbox.width) return
              ctx.beginPath()
              ctx.moveTo(px, u.bbox.top)
              ctx.lineTo(px, u.bbox.top + u.bbox.height)
              ctx.stroke()
              ctx.fillStyle = css('--ref-line')
              ctx.font = `${Math.round(12 * devicePixelRatio)}px sans-serif`
              ctx.fillText(i === 0 ? 'A' : 'B', px + 4, u.bbox.top + 14 * devicePixelRatio)
            })
            ctx.restore()
          },
        ],
        ready: [
          (u) => {
            let down: { x: number; y: number } | null = null
            u.over.addEventListener('mousedown', (e) => { down = { x: e.clientX, y: e.clientY } })
            u.over.addEventListener('mouseup', (e) => {
              if (down && Math.abs(e.clientX - down.x) < 4 && Math.abs(e.clientY - down.y) < 4) {
                const left = u.cursor.left
                if (left != null && left >= 0) pickRef.current(u.posToVal(left, 'x'))
              }
              down = null
            })
            u.over.addEventListener('dblclick', () => u.setData(u.data, true))
          },
        ],
      },
    }
    const data: uPlot.AlignedData = [Array.from(x), ...series.map((s) => toPlotArray(s.data))] as uPlot.AlignedData
    const u = new uPlot(opts, data, el)
    plot.current = u
    const ro = new ResizeObserver(() => u.setSize({ width: Math.max(200, el.clientWidth), height }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      u.destroy()
      plot.current = null
    }
  }, [x, series, xLabel, yLabel, xUnit, yUnit, logX, themeKey, height])

  // Redraw when pinned cursors change without rebuilding the chart.
  useEffect(() => { plot.current?.redraw(false) }, [marks])

  return <div className="plot" ref={host} />
}
