/** Interprets the ngspice message stream of one run. */

export interface RunDiagnosis {
  /** Fatal message when the run produced no usable result (the engine then returns stale data). */
  fatal: string | null
  /** Non-empty warning/error lines, de-duplicated, in order. */
  messages: string[]
}

const FATAL = /circuit not parsed|simulation not started|simulation interrupted|no such file|fatal/i

export function diagnoseRun(errors: string[]): RunDiagnosis {
  const messages: string[] = []
  for (const e of errors) {
    const s = e.trim()
    if (s && !messages.includes(s)) messages.push(s)
  }
  if (!messages.some((m) => FATAL.test(m))) return { fatal: null, messages }
  // Prefer the most specific line: the one explaining *why* ngspice gave up.
  const reason =
    messages.find((m) => /could not find|unknown|not a valid|singular|no job|syntax|too few|undefined|missing/i.test(m)) ??
    messages.find((m) => FATAL.test(m))!
  return { fatal: reason, messages }
}

/** Keeps the tail of a long log so the UI stays responsive. */
export function trimLog(s: string, max = 20000): string {
  return s.length <= max ? s : '…\n' + s.slice(s.length - max)
}

/** Removes ngspice's interactive prompts ("ngspice 3 -> ") and collapses blank-line runs. */
export function cleanInfo(s: string): string {
  return s
    .replace(/ngspice \d+ -> ?/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
