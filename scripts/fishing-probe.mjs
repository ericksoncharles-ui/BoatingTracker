// Prints what the fishing summary actually reads from each source, so a card
// that says "no readable report text" can be traced to the source that caused
// it without spending an API call. Run with: npm run fishing:probe
import { fetchSource } from '../server/fishingSummary.js'
import { fishingLinks } from '../src/data.js'

const REPORT_KINDS = new Set(['shop', 'aggregate'])
const SOURCES = fishingLinks.filter((link) => REPORT_KINDS.has(link.kind))
const PREVIEW_CHARS = Number(process.argv[2]) || 600

let ok = 0

for (const source of SOURCES) {
  console.log('='.repeat(72))
  console.log(`${source.label}\n${source.url}`)

  try {
    const { text, via } = await fetchSource(source)
    ok += 1
    console.log(`read ${text.length} chars via ${via}`)
    console.log('-'.repeat(72))
    console.log(text.slice(0, PREVIEW_CHARS))
    if (text.length > PREVIEW_CHARS) console.log(`… (+${text.length - PREVIEW_CHARS} more)`)
  } catch (error) {
    console.log(`UNAVAILABLE: ${error.message}`)
  }
  console.log()
}

console.log('='.repeat(72))
console.log(`${ok}/${SOURCES.length} sources readable`)

// Whether the text above actually contains fishing reports is the thing to
// eyeball: if it is menus and category names, the summary will come back
// NO_REPORTS no matter what the model is asked.
if (ok === 0) process.exitCode = 1
