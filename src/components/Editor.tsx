import { useRef } from 'react'
import { highlightText } from '../lib/highlight'

interface Props {
  value: string
  onChange: (v: string) => void
  onRun: () => void
  label: string
}

/** A textarea with a syntax-highlighted mirror behind it. */
export default function Editor({ value, onChange, onRun, label }: Props) {
  const inner = useRef<HTMLDivElement>(null)
  const lines = highlightText(value)
  return (
    <div className="editor">
      <div className="editor-hl" aria-hidden="true">
        <div ref={inner} className="editor-hl-inner">
          {lines.map((toks, i) => (
            <div key={i} className="editor-line">
              {toks.map((t, j) => (
                <span key={j} className={`tk-${t.cls}`}>{t.text}</span>
              ))}
              {'\n'}
            </div>
          ))}
        </div>
      </div>
      <textarea
        aria-label={label}
        value={value}
        spellCheck={false}
        wrap="off"
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          const el = e.currentTarget
          if (inner.current) inner.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onRun()
          }
        }}
      />
    </div>
  )
}
