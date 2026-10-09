import { describe, expect, it } from 'vitest'
import { highlightLine, highlightText } from './highlight'

const cls = (line: string) => highlightLine(line).filter((t) => t.cls !== 'plain' || t.text.trim()).map((t) => `${t.cls}:${t.text}`)

describe('highlightLine', () => {
  it('classifies elements, numbers and params', () => {
    expect(cls('R1 in out 4.7k')).toEqual(['element:R1', 'plain:in', 'plain:out', 'number:4.7k'])
    expect(cls('M1 d g s s NM W=20u')).toContain('param:W=20u')
  })
  it('classifies directives, comments and continuations', () => {
    expect(cls('.ac dec 20 10 1meg')).toEqual(['directive:.ac', 'plain:dec', 'number:20', 'number:10', 'number:1meg'])
    expect(cls('* a comment')).toEqual(['comment:* a comment'])
    expect(cls('+ 1k ; tail')).toEqual(['cont:+', 'number:1k', 'comment:; tail'])
  })
  it('keeps every character', () => {
    const lines = ['  R1   a b 1k ; hi', '.model D1 D(IS=1e-14 N=1.05)', '+ x']
    for (const l of lines) expect(highlightLine(l).map((t) => t.text).join('')).toBe(l)
  })
  it('treats the first line as the title', () => {
    expect(highlightText('My circuit\nR1 a b 1')[0]).toEqual([{ text: 'My circuit', cls: 'title' }])
  })
})
