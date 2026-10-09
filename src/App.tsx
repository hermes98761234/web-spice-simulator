import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from './components/Editor'
import Plot, { type PlotSeries } from './components/Plot'
import { tr, type T } from './i18n'
import { DEFAULT_EXAMPLE, EXAMPLES } from './lib/examples'
import { analyzeNetlist, formatEng, prepareNetlist } from './lib/netlist'
import {
  crossing, defaultSelection, magnitude, nearestIndex, opTable, phaseDeg, plotVectors, toDb, traceFor, unitFor, xVector,
  type SimData, type SimVector, type TraceMode,
} from './lib/results'
import { fileNameFor, loadNetlist, loadSettings, saveNetlist, saveSettings, type Lang, type Settings, type Theme } from './lib/storage'
import { useSim } from './useSim'

const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d']
const CUSTOM = 'custom'

interface Row {
  key: string
  label: string
  unit: string
  data: Float64Array
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [netlist, setNetlist] = useState<string>(() => loadNetlist() ?? DEFAULT_EXAMPLE.netlist)
  const [sel, setSel] = useState<{ data: SimData | null; names: string[] }>({ data: null, names: [] })
  const [pins, setPins] = useState<{ data: SimData | null; marks: number[] }>({ data: null, marks: [] })
  const { status, outcome, run, stop } = useSim()
  const fileInput = useRef<HTMLInputElement>(null)
  const autoRan = useRef(false)
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const info = useMemo(() => analyzeNetlist(netlist), [netlist])
  const data = outcome?.data ?? null

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveNetlist(netlist), [netlist])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  const doRun = () => run(prepareNetlist(netlist))

  // Run the loaded netlist once as soon as the engine is ready.
  const initial = useRef(netlist)
  useEffect(() => {
    if (status === 'idle' && !autoRan.current) {
      autoRan.current = true
      run(prepareNetlist(initial.current))
    }
  }, [status, run])

  // The selection belongs to one result; a new result keeps still-valid names or falls back to a default.
  const selected = useMemo(() => {
    if (!data) return []
    if (sel.data === data) return sel.names
    const names = new Set(plotVectors(data).map((v) => v.name))
    const keep = sel.names.filter((n) => names.has(n))
    return keep.length ? keep : defaultSelection(data)
  }, [data, sel])
  const marks = pins.data === data ? pins.marks : []
  const setSelected = (names: string[]) => setSel({ data, names })
  const setMarks = (m: number[]) => setPins({ data, marks: m })

  const exampleId = EXAMPLES.find((e) => e.netlist === netlist)?.id ?? CUSTOM
  const themeKey = settings.theme + (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'd' : 'l')

  const openFile = async (f: File | undefined) => {
    if (!f) return
    setNetlist(await f.text())
    if (fileInput.current) fileInput.current.value = ''
  }
  const saveFile = () => {
    const blob = new Blob([netlist.endsWith('\n') ? netlist : netlist + '\n'], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileNameFor(info.title)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const busy = status === 'running'
  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Web SPICE Simulator')}</span>
        <span className="hint">{t('ngspice in your browser: edit a netlist, run it, plot the results.')}</span>
        <span className="spacer" />
        <label className="inline">
          {t('Theme')}
          <select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value as Theme })}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
        <label className="inline">
          {t('Language')}
          <select value={settings.lang} onChange={(e) => setSettings({ ...settings, lang: e.target.value as Lang })}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
      </header>
      <div className="body">
        <section className="side">
          <div className="panel">
            <div className="row">
              <label className="inline grow">
                {t('Example')}
                <select value={exampleId} onChange={(e) => { const ex = EXAMPLES.find((x) => x.id === e.target.value); if (ex) setNetlist(ex.netlist) }}>
                  {exampleId === CUSTOM && <option value={CUSTOM}>{t('Custom netlist')}</option>}
                  {EXAMPLES.map((e) => <option key={e.id} value={e.id}>{t(e.name)}</option>)}
                </select>
              </label>
            </div>
            <div className="row">
              <button className="primary" onClick={doRun} disabled={busy || status === 'loading'} title="Ctrl+Enter">
                {busy ? t('Running…') : t('Run')}
              </button>
              <button onClick={stop} disabled={!busy}>{t('Stop')}</button>
              <span className="spacer" />
              <button onClick={() => fileInput.current?.click()}>{t('Open .cir')}</button>
              <button onClick={saveFile}>{t('Save .cir')}</button>
              <input ref={fileInput} type="file" hidden accept=".cir,.sp,.spice,.net,.txt,.ckt" onChange={(e) => void openFile(e.target.files?.[0])} />
            </div>
            <Editor value={netlist} onChange={setNetlist} onRun={() => { if (!busy && status !== 'loading') doRun() }} label={t('Netlist')} />
            <p className="hint">
              {info.analyses.length > 0 && <>{info.analyses.map((a) => `.${a.kind}`).join(', ')} · </>}
              {t('{0} elements, {1} nodes', info.elementCount, info.nodes.length)}
              {' · '}{t('Autosaved in this browser.')}
            </p>
            {info.warnings.map((w) => <p key={w.msg} className="hint warn-text">{t(w.msg, ...w.args)}</p>)}
          </div>
        </section>
        <main className="main">
          <StatusBar status={status} outcome={outcome} data={data} t={t} />
          {data && <Results data={data} selected={selected} onSelect={setSelected} marks={marks} onMarks={setMarks} settings={settings} onSettings={setSettings} themeKey={themeKey} t={t} />}
          <details className="box" open={!!outcome?.error || undefined}>
            <summary>{t('Simulation log')}</summary>
            {outcome?.messages.length ? <pre className="log log-err">{outcome.messages.join('\n')}</pre> : null}
            <pre className="log">{outcome?.log || t('No output yet.')}</pre>
          </details>
        </main>
      </div>
      <p className="hint foot">
        {t('Runs entirely in your browser (ngspice compiled to WebAssembly). Nothing is uploaded.')}{' '}
        <a href="https://github.com/hermes98761234/web-spice-simulator">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}

