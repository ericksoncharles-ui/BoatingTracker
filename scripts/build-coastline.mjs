#!/usr/bin/env node
// Builds src/coastlineData.js, the land polygons the router refuses to cut
// across and route:probe checks every route against.
//
// The hand-drawn `headlands` circles in src/data.js can only catch the land
// somebody thought to draw, and a straight shortcut between two harbors found
// the rest: Fishers Island, the Rhode Island beaches, Prudence, Quonset Point.
// This is real shoreline, so a shortcut over land is rejected in the router and
// a waypoint on a beach shows up in the probe instead of on the water.
//
// Source: GSHHG, the Global Self-consistent Hierarchical High-resolution
// Geography (Wessel & Smith, LGPL-3.0), at its full resolution, which is built
// from the 1:250,000 World Vector Shoreline. It is fetched on demand from the
// basemap-data-hires wheel on PyPI rather than installed, clipped to the
// planner's waters, and thinned to within SIMPLIFY_M of the original. Island
// coverage is why it is this dataset and not an OpenStreetMap extract: the
// OSM-derived packages on npm are simplified until Cuttyhunk is a triangle and
// Falkner Island is gone.
//
// Usage:
//   npm run coastline:build

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const WHEEL = { name: 'basemap-data-hires', version: '2.0.0' }
const DATA = 'mpl_toolkits/basemap_data/gshhs_f.dat'
const META = 'mpl_toolkits/basemap_data/gshhsmeta_f.dat'

// Everything a route can reach, with a margin: City Island to Nantucket, Montauk
// to the head of Buzzards Bay.
const BBOX = { minLat: 40.70, maxLat: 41.85, minLng: -73.95, maxLng: -69.85 }

// Douglas-Peucker tolerance. The source itself is good to about 100 m, so this
// drops points without moving the shoreline in any way that matters, and takes
// the file from 385 KB to about 230.
const SIMPLIFY_M = 30

// Four decimals is about ten metres.
const PLACES = 4

const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, '..', 'src', 'coastlineData.js')

async function fetchWheel() {
  const info = await (await fetch(`https://pypi.org/pypi/${WHEEL.name}/${WHEEL.version}/json`)).json()
  const wheel = info.urls.find((file) => file.filename.endsWith('.whl'))
  console.log(`Fetching ${wheel.url}`)
  return Buffer.from(await (await fetch(wheel.url)).arrayBuffer())
}

// Just enough of the zip format to pull two members out of a wheel.
function unzip(buffer, wanted) {
  let eocd = buffer.length - 22
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1
  if (eocd < 0) throw new Error('Not a zip file')
  const entries = buffer.readUInt16LE(eocd + 10)
  let at = buffer.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < entries; i++) {
    const method = buffer.readUInt16LE(at + 10)
    const compressed = buffer.readUInt32LE(at + 20)
    const nameLength = buffer.readUInt16LE(at + 28)
    const extraLength = buffer.readUInt16LE(at + 30)
    const commentLength = buffer.readUInt16LE(at + 32)
    const local = buffer.readUInt32LE(at + 42)
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength)
    if (wanted.includes(name)) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
      const body = buffer.subarray(start, start + compressed)
      out[name] = method === 0 ? body : zlib.inflateRawSync(body)
    }
    at += 46 + nameLength + extraLength + commentLength
  }
  return out
}

// gshhsmeta lines are "level area points south north offset bytes ...", and the
// data file is little-endian float32 lon/lat pairs at that offset. Level 1 is
// land and 2 is a lake in it; the even-odd rule reads both correctly, and the
// region has no deeper levels.
function readPolygons(meta, data) {
  const polygons = []
  for (const line of meta.toString('utf8').split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f.length < 7) continue
    const [level, , points, south, north, offset, bytes] = f.map(Number)
    if (level > 2 || north < BBOX.minLat || south > BBOX.maxLat) continue
    if (bytes !== points * 8) throw new Error('Unexpected gshhs record size')
    const pts = []
    for (let i = 0; i < points; i++) {
      let lng = data.readFloatLE(offset + i * 8)
      const lat = data.readFloatLE(offset + i * 8 + 4)
      if (lng > 180) lng -= 360
      pts.push([lng, lat])
    }
    polygons.push(pts)
  }
  return polygons
}

