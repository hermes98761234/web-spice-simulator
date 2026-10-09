import { describe, expect, it } from 'vitest'
import { EXAMPLES } from './examples'
import { analyzeNetlist, formatEng, logicalLines, parseSpiceNumber, prepareNetlist, stripComment } from './netlist'

describe('parseSpiceNumber', () => {
  it.each([
    ['1k', 1e3], ['4.7K', 4.7e3], ['1meg', 1e6], ['1MEG', 1e6], ['10u', 1e-5], ['100n', 1e-7], ['2.2p', 2.2e-12],
    ['1m', 1e-3], ['1e-9', 1e-9], ['-3.3', -3.3], ['100nF', 1e-7], ['5V', 5], ['1mil', 25.4e-6], ['2g', 2e9], ['.5', 0.5],
  ])('%s', (s, v) => expect(parseSpiceNumber(s)).toBeCloseTo(v, 12))
  it('rejects junk', () => {
    expect(parseSpiceNumber('abc')).toBeNaN()
    expect(parseSpiceNumber('')).toBeNaN()
  })
})

describe('formatEng', () => {
  it('uses SI prefixes', () => {
    expect(formatEng(0.0047, 'A')).toBe('4.7mA')
    expect(formatEng(15848.93, 'Hz')).toBe('15.8kHz')
    expect(formatEng(1e6, 'Hz')).toBe('1MHz')
    expect(formatEng(2.5e-7, 's')).toBe('250ns')
    expect(formatEng(-1.5)).toBe('-1.5')
    expect(formatEng(0, 'V')).toBe('0V')
  })
})

describe('logicalLines', () => {
  it('drops title, comments and joins continuations', () => {
    const r = logicalLines('My title\n* comment\nR1 a b\n+ 1k ; tail\n\nC1 b 0 1u $ note\n')
    expect(r.title).toBe('My title')
    expect(r.lines.map((l) => l.text)).toEqual(['R1 a b 1k', 'C1 b 0 1u'])
    expect(r.lines[0].line).toBe(3)
  })
  it('strips comments', () => {
    expect(stripComment('R1 a b 1k ; x')).toBe('R1 a b 1k ')
  })
})

describe('analyzeNetlist', () => {
  it('analyses the RC example', () => {
    const i = analyzeNetlist(EXAMPLES[0].netlist)
    expect(i.analyses.map((a) => a.kind)).toEqual(['ac'])
    expect(i.elements).toEqual({ V: 1, R: 1, C: 1 })
    expect(i.nodes).toEqual(['0', 'in', 'out'])
    expect(i.hasGround).toBe(true)
    expect(i.hasEnd).toBe(true)
    expect(i.warnings).toEqual([])
  })
  it('handles transistors, MOSFETs and subcircuits', () => {
    const i = analyzeNetlist('t\nQ1 c b e QM\nM1 d g s s NM W=1u L=1u\nX1 a b amp\n.subckt amp in out\nR9 in out 1\n.ends\n.model QM NPN\n')
    expect(i.nodes).toEqual(['a', 'b', 'c', 'd', 'e', 'g', 's'])
    expect(i.elements).toEqual({ Q: 1, M: 1, X: 1 })
    expect(i.subckts).toEqual(['amp'])
    expect(i.models).toEqual(['QM'])
  })
  it('ignores .control blocks and subckt-internal analyses', () => {
    const i = analyzeNetlist('t\nR1 a 0 1\n.control\nac dec 1 1 10\n.tran 1 2\n.endc\n.op\n')
    expect(i.analyses.map((a) => a.kind)).toEqual(['op'])
  })
  it('warns about missing pieces', () => {
    expect(analyzeNetlist('only title').warnings.map((w) => w.msg)).toContain('The netlist has no circuit elements.')
    const noGnd = analyzeNetlist('t\nR1 a b 1\n.op\n')
    expect(noGnd.warnings.map((w) => w.msg)).toEqual(['No ground node 0 found.'])
    const none = analyzeNetlist('t\nR1 a 0 1\n')
    expect(none.warnings.map((w) => w.msg)).toEqual(['No analysis command (.op, .dc, .ac, .tran) found.'])
    const two = analyzeNetlist('t\nR1 a 0 1\n.op\n.tran 1 2\n')
    expect(two.warnings.map((w) => w.msg)).toEqual(['Several analyses found; only the last one is plotted.'])
  })
  it('accepts every bundled example without warnings', () => {
    for (const e of EXAMPLES) expect(analyzeNetlist(e.netlist).warnings, e.id).toEqual([])
  })
})

describe('prepareNetlist', () => {
  it('appends .end once and normalises line endings', () => {
    expect(prepareNetlist('t\nR1 a 0 1\n.op')).toBe('t\nR1 a 0 1\n.op\n.end\n')
    expect(prepareNetlist('t\r\nR1 a 0 1\r\n.END\r\n')).toBe('t\nR1 a 0 1\n.END\n')
  })
})
