import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkerIn, WorkerOut } from './sim.worker'
import type { SimData } from './lib/results'

export type SimStatus = 'loading' | 'idle' | 'running'

export interface Outcome {
  data: SimData | null
  /** Engine error text, or 'stopped'. */
  error: string | null
  log: string
  messages: string[]
  ms: number
}

/** Owns the ngspice Web Worker (WASM loads once, off the main thread) and exposes run/stop. */
export function useSim() {
  const [status, setStatus] = useState<SimStatus>('loading')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const worker = useRef<Worker | null>(null)
  const ready = useRef(false)
  const current = useRef<{ id: number; t0: number } | null>(null)
  const nextId = useRef(1)

  const spawn = useCallback(() => {
    ready.current = false
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data
      if (m.type === 'ready') {
        ready.current = true
        if (!current.current) setStatus('idle')
        return
      }
      if (!current.current || m.id !== current.current.id) return
      const ms = performance.now() - current.current.t0
      current.current = null
      setStatus('idle')
      if (m.type === 'done') setOutcome({ data: m.data, error: null, log: m.log, messages: m.messages, ms })
      else setOutcome({ data: null, error: m.error, log: m.log, messages: m.messages, ms })
    }
    w.onerror = (e) => {
      current.current = null
      setStatus('idle')
      setOutcome({ data: null, error: e.message || 'Worker error', log: '', messages: [], ms: 0 })
    }
    worker.current = w
    return w
  }, [])

  useEffect(() => {
    const w = spawn()
    return () => w.terminate()
  }, [spawn])

  const run = useCallback((netlist: string) => {
    const w = worker.current
    if (!w || current.current) return
    const id = nextId.current++
    current.current = { id, t0: performance.now() }
    setStatus('running')
    const msg: WorkerIn = { type: 'run', id, netlist }
    w.postMessage(msg)
  }, [])

  const stop = useCallback(() => {
    if (!current.current) return
    const ms = performance.now() - current.current.t0
    current.current = null
    worker.current?.terminate()
    setStatus('loading')
    setOutcome({ data: null, error: 'stopped', log: '', messages: [], ms })
    spawn()
  }, [spawn])

  return { status, outcome, run, stop }
}
