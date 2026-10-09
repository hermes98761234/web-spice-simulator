import { Simulation } from 'eecircuit-engine'
import { beforeAll, describe, expect, it } from 'vitest'
import { EXAMPLES } from './lib/examples'
import { crossing, normalizeResult, toDb, phaseDeg } from './lib/results'

/** Runs the real ngspice WASM build (single-threaded, no special headers) under node. */
describe('ngspice WASM engine', () => {
  const sim = new Simulation()
  beforeAll(async () => { await sim.start() })
  const run = async (net: string) => { sim.setNetList(net); return normalizeResult(await sim.runSim()) }

  it('solves a resistive divider operating point', async () => {
    const d = await run(EXAMPLES.find((e) => e.id === 'divider-op')!.netlist)
    expect(d.kind).toBe('op')
    const v = Object.fromEntries(d.vectors.map((x) => [x.name, x.re[0]]))
    expect(v['v(mid)']).toBeCloseTo(3, 6) // 9 V * 1k / 3k
    expect(v['i(v1)']).toBeCloseTo(-0.003, 9)
  })

  it('RC low-pass: -3 dB at 1/(2 pi R C) and -45 degrees there', async () => {
    const d = await run(EXAMPLES.find((e) => e.id === 'rc-ac')!.netlist)
    expect(d.kind).toBe('ac')
    const f = d.vectors[0].re
    const out = d.vectors.find((v) => v.name === 'v(out)')!
    const fc = 1 / (2 * Math.PI * 1e3 * 100e-9)
    expect(crossing(f, toDb(out))!).toBeCloseTo(fc, -1)
    const i = Array.from(f).findIndex((x) => x >= fc)
    expect(phaseDeg(out)[i]).toBeLessThan(-40)
    expect(phaseDeg(out)[i]).toBeGreaterThan(-50)
  })

  it('RLC ringing: first overshoot above the 5 V step', async () => {
    const d = await run(EXAMPLES.find((e) => e.id === 'rlc-tran')!.netlist)
    expect(d.kind).toBe('tran')
    const out = d.vectors.find((v) => v.name === 'v(out)')!
    // zeta = R/2 * sqrt(C/L) = 0.0316 -> peak = 5 * (1 + exp(-pi*zeta/sqrt(1-zeta^2))) = 9.53 V
    expect(Math.max(...out.re)).toBeGreaterThan(9.3)
    expect(Math.max(...out.re)).toBeLessThan(9.7)
  })

  it('MOSFET inverter: output high at Vin=0, low at Vin=5', async () => {
    const d = await run(EXAMPLES.find((e) => e.id === 'mos-dc')!.netlist)
    expect(d.kind).toBe('dc')
    const out = d.vectors.find((v) => v.name === 'v(out)')!
    expect(out.re[0]).toBeCloseTo(5, 2)
    expect(out.re[out.re.length - 1]).toBeLessThan(0.5)
  })

  it('every bundled example runs', async () => {
    for (const e of EXAMPLES) {
      const d = await run(e.netlist)
      expect(d.numPoints, e.id).toBeGreaterThan(0)
      expect(sim.getError().some((m) => /not parsed/i.test(m)), e.id).toBe(false)
    }
  })
})
