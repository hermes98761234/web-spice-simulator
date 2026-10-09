import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, fileNameFor, parseSettings } from './storage'

describe('parseSettings', () => {
  it('returns defaults for missing or broken data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS)
  })
  it('validates each field', () => {
    expect(parseSettings('{"lang":"uk","theme":"dark","logX":false,"unwrap":false}')).toEqual({ lang: 'uk', theme: 'dark', logX: false, unwrap: false })
    expect(parseSettings('{"lang":"fr","theme":7,"logX":"yes"}')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('fileNameFor', () => {
  it('slugifies the title', () => {
    expect(fileNameFor('RC low-pass filter, corner at 1.59 kHz')).toBe('rc-low-pass-filter-corner-at-1-59-khz.cir')
    expect(fileNameFor('')).toBe('circuit.cir')
    expect(fileNameFor('Фільтр')).toBe('circuit.cir')
  })
})