// Sutherland-Hodgman against the box. Polygon-with-rectangle intersection is
// exact for point-in-polygon purposes inside the box, which is all anything
// asks of it.
function clipRing(ring) {
  const inside = [
    (p) => p[0] >= BBOX.minLng, (p) => p[0] <= BBOX.maxLng,
    (p) => p[1] >= BBOX.minLat, (p) => p[1] <= BBOX.maxLat,
  ]
  const cut = [
    (a, b) => [BBOX.minLng, a[1] + ((BBOX.minLng - a[0]) / (b[0] - a[0])) * (b[1] - a[1])],
    (a, b) => [BBOX.maxLng, a[1] + ((BBOX.maxLng - a[0]) / (b[0] - a[0])) * (b[1] - a[1])],
    (a, b) => [a[0] + ((BBOX.minLat - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), BBOX.minLat],
    (a, b) => [a[0] + ((BBOX.maxLat - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), BBOX.maxLat],
  ]
  let points = ring
  for (let e = 0; e < 4 && points.length; e++) {
    const next = []
    for (let i = 0; i < points.length; i++) {
      const cur = points[i]
      const prev = points[(i + points.length - 1) % points.length]
      if (inside[e](cur)) {
        if (!inside[e](prev)) next.push(cut[e](prev, cur))
        next.push(cur)
      } else if (inside[e](prev)) {
        next.push(cut[e](prev, cur))
      }
    }
    points = next
  }
  return points
}

const M_PER_DEG_LAT = 111320
const M_PER_DEG_LNG = 111320 * Math.cos((((BBOX.minLat + BBOX.maxLat) / 2) * Math.PI) / 180)

function simplify(points) {
  if (points.length < 4) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    const dx = (points[last][0] - points[first][0]) * M_PER_DEG_LNG
    const dy = (points[last][1] - points[first][1]) * M_PER_DEG_LAT
    const lenSq = dx * dx + dy * dy
    let worst = -1
    let worstDist = 0
    for (let i = first + 1; i < last; i++) {
      const px = (points[i][0] - points[first][0]) * M_PER_DEG_LNG
      const py = (points[i][1] - points[first][1]) * M_PER_DEG_LAT
      const t = lenSq ? Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq)) : 0
      const d = Math.hypot(px - t * dx, py - t * dy)
      if (d > worstDist) {
        worstDist = d
        worst = i
      }
    }
    if (worst !== -1 && worstDist > SIMPLIFY_M) {
      keep[worst] = 1
      stack.push([first, worst], [worst, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

// Pass a directory holding gshhs_f.dat and gshhsmeta_f.dat to skip the download.
const members = process.argv[2]
  ? {
      [DATA]: fs.readFileSync(path.join(process.argv[2], 'gshhs_f.dat')),
      [META]: fs.readFileSync(path.join(process.argv[2], 'gshhsmeta_f.dat')),
    }
  : unzip(await fetchWheel(), [DATA, META])

const rings = []
let vertices = 0
const f = 10 ** PLACES
for (const polygon of readPolygons(members[META], members[DATA])) {
  let minLng = Infinity
  let maxLng = -Infinity
  for (const [lng] of polygon) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  if (maxLng < BBOX.minLng || minLng > BBOX.maxLng) continue
  const closed = polygon.length > 1 && polygon[0][0] === polygon.at(-1)[0] && polygon[0][1] === polygon.at(-1)[1]
  const ring = simplify(clipRing(closed ? polygon.slice(0, -1) : polygon))
  if (ring.length < 3) continue
  rings.push(ring.flatMap(([lng, lat]) => [Math.round(lng * f) / f, Math.round(lat * f) / f]))
  vertices += ring.length
}

fs.writeFileSync(outFile, [
  '// Generated by scripts/build-coastline.mjs (npm run coastline:build). Do not edit.',
  '//',
  `// GSHHG full resolution via ${WHEEL.name} ${WHEEL.version}, clipped to the`,
  `// planner's waters and simplified to within ${SIMPLIFY_M} m. GSHHG is (c) Paul Wessel and`,
  '// Walter H. F. Smith and is distributed under the GNU Lesser General Public',
  '// License v3 (https://www.soest.hawaii.edu/pwessel/gshhg/); this file, being',
  '// derived from it, is under the same license.',
  '//',
  '// Each ring is a flat [lng, lat, lng, lat, ...] list, read with the even-odd',
  '// rule, so a lake needs no flag of its own.',
  `export const COASTLINE_ATTRIBUTION = 'Shoreline: GSHHG (LGPL)'`,
  `export const COASTLINE_BBOX = ${JSON.stringify(BBOX)}`,
  `export const COASTLINE_RINGS = [\n${rings.map((ring) => `  ${JSON.stringify(ring)},`).join('\n')}\n]`,
  '',
].join('\n'))
console.log(`Wrote ${outFile}: ${rings.length} rings, ${vertices} vertices, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`)
