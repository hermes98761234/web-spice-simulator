/** Netlist analysis helpers: logical lines, analysis cards, elements, nodes and sanity warnings. */

export type AnalysisKind = 'op' | 'dc' | 'ac' | 'tran' | 'noise' | 'tf' | 'sens' | 'pz' | 'disto'

export interface Analysis {
  kind: AnalysisKind
  /** 1-based line number of the card in the text (of the first physical line). */
  line: number
  text: string
}

export interface Warning {
  /** English message (a key in the UK dictionary), {0} placeholders filled from args. */
  msg: string
  args: string[]
}

export interface NetlistInfo {
  title: string
  analyses: Analysis[]
  /** Element counts keyed by upper-case type letter (R, C, L, V, ...). */
  elements: Record<string, number>
  elementCount: number
  /** Distinct top-level node names, lower-case, ground ("0") first when present. */
  nodes: string[]
  models: string[]
  subckts: string[]
  hasEnd: boolean
  hasGround: boolean
  warnings: Warning[]
}

export interface LogicalLine {
  text: string
  line: number
}

const ANALYSES: AnalysisKind[] = ['op', 'dc', 'ac', 'tran', 'noise', 'tf', 'sens', 'pz', 'disto']

/** Strips an inline comment (`;` or `$ `) from a line. */
export function stripComment(s: string): string {
  const semi = s.indexOf(';')
  if (semi >= 0) s = s.slice(0, semi)
  const dollar = s.search(/\s\$(\s|$)/)
  if (dollar >= 0) s = s.slice(0, dollar)
  return s
}

/**
 * Splits text into logical lines: the title (first line) is dropped, comment and blank lines are
 * removed, and `+` continuation lines are joined to the previous card.
 */
export function logicalLines(text: string): { title: string; lines: LogicalLine[] } {
  const raw = text.split(/\r?\n/)
  const title = raw[0] ?? ''
  const lines: LogicalLine[] = []
  for (let i = 1; i < raw.length; i++) {
    const trimmed = raw[i].trim()
    if (trimmed === '' || trimmed.startsWith('*')) continue
    const body = stripComment(trimmed).trim()
    if (body === '') continue
    if (body.startsWith('+') && lines.length > 0) {
      lines[lines.length - 1].text += ' ' + body.slice(1).trim()
    } else {
      lines.push({ text: body, line: i + 1 })
    }
  }
  return { title: title.replace(/^\*\s*/, '').trim(), lines }
}

/** Number of leading node tokens for an element letter, or -1 when "all but the last token". */
function nodeCount(letter: string): number {
  switch (letter) {
    case 'R': case 'C': case 'L': case 'V': case 'I': case 'D': case 'B': case 'F': case 'H':
      return 2
    case 'Q': return 3
    case 'J': return 3
    case 'Z': return 3
    case 'M': case 'E': case 'G': case 'S': case 'W': case 'O': return 4
    case 'T': return 4
    case 'X': return -1
    default: return 0
  }
}

const GROUND = new Set(['0', 'gnd'])

export function analyzeNetlist(text: string): NetlistInfo {
  const { title, lines } = logicalLines(text)
  const analyses: Analysis[] = []
  const elements: Record<string, number> = {}
  const nodes = new Set<string>()
  const models: string[] = []
  const subckts: string[] = []
  let hasEnd = false
  let depth = 0
  let inControl = false
  const warnings: Warning[] = []

  for (const { text: line, line: no } of lines) {
    const tokens = line.split(/\s+/)
    const head = tokens[0].toLowerCase()
    if (head.startsWith('.')) {
      const cmd = head.slice(1)
      if (cmd === 'control') inControl = true
      else if (cmd === 'endc') inControl = false
      else if (cmd === 'end') hasEnd = true
      else if (cmd === 'subckt') { depth++; if (tokens[1]) subckts.push(tokens[1]) }
      else if (cmd === 'ends') depth = Math.max(0, depth - 1)
      else if (cmd === 'model' && tokens[1]) models.push(tokens[1])
      else if (depth === 0 && !inControl && (ANALYSES as string[]).includes(cmd)) {
        analyses.push({ kind: cmd as AnalysisKind, line: no, text: line })
      }
      continue
    }
    if (inControl || depth > 0) continue
    const letter = tokens[0][0].toUpperCase()
    if (!/[A-Z]/.test(letter)) continue
    elements[letter] = (elements[letter] ?? 0) + 1
    const n = nodeCount(letter)
    const args = tokens.slice(1).filter((t) => !t.includes('='))
    const names = n === -1 ? args.slice(0, -1) : args.slice(0, n)
    for (const nm of names) nodes.add(nm.toLowerCase())
  }

  const hasGround = [...nodes].some((n) => GROUND.has(n))
  const ordered = [...nodes].filter((n) => !GROUND.has(n)).sort()
  const sorted = hasGround ? ['0', ...ordered] : ordered
  const elementCount = Object.values(elements).reduce((a, b) => a + b, 0)

  if (elementCount === 0) warnings.push({ msg: 'The netlist has no circuit elements.', args: [] })
  else if (!hasGround) warnings.push({ msg: 'No ground node 0 found.', args: [] })
  if (analyses.length === 0) warnings.push({ msg: 'No analysis command (.op, .dc, .ac, .tran) found.', args: [] })
  if (analyses.length > 1) warnings.push({ msg: 'Several analyses found; only the last one is plotted.', args: [] })

  return { title, analyses, elements, elementCount, nodes: sorted, models, subckts, hasEnd, hasGround, warnings }
}

/** Makes sure the netlist ends with `.end` and a trailing newline, as ngspice expects. */
export function prepareNetlist(text: string): string {
  const t = text.replace(/\r\n?/g, '\n').replace(/\s+$/, '')
  const hasEnd = t.split('\n').some((l) => /^\s*\.end\s*(\*|;|$)/i.test(l))
  return (hasEnd ? t : t + '\n.end') + '\n'
}

const SUFFIX: Record<string, number> = {
  t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, mil: 25.4e-6, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
}

/** Parses a SPICE number such as `4.7k`, `1meg`, `10u`, `1e-9`, `100nF`. Returns NaN when invalid. */
export function parseSpiceNumber(s: string): number {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµ]*)\s*$/i.exec(s)
  if (!m) return NaN
  const base = parseFloat(m[1])
  const suf = m[2].toLowerCase()
  if (suf === '') return base
  for (const key of ['meg', 'mil']) if (suf.startsWith(key)) return base * SUFFIX[key]
  const mult = SUFFIX[suf[0]]
  return mult === undefined ? base : base * mult
}

const PREFIXES: [number, string][] = [
  [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
]

/** Engineering notation with an SI prefix: 0.0047 -> "4.7m", 15848.9 -> "15.8k". */
export function formatEng(v: number, unit = '', digits = 3): string {
  if (!Number.isFinite(v)) return String(v)
  if (v === 0) return '0' + unit
  const a = Math.abs(v)
  const [scale, p] = PREFIXES.find(([s]) => a >= s * 0.9999999) ?? PREFIXES[PREFIXES.length - 1]
  const n = parseFloat((v / scale).toPrecision(digits))
  return `${n}${p}${unit}`
}
