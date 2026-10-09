/** Tiny SPICE tokenizer for syntax highlighting. Pure: text in, token spans out. */

export type TokenClass = 'comment' | 'directive' | 'element' | 'number' | 'param' | 'cont' | 'title' | 'plain'

export interface Token {
  text: string
  cls: TokenClass
}

const NUM = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:meg|mil|[tgkmunpf])?[a-zµ]*$/i

function tokenizeBody(body: string, first: boolean, out: Token[], elementDone: boolean): void {
  // Split into words and whitespace, keeping every character.
  const parts = body.match(/\s+|[^\s]+/g) ?? []
  let seenFirst = elementDone
  for (const p of parts) {
    if (/^\s+$/.test(p)) { out.push({ text: p, cls: 'plain' }); continue }
    if (!seenFirst && first) {
      seenFirst = true
      out.push({ text: p, cls: p.startsWith('.') ? 'directive' : 'element' })
    } else if (/^[^=]+=/.test(p) || p.endsWith('=')) {
      out.push({ text: p, cls: 'param' })
    } else if (NUM.test(p)) {
      out.push({ text: p, cls: 'number' })
    } else {
      out.push({ text: p, cls: 'plain' })
    }
  }
}

/** Tokenizes one physical line. `isTitle` marks the first line of the netlist. */
export function highlightLine(line: string, isTitle = false): Token[] {
  if (isTitle) return [{ text: line, cls: 'title' }]
  const trimmed = line.trimStart()
  if (trimmed.startsWith('*')) return [{ text: line, cls: 'comment' }]
  const out: Token[] = []
  let code = line
  let comment = ''
  const semi = line.indexOf(';')
  if (semi >= 0) { code = line.slice(0, semi); comment = line.slice(semi) }
  if (trimmed.startsWith('+')) {
    const lead = code.length - code.trimStart().length
    if (lead) out.push({ text: code.slice(0, lead), cls: 'plain' })
    out.push({ text: '+', cls: 'cont' })
    tokenizeBody(code.slice(lead + 1), false, out, true)
  } else {
    tokenizeBody(code, true, out, false)
  }
  if (comment) out.push({ text: comment, cls: 'comment' })
  return out
}

export function highlightText(text: string): Token[][] {
  return text.split('\n').map((l, i) => highlightLine(l.replace(/\r$/, ''), i === 0))
}
