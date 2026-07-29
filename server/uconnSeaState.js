import Anthropic from '@anthropic-ai/sdk'
import { LIS_WAVE_STATIONS } from '../src/data.js'
import { keepPlausibleReading } from '../src/utils.js'
import { htmlToText } from './htmlText.js'

// Live sea state read straight off the UConn LISICOS buoys' own pages.
//
// The browser cannot do this itself: UConn's observing pages send no CORS
// headers, and its ERDDAP server is plain HTTP on a non-standard port, which an
// HTTPS page may not fetch at all. So the pages are read here, where neither
// applies, and Claude turns them into numbers.
//
// Claude rather than a scraper because these are human-facing observation
// panels — labels, units, and layout move around between stations and get
// redesigned without notice, and a selector-based parser would be the first
// thing to break. What it must not do is invent: everything it returns is
// range-checked below against the same bounds the ERDDAP reader uses, and
// anything outside them is dropped rather than shown. A missing sea state falls
// back to the ERDDAP feed and then to a wind estimate; a wrong one gets somebody
// into water they planned around.

const FRESH_MS = 10 * 60 * 1000
const STALE_MS = 3 * 60 * 60 * 1000

const FETCH_TIMEOUT_MS = 12000
const MAX_BYTES_PER_SOURCE = 2 * 1024 * 1024
const MAX_CHARS_PER_SOURCE = 8000

// An observation stamped in the future is a misread, and one older than this is
// not "live" by any reading — both drop the timestamp rather than the readings,
// so the card can still show numbers marked as time-unknown.
const CLOCK_SKEW_MS = 15 * 60 * 1000
const MAX_AGE_MS = 12 * 60 * 60 * 1000

// A plain fetch with no User-Agent gets blocked by several observing sites.
const USER_AGENT =
  'Mozilla/5.0 (compatible; SoundCaptain/1.0; +https://github.com/ericksoncharles-ui/BoatingTracker)'

export async function fetchPage(url, signal) {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const response = await fetch(url, {
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,text/plain',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const contentType = response.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
    throw new Error(`Unexpected content type: ${contentType || 'unknown'}`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES_PER_SOURCE) throw new Error('Response too large')

  const raw = new TextDecoder('utf-8').decode(buffer)
  const text = /text\/plain/i.test(contentType) ? raw.trim() : htmlToText(raw, { cells: true })
  // A panel that renders its numbers client-side leaves nothing behind for a
  // fetch to read. That is indistinguishable from a broken page here, and both
  // want the same answer: try the next source.
  if (text.length < 200) throw new Error('No readable observation text')

  return text.slice(0, MAX_CHARS_PER_SOURCE)
}

/**
 * Read one station, trying its sources in order. Returns the first readable
 * page, or an `unavailable` record naming why every source failed.
 */
async function readStation(station, signal) {
  const failures = []
  for (const source of station.sources || []) {
    try {
      const text = await fetchPage(source.url, signal)
      return { station, status: 'ok', source, text }
    } catch (error) {
      if (error.name === 'AbortError') throw error
      failures.push(`${source.label}: ${error.message}`)
    }
  }
  return { station, status: 'unavailable', reason: failures.join('; ') || 'No sources configured' }
}

// Claude is asked for each number exactly as the page prints it, paired with the
// unit it was printed in, and the conversion happens here. Asking the model to
// convert instead would put a units error — the one mistake this app's domain
// rules care most about — somewhere nothing can check it.
function measurement(units) {
  return {
    anyOf: [
      {
        type: 'object',
        properties: {
          value: { type: 'number' },
          unit: { type: 'string', enum: units },
        },
        required: ['value', 'unit'],
        additionalProperties: false,
      },
      { type: 'null' },
    ],
  }
}

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] }
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }

const READING_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    observedAt: nullableString,
    observedAtRaw: nullableString,
    waveHeight: measurement(['ft', 'm']),
    wavePeriodS: nullableNumber,
    waveMeanPeriodS: nullableNumber,
    waveDirDeg: nullableNumber,
    windSpeed: measurement(['kt', 'mph', 'm/s', 'km/h']),
    windGust: measurement(['kt', 'mph', 'm/s', 'km/h']),
    windDirDeg: nullableNumber,
    airTemp: measurement(['F', 'C']),
    waterTemp: measurement(['F', 'C']),
    pressure: measurement(['inHg', 'hPa', 'mb']),
  },
  required: [
    'id', 'observedAt', 'observedAtRaw', 'waveHeight', 'wavePeriodS', 'waveMeanPeriodS',
    'waveDirDeg', 'windSpeed', 'windGust', 'windDirDeg', 'airTemp', 'waterTemp', 'pressure',
  ],
  additionalProperties: false,
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: { buoys: { type: 'array', items: READING_SCHEMA } },
  required: ['buoys'],
  additionalProperties: false,
}

const TO_FEET = { ft: 1, m: 3.28084 }
const TO_KNOTS = { kt: 1, mph: 0.868976, 'm/s': 1.94384, 'km/h': 0.539957 }
const TO_INHG = { inHg: 1, hPa: 0.02953, mb: 0.02953 }

function round(value, places = 1) {
  if (value == null) return null
  const f = 10 ** places
  return Math.round(value * f) / f
}

function convert(measured, table, places = 1) {
  if (!measured || typeof measured.value !== 'number' || !Number.isFinite(measured.value)) return null
  const factor = table[measured.unit]
  if (factor == null) return null
  return round(measured.value * factor, places)
}

function toFahrenheit(measured) {
  if (!measured || typeof measured.value !== 'number' || !Number.isFinite(measured.value)) return null
  if (measured.unit === 'F') return round(measured.value, 1)
  if (measured.unit === 'C') return round((measured.value * 9) / 5 + 32, 1)
  return null
}

