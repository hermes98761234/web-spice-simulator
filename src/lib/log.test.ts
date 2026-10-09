import { describe, expect, it } from 'vitest'
import { cleanInfo, diagnoseRun, trimLog } from './log'

describe('diagnoseRun', () => {
  it('is not fatal for plain warnings', () => {
    const d = diagnoseRun(['', "Warning: 'r1 a b' is not a valid resistor instance line, ignored!", ''])
    expect(d.fatal).toBeNull()
    expect(d.messages).toHaveLength(1)
  })
  it('reports the specific reason when the circuit is not parsed', () => {
    const d = diagnoseRun(['Error on line 3 or its substitute:', 'q1 a b 0 nope', 'could not find a valid modelname', 'Simulation interrupted due to error!', 'Error: circuit not parsed.'])
    expect(d.fatal).toBe('could not find a valid modelname')
  })
  it('flags a missing analysis', () => {
    expect(diagnoseRun(['Warning: No job (tran, ac, op etc.) defined:', 'run simulation not started']).fatal).toMatch(/No job/)
  })
})

describe('log text', () => {
  it('removes prompts and extra blank lines', () => {
    expect(cleanInfo('ngspice 1 -> ngspice 2 -> \nNote: x\n\n\n\nDone')).toBe('Note: x\n\nDone')
  })
  it('keeps the tail of long logs', () => {
    const s = 'a'.repeat(50) + 'END'
    expect(trimLog(s, 10)).toBe('…\n' + 'aaaaaaaEND')
  })
})