const colorOf = (vectors: SimVector[], v: SimVector) => PALETTE[vectors.indexOf(v) % PALETTE.length]

function StatusBar({ status, outcome, data, t }: { status: string; outcome: ReturnType<typeof useSim>['outcome']; data: SimData | null; t: T }) {
  if (status === 'loading') return <div className="box status">{t('Loading the simulation engine…')}</div>
  if (status === 'running') return <div className="box status">{t('Running…')}</div>
  if (!outcome) return null
  if (outcome.error === 'stopped') return <div className="box status warn-text">{t('Stopped.')}</div>
  if (outcome.error) return <div className="box status err-text"><strong>{t('Simulation failed')}</strong>: {outcome.error}</div>
  if (!data) return null
  return (
    <div className="box status ok-text">
      {t('Done: {0}, {1} points, {2} ms', data.plotName || data.kind, data.numPoints, Math.round(outcome.ms))}
    </div>
  )
}

interface ResultsProps {
  data: SimData
  selected: string[]
  onSelect: (s: string[]) => void
  marks: number[]
  onMarks: (m: number[]) => void
  settings: Settings
  onSettings: (s: Settings) => void
  themeKey: string
  t: T
}

function Results({ data, selected, onSelect, marks, onMarks, settings, onSettings, themeKey, t }: ResultsProps) {
  const x = xVector(data)
  const vectors = useMemo(() => plotVectors(data), [data])
  const chosen = useMemo(() => selected.map((n) => vectors.find((v) => v.name === n)).filter((v): v is SimVector => !!v), [selected, vectors])
  const isAc = data.kind === 'ac'

  const mainMode: TraceMode = isAc ? 'db' : 'real'
  const mainSeries: PlotSeries[] = useMemo(
    () => chosen.map((v) => ({ label: v.name, color: colorOf(vectors, v), data: traceFor(v, mainMode) })),
    [chosen, vectors, mainMode],
  )
  const phaseSeries: PlotSeries[] = useMemo(
    () => (isAc ? chosen.map((v) => ({ label: v.name, color: colorOf(vectors, v), data: phaseDeg(v, settings.unwrap) })) : []),
    [chosen, vectors, isAc, settings.unwrap],
  )

  const pick = (px: number) => onMarks(marks.length >= 2 ? [px] : [...marks, px])

  if (data.kind === 'op' || !x) {
    return (
      <div className="box">
        <h3>{t('Operating point')}</h3>
        <table className="data">
          <tbody>
            {opTable(data).map((r) => (
              <tr key={r.name}><td>{r.name}</td><td>{formatEng(r.value, unitFor(r.type), 5)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Cursor readout rows.
  const rows: Row[] = []
  for (const v of chosen) {
    if (isAc) {
      rows.push({ key: v.name + ':db', label: `${v.name} (dB)`, unit: 'dB', data: toDb(v) })
      rows.push({ key: v.name + ':ph', label: `${v.name} (°)`, unit: '°', data: phaseDeg(v, settings.unwrap) })
    } else {
      rows.push({ key: v.name, label: v.name, unit: unitFor(v.type), data: v.re })
    }
  }
  const xu = unitFor(x.type)
  const idx = marks.map((m) => nearestIndex(x.re, m))
  const fc = isAc && chosen[0] ? crossing(x.re, toDb(chosen[0])) : undefined
  const peak = isAc && chosen[0] ? Math.max(...magnitude(chosen[0])) : 0

  return (
    <>
      <div className="box">
        <div className="row">
          <h3 className="grow">{isAc ? t('Magnitude') : t('Waveforms')}</h3>
          {isAc && (
            <>
              <label className="check"><input type="checkbox" checked={settings.logX} onChange={(e) => onSettings({ ...settings, logX: e.target.checked })} />{t('Log frequency')}</label>
              <label className="check"><input type="checkbox" checked={settings.unwrap} onChange={(e) => onSettings({ ...settings, unwrap: e.target.checked })} />{t('Unwrap phase')}</label>
            </>
          )}
          <button className="small" onClick={() => onMarks([])} disabled={marks.length === 0}>{t('Clear cursors')}</button>
        </div>
        {chosen.length === 0 ? <p className="hint">{t('Select at least one vector to plot.')}</p> : (
          <>
            <Plot x={x.re} series={mainSeries} xLabel={isAc ? t('Frequency (Hz)') : `${x.name} (${xu})`} yLabel={isAc ? t('Magnitude (dB)') : ''}
              xUnit={xu} yUnit={isAc ? 'dB' : ''} logX={isAc && settings.logX} marks={marks} onPick={pick} themeKey={themeKey} />
            {isAc && (
              <>
                <h3>{t('Phase')}</h3>
                <Plot x={x.re} series={phaseSeries} xLabel={t('Frequency (Hz)')} yLabel={t('Phase (°)')} xUnit="Hz" yUnit="°"
                  logX={settings.logX} marks={marks} onPick={pick} themeKey={themeKey} height={220} />
              </>
            )}
            <p className="hint">{t('Hover for values, click to place cursors A and B, drag to zoom, double-click to reset.')}</p>
          </>
        )}
        {fc !== undefined && <p className="hint">{t('First trace: peak {0}, −3 dB point at {1}', `${(20 * Math.log10(peak)).toFixed(2)} dB`, formatEng(fc, 'Hz', 4))}</p>}
      </div>
      <div className="box">
        <h3>{t('Vectors')}</h3>
        <div className="vecs">
          {vectors.map((v) => (
            <label key={v.name} className="check vec">
              <input type="checkbox" checked={selected.includes(v.name)}
                onChange={(e) => onSelect(e.target.checked ? [...selected, v.name] : selected.filter((n) => n !== v.name))} />
              <span className="swatch" style={{ background: colorOf(vectors, v) }} />{v.name}
            </label>
          ))}
        </div>
      </div>
      {marks.length > 0 && rows.length > 0 && (
        <div className="box">
          <h3>{t('Cursors')}</h3>
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr><td /><td>A</td>{marks.length > 1 && <><td>B</td><td>B − A</td></>}</tr>
              </thead>
              <tbody>
                <tr>
                  <td>{x.name}</td>
                  {idx.map((i, k) => <td key={k}>{formatEng(x.re[i], xu, 5)}</td>)}
                  {idx.length > 1 && <td>{formatEng(x.re[idx[1]] - x.re[idx[0]], xu, 4)}</td>}
                </tr>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    {idx.map((i, k) => <td key={k}>{formatEng(r.data[i], r.unit, 5)}</td>)}
                    {idx.length > 1 && <td>{formatEng(r.data[idx[1]] - r.data[idx[0]], r.unit, 4)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
