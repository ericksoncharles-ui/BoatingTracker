import { useEffect, useState } from 'react'

const ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16M4 10h10M4 15h13M4 20h7" />
  </svg>
)

function formatUpdated(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  const sameDay = at.toDateString() === new Date().toDateString()
  return sameDay
    ? at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : at.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function FishingSummary() {
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/fishing-summary', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Summary request failed: ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!data?.summary) throw new Error('Empty summary')
        setState({ status: 'ok', data })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        // Same rule as the trip briefing: no key, no server, or a dead source
        // site degrades this card, never the tab.
        setState({ status: 'error', data: null })
      })

    return () => { controller.abort() }
  }, [])

  const { status, data } = state
  const updated = data?.generatedAt ? formatUpdated(data.generatedAt) : null
  const missing = data?.sources?.filter((source) => source.status !== 'ok') || []

  return (
    <section className="cond-card fishing-summary-card">
      <header className="cond-card-head">
        <h3>
          <span className="cond-card-icon">{ICON}</span>
          What the Reports Say
        </h3>
        {status === 'ok' && <span className="ai-badge">AI</span>}
      </header>

      {status === 'loading' && <p className="cond-note">Reading the latest reports…</p>}

      {status === 'error' && (
        <p className="cond-note">
          Couldn&apos;t pull the reports together right now — read them straight from the sources
          at the bottom of this tab.
        </p>
      )}

      {status === 'ok' && (
        <>
          {data.summary.split(/\n{2,}/).map((paragraph, i) => (
            <p className="fishing-summary-text" key={i}>{paragraph}</p>
          ))}

          <div className="fishing-summary-sources">
            {data.sources.map((source) => (
              <a
                key={source.id}
                className={`fishing-summary-source ${source.status === 'ok' ? '' : 'source-missing'}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="source-dot" aria-hidden="true" />
                {source.label}
              </a>
            ))}
          </div>

          <p className="cond-provenance">
            Summarized from the linked reports{updated ? ` · ${updated}` : ''}
            {missing.length > 0 && ` · ${missing.length} source${missing.length > 1 ? 's' : ''} unreachable`}
            . Reports run a week behind the water — read the originals before you commit to a plan.
          </p>
        </>
      )}
    </section>
  )
}