function normalizeDegrees(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > 360) return null
  return Math.round(value) % 360
}

function normalizeObservedAt(iso) {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  const age = Date.now() - at.getTime()
  if (age < -CLOCK_SKEW_MS || age > MAX_AGE_MS) return null
  return at.toISOString()
}

function buildPrompt(reachable) {
  const pages = reachable
    .map(
      (entry) =>
        `<buoy id="${entry.station.id}" name="${entry.station.name}" source="${entry.source.label}" url="${entry.source.url}">\n` +
        `${entry.text}\n</buoy>`,
    )
    .join('\n\n')

  return [
    'Below are the latest-observation pages for Long Island Sound buoys, stripped to text.',
    'Table cells are separated by "|", so a label and its value usually sit on the same line.',
    `The current time is ${new Date().toISOString()} (UTC).`,
    '',
    pages,
    '',
    'For each buoy above, report its most recent observation as one object in "buoys",',
    'using the same id given in the buoy tag.',
    '',
    'Rules:',
    '- Report each measurement exactly as the page prints it, with the unit it is printed in.',
    '  Do not convert between units and do not round.',
    '- observedAtRaw is the observation time exactly as printed. observedAt is that same time as',
    '  an ISO 8601 UTC timestamp. Pages often print a time zone (EDT/EST/GMT/UTC) or omit the',
    '  year — use the current time above to resolve it. If the page gives no observation time,',
    '  both are null. Never substitute the current time for a missing one.',
    '- Wave direction and wind direction are degrees true, the direction the waves or wind are',
    '  coming FROM. If a page gives only a compass point, convert it to its degrees.',
    '- Use null for anything the page does not report, reports as missing (blank, "MM", "-", "N/A"),',
    '  or reports for a different time than the latest observation.',
    '- Never estimate, infer, or carry a value over from another buoy or from a forecast on the',
    '  same page. These numbers are used to plan boat trips, so a missing reading is fine and a',
    '  guessed one is not. Report only observed values from that buoy.',
    '- If a page contains no usable observation at all, still return its object with every',
    '  measurement null.',
  ].join('\n')
}

let client = null
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

async function extractReadings(reachable) {
  const response = await getClient().messages.create({
    // Unlike the briefing and the fishing summary, this endpoint produces
    // numbers a skipper navigates on rather than prose they read, so it runs on
    // the strongest model. Effort stays low — reading a value off a labelled
    // panel is not a reasoning problem — and the 10-minute cache keeps the call
    // rate at a handful an hour however many people are on the water.
    model: 'claude-opus-5',
    max_tokens: 16000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    messages: [{ role: 'user', content: buildPrompt(reachable) }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('Sea state request was declined.')
  }

  const text = response.content.find((block) => block.type === 'text')?.text
  if (!text) throw new Error('Empty sea state response.')

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed?.buoys)) throw new Error('Sea state response had no buoys.')
  return parsed.buoys
}

function toReadings(extracted) {
  return {
    waveHeightFt: keepPlausibleReading('waveHeightFt', convert(extracted.waveHeight, TO_FEET)),
    wavePeriodS: keepPlausibleReading('wavePeriodS', round(extracted.wavePeriodS, 1)),
    waveMeanPeriodS: keepPlausibleReading('waveMeanPeriodS', round(extracted.waveMeanPeriodS, 1)),
    waveDirDeg: normalizeDegrees(extracted.waveDirDeg),
    windKt: keepPlausibleReading('windKt', convert(extracted.windSpeed, TO_KNOTS)),
    gustKt: keepPlausibleReading('gustKt', convert(extracted.windGust, TO_KNOTS)),
    windDirDeg: normalizeDegrees(extracted.windDirDeg),
    airTempF: keepPlausibleReading('airTempF', toFahrenheit(extracted.airTemp)),
    waterTempF: keepPlausibleReading('waterTempF', toFahrenheit(extracted.waterTemp)),
    pressureInHg: keepPlausibleReading('pressureInHg', convert(extracted.pressure, TO_INHG, 2)),
  }
}

async function generate() {
  const stations = await Promise.all(LIS_WAVE_STATIONS.map((station) => readStation(station)))
  const reachable = stations.filter((entry) => entry.status === 'ok')

  for (const entry of stations) {
    if (entry.status !== 'ok') {
      console.warn(`[uconnSeaState] ${entry.station.name} unavailable:`, entry.reason)
    }
  }

  if (reachable.length === 0) {
    throw new Error('No UConn buoy page could be reached.')
  }

  const extracted = await extractReadings(reachable)
  const byId = new Map(extracted.map((buoy) => [String(buoy.id), buoy]))

  const buoys = stations.map((entry) => {
    const { station } = entry
    const base = {
      id: station.id,
      name: station.name,
      label: station.label,
      operator: station.operator,
      lat: station.lat,
      lng: station.lng,
    }

    if (entry.status !== 'ok') {
      return { ...base, status: 'unavailable', reason: entry.reason }
    }

    const reading = byId.get(String(station.id))
    if (!reading) {
      return { ...base, status: 'unavailable', reason: 'No reading returned for this station' }
    }

    return {
      ...base,
      status: 'ok',
      source: { label: entry.source.label, url: entry.source.url },
      observedAt: normalizeObservedAt(reading.observedAt),
      observedAtRaw: reading.observedAtRaw || null,
      readings: toReadings(reading),
    }
  })

  return { generatedAt: new Date().toISOString(), buoys }
}

let cache = null
let inFlight = null

/**
 * Returns { payload, cached }. Falls back to a stale payload when a refresh
 * fails, so one unreachable page doesn't blank the sea state card.
 */
export async function getSeaState() {
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
