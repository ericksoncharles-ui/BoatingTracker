// Prints what the sea-state reader actually pulls off each UConn/NDBC buoy
// page, so a card that reports every reading as null can be traced to the
// source that caused it without spending an API call. Run with:
// npm run sea-state:probe
import { fetchPage } from '../server/uconnSeaState.js'
import { LIS_WAVE_STATIONS } from '../src/data.js'

const PREVIEW_CHARS = Number(process.argv[2]) || 600

let ok = 0
let attempts = 0

for (const station of LIS_WAVE_STATIONS) {
  console.log('='.repeat(72))
  console.log(station.label)

  for (const source of station.sources) {
    attempts += 1
    console.log('-'.repeat(72))
    console.log(`${source.label}\n${source.url}`)

    try {
      const text = await fetchPage(source.url)
      ok += 1
      console.log(`read ${text.length} chars`)
      console.log(text.slice(0, PREVIEW_CHARS))
      if (text.length > PREVIEW_CHARS) console.log(`… (+${text.length - PREVIEW_CHARS} more)`)
    } catch (error) {
      console.log(`UNAVAILABLE: ${error.message}`)
    }
  }
  console.log()
}

console.log('='.repeat(72))
console.log(`${ok}/${attempts} sources readable`)

// Whether the text above actually contains a labelled observation (wave
// height, wind, water temp) is the thing to eyeball: if it is nav chrome, a
// JS-rendered panel shell, or a "no recent data" notice, the sea-state card
// will report every reading as null no matter what the model is asked.
if (ok === 0) process.exitCode = 1
