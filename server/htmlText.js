// Shared HTML -> text pass for the endpoints that read third-party pages.
//
// Deliberately not a parser. These are ordinary content pages and the useful
// material is prose or plain tables, so stripping markup and keeping the line
// breaks gets the page through without tying the app to any one site's markup —
// which is what a CSS-selector scraper would do, and what would break first.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', deg: '°',
}

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

/**
 * Strip markup, keeping paragraph breaks.
 *
 * `cells: true` also separates table cells with a pipe. Observation pages put
 * the label in one cell and the number in the next, and collapsing that run to
 * whitespace makes "Wave Height 2.3 Period 4" — the reader then has to guess
 * which number belongs to which label. Prose pages read better without it, so
 * it stays off by default.
 */
export function htmlToText(html, { cells = false } = {}) {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head|nav|footer|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')

  if (cells) text = text.replace(/<\/(td|th)\s*>/gi, ' | ')

  return decodeEntities(
    text
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
