import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { getFishingSummary } from './fishingSummary.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const app = express()
app.set('trust proxy', 1)
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
    return res.status(429).json({ error: 'Too many briefing requests. Try again shortly.' })
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

  return [
    'You are a friendly harbor master. Give a 2-3 sentence trip briefing for a boating trip',
    `from ${text(trip.startName) || 'the marina'} to ${text(trip.destName) || 'the destination'},`,
    `${number(trip.distanceNM, 10000)} nautical miles across Long Island Sound.`,
    `Travel time is about ${text(trip.travelTimeFormatted, 40) || 'a short run'} at`,
    `${number(trip.cruisingSpeed, 100)} knots cruising speed.`,
    `Fuel usage is ${number(trip.fuelPercentUsed, 1000)}% of tank.`,
    poiNames ? `Nearby points of interest: ${poiNames}.` : '',
    'Recommend one anchorage, mention fuel confidence, and keep it nautical and friendly.',
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
    return res.status(503).json({ error: 'Fishing summary service is not configured.' })
  }

  try {
    const { payload, cached } = await getFishingSummary()
    // A cached summary is minutes old at most, but the reports behind it change
    // weekly — let a proxy hold it briefly rather than re-scraping per visitor.
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ ...payload, cached })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Summary service is busy. Try again shortly.' })
    }
    console.error('Fishing summary failed:', error?.message || error)
    res.status(502).json({ error: 'Could not summarize the fishing reports.' })
  }
})

// Serve the built SPA when one exists, so a single process runs the whole app.
const distDir = path.resolve(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Briefing API listening on http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — briefings will fall back to the offline text.')
  }
})
