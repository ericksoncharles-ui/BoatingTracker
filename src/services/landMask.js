// Land/water lookups against the generated coastline bitmap.
//
// This is the router's ground truth for "is there water here". It replaced a
// dozen hand-placed keep-out circles that covered Eatons Neck, Lloyd Neck and
// the Elizabeth Islands and nothing else — so every short hop along the
// Connecticut shore, where the harbors are three miles apart and a peninsula
// sits between every pair of them, drew its course straight over the land.
//
// Keep this free of React imports: utils.js is pure navigation math and imports
// this.

import { LAND_MASK } from '../landMask.generated.js'

const { west, east, south, north, cols, rows } = LAND_MASK

const dLng = (east - west) / cols
const dLat = (north - south) / rows

// Decoded once on first use rather than at module load, so the base64 blob is
// not unpacked on a session that never plans a trip.
let bits = null
function mask() {
  if (bits) return bits
  const binary = atob(LAND_MASK.bits)
  bits = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bits[i] = binary.charCodeAt(i)
  return bits
}

export function cellSizeNM() {
  // The shorter side — what a sampling step has to respect to not step over a
  // one-cell isthmus.
  const lngNM = (dLng * 60) * Math.cos((41.1 * Math.PI) / 180)
  const latNM = dLat * 60
  return Math.min(lngNM, latNM)
}

export function colOf(lng) {
  return Math.floor((lng - west) / dLng)
}

export function rowOf(lat) {
  return Math.floor((lat - south) / dLat)
}

export function inBounds(lat, lng) {
  return lng >= west && lng <= east && lat >= south && lat <= north
}

function cellIsLand(r, c) {
  if (c < 0 || c >= cols || r < 0 || r >= rows) return false
  const i = r * cols + c
  return ((mask()[i >> 3] >> (i & 7)) & 1) === 1
}

export function isLandCell(r, c) {
  return cellIsLand(r, c)
}

export function isLand(lat, lng) {
  // Outside the covered box there is no data. Reporting "not land" keeps the
  // router from refusing a route it simply can't check, and every current
  // dropdown entry is well inside the box.
  if (!inBounds(lat, lng)) return false
  return cellIsLand(rowOf(lat), colOf(lng))
}

export function isWater(lat, lng) {
  return !isLand(lat, lng)
}

// Land anywhere in the square of `pad` cells around the point. The margin is
// what stops a course being drawn along a beach it technically clears: a rhumb
// line one cell off the shore is not water a skipper would take.
export function isLandNear(lat, lng, pad = 0) {
  if (!inBounds(lat, lng)) return false
  const r = rowOf(lat)
  const c = colOf(lng)
  for (let dr = -pad; dr <= pad; dr++) {
    for (let dc = -pad; dc <= pad; dc++) {
      if (cellIsLand(r + dr, c + dc)) return true
    }
  }
  return false
}

// Does the straight course from a to b touch land?
//
// This is the one place that answers that question — the router plans against
// it and the audit checks against it, so the two cannot drift apart. An earlier
// version had the router consulting its own coarser grid, which quietly
// disagreed with this one and passed courses straight over Stratford Point.
//
// Every cell the course touches is visited, rather than points along it being
// sampled: a sampled walk slips between two diagonally touching specks of land
// without either sample landing on one. The traversal runs between the true
// positions, not the centres of the cells they fall in — half a cell of error
// at each end swings the middle of a long leg by a cell, which is exactly the
// width of the spit it then fails to notice.
export function segmentHitsLand(aLat, aLng, bLat, bLng, pad = 0) {
  const x0 = (aLng - west) / dLng
  const y0 = (aLat - south) / dLat
  const x1 = (bLng - west) / dLng
  const y1 = (bLat - south) / dLat

  let cx = Math.floor(x0)
  let cy = Math.floor(y0)
  const ex = Math.floor(x1)
  const ey = Math.floor(y1)

  const dx = x1 - x0
  const dy = y1 - y0
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity
  let tMaxX = dx > 0 ? (cx + 1 - x0) / dx : dx < 0 ? (cx - x0) / dx : Infinity
  let tMaxY = dy > 0 ? (cy + 1 - y0) / dy : dy < 0 ? (cy - y0) / dy : Infinity

  const maxSteps = Math.abs(ex - cx) + Math.abs(ey - cy) + 4

  for (let n = 0; ; n++) {
    if (pad > 0) {
      for (let dr = -pad; dr <= pad; dr++) {
        for (let dc = -pad; dc <= pad; dc++) {
          if (cellIsLand(cy + dr, cx + dc)) return true
        }
      }
    } else if (cellIsLand(cy, cx)) {
      return true
    }
    if (cx === ex && cy === ey) return false
    if (n > maxSteps) return false
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX
      cx += stepX
    } else {
      tMaxY += tDeltaY
      cy += stepY
    }
  }
}

export const LAND_MASK_META = { west, east, south, north, cols, rows }
