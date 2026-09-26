import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { getFishingSummary } from './fishingSummary.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

// Which X-Forwarded-For hops to believe when working out a caller's IP, and so
// whose budget a request spends in the rate limit below. Behind one proxy that
// appends the address it saw (most hosts) that is 1, the default. Exposed
// directly, it has to be 0: otherwise the header is whatever the caller typed,
// and a fresh one per request is a fresh budget. See .env.example.
function trustProxySetting(value = '1') {
  const setting = value.trim()
  if (/^(false|no|off)$/i.test(setting)) return false
  if (/^(true|yes|on)$/i.test(setting)) return true
  if (/^\d+$/.test(setting)) return Number(setting)
  return setting
}

const app = express()
app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY))
app.disable('x-powered-by')
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Only what the page does not load: framing, plugins and <base>. The
    // chart tiles, fonts and condition feeds come from half a dozen hosts, and
    // a source list that misses one blanks a card rather than failing loudly.
    'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  })
  next()
})
app.use(express.json({ limit: '8kb' }))

// The SDK constructor throws when no key is configured, so build it lazily and
// let the route return 503 instead — the client falls back to its local briefing.
let client = null
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

// Basic per-IP throttle. The endpoint is public once deployed, so without this
// anyone who finds it can spend the API key by hammering it.
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 30
const hits = new Map()

function rateLimit(req, res, next) {
  const now = Date.now()
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key)
  }
  const entry = hits.get(req.ip)
  if (!entry) {
    hits.set(req.ip, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }
  if (entry.count >= MAX_REQUESTS) {
    // Both endpoints share this budget, so the message names neither. The
    // reason is the one the Fishing card already turns into "try again shortly".
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
    return res.status(429).json({ error: 'Too many requests. Try again shortly.', reason: 'busy' })
  }
  entry.count += 1
  next()
}

// Trip values arrive from the browser, so they are untrusted. Clamp them before
// they reach the prompt — this endpoint builds its own prompt and never accepts
// prompt text from the client.
function text(value, maxLength = 80) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function number(value, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(n, 0), max)
}

function buildPrompt(trip) {
  const poiNames = Array.isArray(trip.nearbyPOIs)
    ? trip.nearbyPOIs.slice(0, 5).map((name) => text(name)).filter(Boolean).join(', ')
    : ''

  // The two ends can now be in different waters — Long Island Sound to Nantucket
  // Sound, say — so the prompt names them instead of asserting the Sound. Region
  // names are clamped like every other client value; the phrase is built here,
  // not accepted from the browser.
  const startRegion = text(trip.startRegion, 40)
  const destRegion = text(trip.destRegion, 40)
  const waters = !startRegion
    ? 'across Long Island Sound'
    : startRegion === destRegion
      ? `across ${startRegion}`
      : `from ${startRegion} to ${destRegion || startRegion}`

  return [
    'You are a navigator preparing a pre-departure trip brief for another captain.',
    'Write 2-3 sentences, factual and technical in register — no jokes, no exclamation points,',
    'no nautical flourishes for their own sake. State figures plainly, as a mate reading off a passage plan would.',
    `Passage: ${text(trip.startName) || 'the marina'} to ${text(trip.destName) || 'the destination'},`,
    `${number(trip.distanceNM, 10000)} nautical miles ${waters}.`,
    `Estimated transit time is ${text(trip.travelTimeFormatted, 40) || 'unspecified'} at`,
    `${number(trip.cruisingSpeed, 100)} knots cruising speed.`,
    `Projected fuel usage is ${number(trip.fuelPercentUsed, 1000)}% of tank capacity.`,
    poiNames ? `Points of interest along the route: ${poiNames}.` : '',
    'Note one anchorage or stopping point if relevant, and state fuel margin plainly. Do not editorialize.',
  ].filter(Boolean).join(' ')
}

app.post('/api/briefing', rateLimit, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Briefing service is not configured.' })
  }

  try {
    const response = await getClient().messages.create({
      // Haiku 4.5 does not think unless given a thinking budget, and it rejects
      // the effort parameter outright — so neither knob appears here. A 2-3
      // sentence briefing wants neither anyway.
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: buildPrompt(req.body || {}) }],
    })

    const briefing = response.content.find((block) => block.type === 'text')?.text ?? ''
    if (!briefing) {
      return res.status(502).json({ error: 'Empty briefing returned.' })
    }
    res.json({ briefing })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Briefing service is busy. Try again shortly.' })
    }
    // Log server-side only — error bodies can echo request details back.
    console.error('Briefing request failed:', error?.message || error)
    res.status(502).json({ error: 'Could not generate a briefing.' })
  }
})

// Reads the fishing report pages the Fishing tab links to and returns one
// aggregate summary. The heavy lifting (fetching, caching, prompting) lives in
// fishingSummary.js; this route only maps failures onto status codes, and the
// client falls back to its own copy on anything but a 200.
app.get('/api/fishing-summary', rateLimit, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'Fishing summary service is not configured.',
      reason: 'not_configured',
    })
  }

  try {
    const { payload, cached } = await getFishingSummary()
    // A cached summary is minutes old at most, but the reports behind it change
    // weekly — let a proxy hold it briefly rather than re-scraping per visitor.
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ ...payload, cached })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({
        error: 'Summary service is busy. Try again shortly.',
        reason: 'busy',
      })
    }
    // The reason travels to the client so the card can say what actually went
    // wrong; the stack stays here.
    console.error('Fishing summary failed:', error?.message || error)
    res.status(502).json({
      error: 'Could not summarize the fishing reports.',
      reason: error?.reason || 'failed',
      sources: error?.sources,
    })
  }
})

// An /api path that isn't one of the above is a client bug or a probe. Without
// this it fell through to the SPA below and came back as a 200 page of HTML.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

// Serve the built SPA when one exists, so a single process runs the whole app.
const distDir = path.resolve(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  // Built files are named by content hash, so a phone can keep one for good
  // instead of revalidating the bundle over a marine connection on every open.
  app.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(distDir))
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Briefing API listening on http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — briefings will fall back to the offline text.')
  }
})
