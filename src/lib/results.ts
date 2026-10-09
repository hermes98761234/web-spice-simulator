/** Converts raw ngspice output into plot-friendly arrays, and derives dB/phase traces. */
import type { ResultType } from 'eecircuit-engine'

export type AnalysisType = 'op' | 'dc' | 'ac' | 'tran' | 'noise' | 'unknown'

export interface SimVector {
  name: string
  type: string
  re: Float64Array
  /** Imaginary parts, present for complex (AC) data only. */
  im?: Float64Array
}

export interface SimData {
  title: string
  plotName: string
  kind: AnalysisType
  complex: boolean
  numPoints: number
  /** All vectors; vectors[0] is the sweep axis (time, frequency, sweep voltage) except for .op. */
  vectors: SimVector[]
}

export type TraceMode = 'real' | 'imag' | 'mag' | 'db' | 'phase'

export function kindFromHeader(header: string): AnalysisType {
  const m = /^Plotname:\s*(.*)$/im.exec(header)
  const p = (m?.[1] ?? '').toLowerCase()
  if (p.includes('operating point')) return 'op'
  if (p.includes('transient')) return 'tran'
  if (p.includes('ac analysis')) return 'ac'
  if (p.includes('dc transfer')) return 'dc'
  if (p.includes('noise')) return 'noise'
  return 'unknown'
}

export function normalizeResult(r: ResultType): SimData {
  const title = /^Title:\s*(.*)$/im.exec(r.header)?.[1]?.trim() ?? ''
  const plotName = /^Plotname:\s*(.*)$/im.exec(r.header)?.[1]?.trim() ?? ''
  const vectors: SimVector[] = []
  if (r.dataType === 'complex') {
    for (const d of r.data) {
      const re = new Float64Array(d.values.length)
      const im = new Float64Array(d.values.length)
      d.values.forEach((c, i) => { re[i] = c.real; im[i] = c.img })
      vectors.push({ name: d.name, type: d.type, re, im })
    }
  } else {
    for (const d of r.data) vectors.push({ name: d.name, type: d.type, re: Float64Array.from(d.values) })
  }
  return { title, plotName, kind: kindFromHeader(r.header), complex: r.dataType === 'complex', numPoints: r.numPoints, vectors }
}

/** The sweep axis vector, or undefined for operating-point results. */
export function xVector(d: SimData): SimVector | undefined {
  return d.kind === 'op' ? undefined : d.vectors[0]
}

/** Vectors that can be plotted against the sweep axis. */
export function plotVectors(d: SimData): SimVector[] {
  return d.kind === 'op' ? [] : d.vectors.slice(1)
}

export function magnitude(v: SimVector): Float64Array {
  const out = new Float64Array(v.re.length)
  for (let i = 0; i < out.length; i++) out[i] = v.im ? Math.hypot(v.re[i], v.im[i]) : Math.abs(v.re[i])
  return out
}

export function toDb(v: SimVector): Float64Array {
  const m = magnitude(v)
  for (let i = 0; i < m.length; i++) m[i] = 20 * Math.log10(m[i])
  return m
}

/** Phase in degrees. With `unwrap`, jumps larger than 180 degrees are removed so the trace is continuous. */
export function phaseDeg(v: SimVector, unwrap = true): Float64Array {
  const out = new Float64Array(v.re.length)
  let offset = 0
  let prev = 0
  for (let i = 0; i < out.length; i++) {
    const raw = (Math.atan2(v.im?.[i] ?? 0, v.re[i]) * 180) / Math.PI
    if (unwrap && i > 0) {
      const d = raw + offset - prev
      if (d > 180) offset -= 360 * Math.round(d / 360)
      else if (d < -180) offset += 360 * Math.round(-d / 360)
    }
    out[i] = raw + offset
    prev = out[i]
  }
  return out
}

export function traceFor(v: SimVector, mode: TraceMode): Float64Array {
  switch (mode) {
    case 'db': return toDb(v)
    case 'mag': return magnitude(v)
    case 'phase': return phaseDeg(v)
    case 'imag': return v.im ? v.im : new Float64Array(v.re.length)
    default: return v.re
  }
}

export interface OpRow {
  name: string
  type: string
  value: number
}

/** Table rows for a .op result (first point of every vector). */
export function opTable(d: SimData): OpRow[] {
  return d.vectors.map((v) => ({ name: v.name, type: v.type, value: v.re[0] }))
}

export function unitFor(type: string): string {
  switch (type) {
    case 'voltage': return 'V'
    case 'current': return 'A'
    case 'time': return 's'
    case 'frequency': return 'Hz'
    default: return ''
  }
}

/** Index of the sample whose x is closest to `x` (x ascending or descending). */
export function nearestIndex(xs: ArrayLike<number>, x: number): number {
  let best = 0
  let bd = Infinity
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - x)
    if (d < bd) { bd = d; best = i }
  }
  return best
}

/**
 * Frequency where a magnitude-in-dB trace first crosses `level` (default -3 dB below its first value),
 * linearly interpolated in log-frequency. Returns undefined when it never crosses.
 */
export function crossing(freq: ArrayLike<number>, db: ArrayLike<number>, level = db[0] - 3.0103): number | undefined {
  for (let i = 1; i < freq.length; i++) {
    if ((db[i - 1] - level) * (db[i] - level) <= 0 && db[i - 1] !== db[i]) {
      const t = (level - db[i - 1]) / (db[i] - db[i - 1])
      const l0 = Math.log10(freq[i - 1])
      const l1 = Math.log10(freq[i])
      return Math.pow(10, l0 + t * (l1 - l0))
    }
  }
  return undefined
}

/** uPlot cannot draw NaN/Infinity (e.g. 20*log10(0)); turn them into gaps. */
export function toPlotArray(a: ArrayLike<number>): (number | null)[] {
  const out: (number | null)[] = new Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = Number.isFinite(a[i]) ? a[i] : null
  return out
}

/** Which vectors to plot first: `out` if present, else up to two node voltages (not branch currents). */
export function defaultSelection(d: SimData): string[] {
  const vs = plotVectors(d)
  const out = vs.find((v) => /^v\(out\)$/i.test(v.name))
  if (out) return [out.name]
  const volts = vs.filter((v) => v.type === 'voltage' && !v.name.includes('#'))
  const pick = volts.filter((v) => !/^v\((in|vcc|vdd|src)\)$/i.test(v.name))
  return (pick.length ? pick : volts).slice(-2).map((v) => v.name)
}
