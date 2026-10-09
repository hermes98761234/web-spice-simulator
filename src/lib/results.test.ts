import type { ResultType } from 'eecircuit-engine'
import { describe, expect, it } from 'vitest'
import {
  crossing, defaultSelection, kindFromHeader, magnitude, nearestIndex, normalizeResult, opTable, phaseDeg, plotVectors, toDb,
  toPlotArray, traceFor, xVector,
} from './results'

const header = (plot: string) => `Title: demo\nDate: x\nPlotname: ${plot}\nFlags: real\n`

// First-order low-pass H = 1/(1 + j f/fc), fc = 1 kHz, sampled on a log grid.
const fc = 1000
const freqs = [10, 100, 1000, 10000, 100000]
const ac: ResultType = {
  header: header('AC Analysis'),
  numVariables: 3,
  variableNames: ['frequency', 'v(in)', 'v(out)'],
  numPoints: freqs.length,
  dataType: 'complex',
  data: [
    { name: 'frequency', type: 'frequency', values: freqs.map((f) => ({ real: f, img: 0 })) },
    { name: 'v(in)', type: 'voltage', values: freqs.map(() => ({ real: 1, img: 0 })) },
    {
      name: 'v(out)',
      type: 'voltage',
      values: freqs.map((f) => {
        const d = 1 + (f / fc) ** 2
        return { real: 1 / d, img: -(f / fc) / d }
      }),
    },
  ],
}

describe('normalizeResult', () => {
  it('converts complex AC data to typed arrays', () => {
    const d = normalizeResult(ac)
    expect(d.kind).toBe('ac')
    expect(d.complex).toBe(true)
    expect(d.title).toBe('demo')
    expect(d.vectors[2].im).toBeInstanceOf(Float64Array)
    expect(xVector(d)?.name).toBe('frequency')
    expect(plotVectors(d).map((v) => v.name)).toEqual(['v(in)', 'v(out)'])
  })
  it('converts real data and recognises the analysis kind', () => {
    const d = normalizeResult({
      header: header('Operating Point'), numVariables: 2, variableNames: ['v(a)', 'i(v1)'], numPoints: 1, dataType: 'real',
      data: [{ name: 'v(a)', type: 'voltage', values: [3] }, { name: 'i(v1)', type: 'current', values: [-0.003] }],
    })
    expect(d.kind).toBe('op')
    expect(xVector(d)).toBeUndefined()
    expect(plotVectors(d)).toEqual([])
    expect(opTable(d)).toEqual([{ name: 'v(a)', type: 'voltage', value: 3 }, { name: 'i(v1)', type: 'current', value: -0.003 }])
  })
})

describe('kindFromHeader', () => {
  it.each([
    ['Transient Analysis', 'tran'], ['DC transfer characteristic', 'dc'], ['AC Analysis', 'ac'], ['Operating Point', 'op'],
    ['Noise Spectral Density Curves', 'noise'], ['Whatever', 'unknown'],
  ])('%s', (p, k) => expect(kindFromHeader(header(p))).toBe(k))
})

describe('AC traces', () => {
  const d = normalizeResult(ac)
  const out = d.vectors[2]
  it('magnitude and dB match the textbook RC response', () => {
    const m = magnitude(out)
    expect(m[2]).toBeCloseTo(1 / Math.SQRT2, 12) // |H(fc)| = 0.7071
    const db = toDb(out)
    expect(db[2]).toBeCloseTo(-3.0103, 3)
    expect(db[4]).toBeCloseTo(-40.0, 1) // two decades above fc: -40 dB
  })
  it('phase is -45 degrees at the corner and tends to -90', () => {
    const p = phaseDeg(out)
    expect(p[2]).toBeCloseTo(-45, 9)
    expect(p[4]).toBeCloseTo(-89.43, 2)
    expect(traceFor(out, 'phase')[2]).toBeCloseTo(-45, 9)
  })
  it('unwraps phase through the +-180 boundary', () => {
    // Phase falling through -180: raw atan2 jumps from about -170 to +170.
    const ang = [-150, -170, -190, -210, -250]
    const v = { name: 'x', type: 'voltage', re: Float64Array.from(ang.map((a) => Math.cos((a * Math.PI) / 180))), im: Float64Array.from(ang.map((a) => Math.sin((a * Math.PI) / 180))) }
    const wrapped = phaseDeg(v, false)
    expect(wrapped[2]).toBeCloseTo(170, 6)
    const un = phaseDeg(v, true)
    ang.forEach((a, i) => expect(un[i]).toBeCloseTo(a, 6))
  })
  it('real data has zero phase or 180 for negative values', () => {
    const v = { name: 'x', type: 'voltage', re: Float64Array.from([1, -1]) }
    expect(Array.from(phaseDeg(v))).toEqual([0, 180])
    expect(Array.from(magnitude(v))).toEqual([1, 1])
  })
  it('finds the -3 dB frequency by log interpolation', () => {
    const f = crossing(d.vectors[0].re, toDb(out))
    expect(f).toBeGreaterThan(900)
    expect(f).toBeLessThan(1100)
    // Fine grid: should land on fc.
    const grid = Float64Array.from({ length: 401 }, (_, i) => 10 ** (1 + i / 100))
    const db = Float64Array.from(grid, (x) => -10 * Math.log10(1 + (x / fc) ** 2))
    expect(crossing(grid, db)).toBeCloseTo(fc, -1)
    expect(crossing([1, 10], [0, -1])).toBeUndefined()
  })
})

describe('plot helpers', () => {
  it('turns non-finite values into gaps', () => {
    expect(toPlotArray(Float64Array.from([1, NaN, -Infinity, 2]))).toEqual([1, null, null, 2])
    expect(toPlotArray(toDb({ name: 'z', type: 'voltage', re: Float64Array.from([0, 1]) }))).toEqual([null, 0])
  })
  it('finds the nearest sample', () => {
    expect(nearestIndex([1, 2, 4, 8], 3.1)).toBe(2)
    expect(nearestIndex([8, 4, 2, 1], 1.4)).toBe(3)
  })
  it('picks sensible default traces', () => {
    expect(defaultSelection(normalizeResult(ac))).toEqual(['v(out)'])
    const tran = normalizeResult({
      header: header('Transient Analysis'), numVariables: 4, variableNames: [], numPoints: 1, dataType: 'real',
      data: [
        { name: 'time', type: 'time', values: [0] }, { name: 'v(in)', type: 'voltage', values: [0] },
        { name: 'v(a)', type: 'voltage', values: [0] }, { name: 'i(v1)', type: 'current', values: [0] },
      ],
    })
    expect(defaultSelection(tran)).toEqual(['v(a)'])
  })
})
