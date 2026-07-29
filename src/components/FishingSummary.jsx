import { useCallback, useEffect, useRef, useState } from 'react'

const ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16M4 10h10M4 15h13M4 20h7" />
  </svg>
)

// Reading four sites and summarizing them costs an API call, so it happens when
// the angler asks for it — not on every visit to the tab.
const BUTTON_LABEL = {
  idle: 'Summarize reports',
  loading: 'Reading reports…',
  ok: 'Refresh',
  error: 'Try again',
}

// Each failure has a different next step, so the card names the actual one.
const FAILURE_MESSAGE = {
  not_configured:
    'The server has no Anthropic API key set, so it can’t write a summary. Everything else on this tab still works — read the reports at the source below.',
  sources_unreachable:
    'None of the report sites would load — they may be blocking automated requests, or the connection dropped. Open them directly below.',
  no_reports:
    'The report sources loaded but held no readable report text — the sites may not have posted a new report yet. Open them below to check.',
  busy: 'Too many summary requests just now. Give it a minute and try again.',
  unreachable:
    'Couldn’t reach the app’s own API server. In development that’s `npm run server` on :3001.',
  failed: 'Something went wrong summarizing the reports. Try again, or read them at the source below.',
}

function formatUpdated(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  const sameDay = at.toDateString() === new Date().toDateString()
  return sameDay
    ? at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : at.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function SourceChips({ sources }) {
  if (!sources?.length) return null
  return (
    <div className="fishing-summary-sources">
      {sources.map((source) => (
        <a
          key={source.id}
          className={`fishing-summary-source ${source.status === 'ok' ? '' : 'source-missing'}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.detail ? `Not read: ${source.detail}` : undefined}
        >
          <span className="source-dot" aria-hidden="true" />
          {source.label}
        </a>
      ))}
    </div>
  )
}

export default function FishingSummary() {
  const [state, setState] = useState({ status: 'idle', data: null, failure: null })
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ ...prev, status: 'loading' }))

    try {
      const response = await fetch('/api/fishing-summary', { signal: controller.signal })

      // A dead API server comes back through the dev proxy as a non-JSON 500,
      // which is worth telling apart from a summary that genuinely failed.
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }

      if (!response.ok || !body?.summary) {
        setState({
          status: 'error',
          data: null,
          failure: {
            reason: body?.reason || (body ? 'failed' : 'unreachable'),
            sources: body?.sources || null,
          },
        })
        return
      }

      setState({ status: 'ok', data: body, failure: null })
    } catch (error) {
      if (error.name === 'AbortError') return
      setState({ status: 'error', data: null, failure: { reason: 'unreachable', sources: null } })
    }
  }, [])

  const { status, data, failure } = state
  const updated = data?.generatedAt ? formatUpdated(data.generatedAt) : null
  const missing = data?.sources?.filter((source) => source.status !== 'ok') || []

  return (
    <section className="cond-card fishing-summary-card">
      <header className="cond-card-head">
        <h3>
          <span className="cond-card-icon">{ICON}</span>
          What the Reports Say
        </h3>
        <div className="fishing-summary-actions">
          {status === 'ok' && <span className="ai-badge">AI</span>}
          <button
            className="fishing-summary-run"
            onClick={run}
            disabled={status === 'loading'}
            type="button"
          >
            {BUTTON_LABEL[status]}
          </button>
        </div>
      </header>

      {status === 'idle' && (
        <p className="cond-note">
          Pull the shop and regional reports linked below into one read — what&apos;s being caught,
          where, and on what. Takes a few seconds and asks Claude to summarize the live pages.
        </p>
      )}

      {status === 'loading' && (
        <p className="cond-note">Reading the linked reports…</p>
      )}

      {status === 'error' && (
        <>
          <p className="cond-note">
            {FAILURE_MESSAGE[failure?.reason] || FAILURE_MESSAGE.failed}
          </p>
          <SourceChips sources={failure?.sources} />
        </>
      )}

      {status === 'ok' && (
        <>
          {data.summary.split(/\n{2,}/).map((paragraph, i) => (
            <p className="fishing-summary-text" key={i}>{paragraph}</p>
          ))}

          <SourceChips sources={data.sources} />

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
