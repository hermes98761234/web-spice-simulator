/// <reference lib="webworker" />
import { Simulation } from 'eecircuit-engine'
import { cleanInfo, diagnoseRun, trimLog } from './lib/log'
import { normalizeResult, type SimData } from './lib/results'

export type WorkerIn = { type: 'run'; id: number; netlist: string }
export type WorkerOut =
  | { type: 'ready' }
  | { type: 'done'; id: number; data: SimData; log: string; messages: string[] }
  | { type: 'failed'; id: number; error: string; log: string; messages: string[] }

const sim = new Simulation()
const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (m: WorkerOut) => ctx.postMessage(m)
const started = sim.start().then(() => post({ type: 'ready' }))
let queue: Promise<void> = started

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  const { id, netlist } = e.data
  queue = queue.then(async () => {
    try {
      sim.setNetList(netlist)
      const raw = await sim.runSim()
      const full = sim.getInfo()
      const log = trimLog(cleanInfo(full))
      const diag = diagnoseRun(sim.getError())
      if (diag.fatal) post({ type: 'failed', id, error: diag.fatal, log, messages: diag.messages })
      else post({ type: 'done', id, data: normalizeResult(raw), log, messages: diag.messages })
    } catch (err) {
      post({ type: 'failed', id, error: String(err), log: trimLog(cleanInfo(sim.getInfo())), messages: sim.getError() })
    }
  })
}
