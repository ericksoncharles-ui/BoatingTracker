import Anthropic from '@anthropic-ai/sdk'
import { fishingLinks } from '../src/data.js'
import { htmlToText } from './htmlText.js'

// The Fishing tab links out to weekly reports; this turns those pages into one
// aggregate read. It runs server-side because the report sites send no CORS
// headers — the browser cannot fetch them directly — and because the API key
// must stay off the client.
//
// Only the shop and aggregate report pages are summarized. The CT DEEP / NY DEC
// links are regulations, not a weekly report, and restating seasons or bag
// limits from a scraped page is exactly the thing an angler should read at the
// source instead.
const REPORT_KINDS = new Set(['shop', 'aggregate'])
const SOURCES = fishingLinks.filter((link) => REPORT_KINDS.has(link.kind))

// Reports are published weekly, so a summary stays accurate far longer than it
// takes to make one. The cache is what keeps a page refresh from costing an API
// call, and a stale summary beats no summary when a source is down.
const FRESH_MS = 30 * 60 * 1000
const STALE_MS = 12 * 60 * 60 * 1000

const FETCH_TIMEOUT_MS = 12000
const MAX_BYTES_PER_SOURCE = 2 * 1024 * 1024
const MAX_CHARS_PER_SOURCE = 6000

// A plain fetch with no User-Agent gets blocked by several of these sites.
const USER_AGENT =
  'Mozilla/5.0 (compatible; SoundCaptain/1.0; +https://github.com/ericksoncharles-ui/BoatingTracker)'

async function fetchSource(source, signal) {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const response = await fetch(source.url, {
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const contentType = response.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    throw new Error(`Unexpected content type: ${contentType || 'unknown'}`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES_PER_SOURCE) {
    throw new Error('Response too large')
  }

  const text = htmlToText(new TextDecoder('utf-8').decode(buffer))
  if (text.length < 200) throw new Error('No readable report text')

  return text.slice(0, MAX_CHARS_PER_SOURCE)
}

async function collectSources(signal) {
  const settled = await Promise.allSettled(
    SOURCES.map((source) => fetchSource(source, signal)),
  )

  return SOURCES.map((source, i) => {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      return { ...source, status: 'ok', text: result.value }
    }
    console.warn(`Fishing source ${source.id} unavailable:`, result.reason?.message || result.reason)
    return { ...source, status: 'unavailable', text: null }
  })
}

function buildPrompt(reachable) {
  const excerpts = reachable
    .map((source) => `<report source="${source.label}" url="${source.url}">\n${source.text}\n</report>`)
    .join('\n\n')

  return [
    'Below are page excerpts scraped from fishing report sites covering Long Island Sound.',
    'They are raw page text, so they contain navigation and boilerplate alongside the reports.',
    '',
    excerpts,
    '',
    'Write a 3-5 sentence aggregate summary of what these reports say anglers are currently',
    'finding on Long Island Sound: which species are being caught, where (named spots, reefs,',
    'harbors, or general areas), and any bait, depth, or timing patterns the reports mention.',
    'Attribute claims to the reporting source by name when only one source says it, and call out',
    'where the sources agree. Use nautical, plain language for a boater reading at the helm.',
    '',
    'Ground every statement in the excerpts above — do not add species, spots, or seasonal',
    'knowledge of your own. If an excerpt has no usable fishing report in it (only navigation or',
    'boilerplate), ignore it rather than guessing. If none of the excerpts contain a usable',
    'report, reply with exactly: NO_REPORTS',
    'Do not restate size, bag, or season limits — those belong to the state regulators.',
    'Reply with the summary text only: no preamble, no headings, no bullet points.',
  ].join('\n')
}

let client = null
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

async function summarize(reachable) {
  const response = await getClient().messages.create({
    // Haiku 4.5 does not think unless given a thinking budget, and it rejects
    // the effort parameter outright — so neither knob appears here. max_tokens
    // is therefore a straight ceiling on the summary itself.
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: buildPrompt(reachable) }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('Summary request was declined.')
  }

  const text = response.content.find((block) => block.type === 'text')?.text?.trim() ?? ''
  if (!text || text === 'NO_REPORTS') {
    throw new Error('No usable report text in the sources.')
  }
  return text
}

let cache = null
let inFlight = null

async function generate() {
  const sources = await collectSources()
  const reachable = sources.filter((source) => source.status === 'ok')

  if (reachable.length === 0) {
    throw new Error('No fishing report sources could be reached.')
  }

  const summary = await summarize(reachable)

  return {
    summary,
    generatedAt: new Date().toISOString(),
    sources: sources.map(({ id, label, url, status }) => ({ id, label, url, status })),
  }
}

// Returns { payload, cached }. Falls back to a stale payload when a refresh
// fails, so one flaky source site does not blank the card.
export async function getFishingSummary() {
  const now = Date.now()
  if (cache && now - cache.at < FRESH_MS) {
    return { payload: cache.payload, cached: true }
  }

  if (!inFlight) {
    inFlight = generate()
      .then((payload) => {
        cache = { at: Date.now(), payload }
        return payload
      })
      .finally(() => {
        inFlight = null
      })
  }

  try {
    const payload = await inFlight
    return { payload, cached: false }
  } catch (error) {
    if (cache && now - cache.at < STALE_MS) {
      return { payload: cache.payload, cached: true }
    }
    throw error
  }
}

export const fishingSummarySources = SOURCES
