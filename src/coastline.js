import { COASTLINE_BBOX, COASTLINE_RINGS } from './coastlineData.js'

// Real coastline, for the question the `headlands` circles could only answer
// where somebody had drawn one: does this straight line run over land?
//
// The polygons are the GSHHG full-resolution shoreline (see
// scripts/build-coastline.mjs), built from 1:250,000 source and good to about
// 100 m. That error budget shapes everything here. The router treats any
// crossing as land, since a course that close to a beach is wrong either way.
// The probe only calls a point land when it is further inside than the source
// can be wrong by, so a waypoint 50 m up a beach reads as "on the shore" rather
// than as an island crossing. Rocks and islets smaller than the source resolves
// (Execution Rocks, the Thimbles) are the shoal circles' job, not this file's.
//
// Plain functions over plain data and no React, like utils.js: the router, the
// probes and any future test all build the same thing.

// A shade over the source's 100 m (0.054 NM).
export const SHORE_ERROR_NM = 0.06

// An approach waypoint sits a few hundred yards off a harbor mouth, which is
// inside the source's error of the shore. A crossing this close to either end
// of a line is that error, not a course over land.
const ENDPOINT_GRACE_NM = 0.1

const BAND_DEG = 0.01

export function createCoastline({ bbox, rings }) {
  const bandCount = Math.ceil((bbox.maxLat - bbox.minLat) / BAND_DEG) + 1
  const colCount = Math.ceil((bbox.maxLng - bbox.minLng) / BAND_DEG) + 1
  const bandOf = (lat) => Math.floor((lat - bbox.minLat) / BAND_DEG)
  const colOf = (lng) => Math.min(colCount - 1, Math.max(0, Math.floor((lng - bbox.minLng) / BAND_DEG)))
  let bands = null
  let cells = null
  let seen = null
  let query = 0

  // Edges bucketed two ways, both built on first use so the planner never pays
  // for them until someone plans a trip. By latitude band, for isLand's ray,
  // which runs the width of the box; and by 0.01 degree cell, for crossesLand.
  // A detour search asks that of tens of thousands of short hops, and a band
  // holds every beach from the Hudson to Nantucket at that latitude.
  function index() {
    if (bands) return bands
    bands = Array.from({ length: bandCount }, () => [])
    cells = new Map()
    const edges = []
    for (const ring of rings) {
      const n = ring.length / 2
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        // The fifth slot numbers the edge, for crossesLand to skip one it has
        // already met in a neighbouring cell.
        const edge = [ring[2 * i], ring[2 * i + 1], ring[2 * j], ring[2 * j + 1], edges.length]
        edges.push(edge)
        const lo = Math.max(0, bandOf(Math.min(edge[1], edge[3])))
        const hi = Math.min(bandCount - 1, bandOf(Math.max(edge[1], edge[3])))
        const c0 = colOf(Math.min(edge[0], edge[2]))
        const c1 = colOf(Math.max(edge[0], edge[2]))
        for (let b = lo; b <= hi; b++) {
          bands[b].push(edge)
          for (let c = c0; c <= c1; c++) {
            const key = b * colCount + c
            if (!cells.has(key)) cells.set(key, [])
            cells.get(key).push(edge)
          }
        }
      }
    }
    seen = new Uint32Array(edges.length)
    return bands
  }

  const inBox = (lat, lng) =>
    lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng

  /** True when a point is inside the land polygons. Outside the box is water. */
  function isLand(lat, lng) {
    if (!inBox(lat, lng)) return false
    let inside = false
    for (const [x1, y1, x2, y2] of index()[bandOf(lat)]) {
      if ((y1 > lat) !== (y2 > lat) && x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1) > lng) inside = !inside
    }
    return inside
  }

  /** Distance from a point to the nearest shoreline, in NM. */
  function shoreDistanceNM(lat, lng) {
    const all = index()
    const cosLat = Math.cos((lat * Math.PI) / 180)
    // A tenth of a degree is six miles, far past any question worth asking.
    const lo = Math.max(0, bandOf(lat - 0.1))
    const hi = Math.min(bandCount - 1, bandOf(lat + 0.1))
    const seen = new Set()
    let best = Infinity
    for (let b = lo; b <= hi; b++) {
      for (const edge of all[b]) {
        if (seen.has(edge)) continue
        seen.add(edge)
        const [x1, y1, x2, y2] = edge
        if (Math.min(x1, x2) > lng + 0.15 || Math.max(x1, x2) < lng - 0.15) continue
        const ax = (x1 - lng) * cosLat * 60
        const ay = (y1 - lat) * 60
        const dx = (x2 - lng) * cosLat * 60 - ax
        const dy = (y2 - lat) * 60 - ay
        const lenSq = dx * dx + dy * dy
        const t = lenSq ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
      }
    }
    return best
  }

  /** How far inside land a point sits, in NM; 0 on the water. */
  function inlandNM(lat, lng) {
    return isLand(lat, lng) ? shoreDistanceNM(lat, lng) : 0
  }

  /**
   * True when the straight line from a to b runs over land anywhere but within
   * ENDPOINT_GRACE_NM of its ends.
   *
   * Tested against the shoreline's own edges rather than by sampling points
   * along the line, because the land a shortcut finds is often a barrier beach
   * or a spit a couple of hundred yards wide, which a sample every tenth of a
   * mile can step straight over.
   */
  function crossesLand(a, b, graceNM = ENDPOINT_GRACE_NM) {
    const cosLat = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
    const lengthNM = Math.hypot((b.lat - a.lat) * 60, (b.lng - a.lng) * 60 * cosLat)
    if (lengthNM <= 2 * graceNM) return false
    const tMin = graceNM / lengthNM
    const tMax = 1 - tMin

    index()
    const minLat = Math.min(a.lat, b.lat)
    const maxLat = Math.max(a.lat, b.lat)
    const minLng = Math.min(a.lng, b.lng)
    const maxLng = Math.max(a.lng, b.lng)
    const lo = Math.max(0, bandOf(minLat))
    const hi = Math.min(bandCount - 1, bandOf(maxLat))
    const rx = b.lng - a.lng
    const ry = b.lat - a.lat
    query += 1

    for (let band = lo; band <= hi; band++) {
      // Only the cells the line passes through in this band: the stretch of
      // longitude it covers between the band's two latitudes.
      let from = minLng
      let to = maxLng
      if (ry !== 0) {
        const bandLat = bbox.minLat + band * BAND_DEG
        const t0 = Math.min(1, Math.max(0, (bandLat - a.lat) / ry))
        const t1 = Math.min(1, Math.max(0, (bandLat + BAND_DEG - a.lat) / ry))
        from = Math.min(a.lng + rx * t0, a.lng + rx * t1)
        to = Math.max(a.lng + rx * t0, a.lng + rx * t1)
      }
      const c1 = colOf(to + 1e-9)
      for (let c = colOf(from - 1e-9); c <= c1; c++) {
        const cell = cells.get(band * colCount + c)
        if (!cell) continue
        for (const edge of cell) {
          const [x1, y1, x2, y2, id] = edge
          if (seen[id] === query) continue
          seen[id] = query
          if (Math.max(x1, x2) < minLng || Math.min(x1, x2) > maxLng) continue
          if (Math.max(y1, y2) < minLat || Math.min(y1, y2) > maxLat) continue
          const sx = x2 - x1
          const sy = y2 - y1
          const denom = rx * sy - ry * sx
          if (denom === 0) continue
          const t = ((x1 - a.lng) * sy - (y1 - a.lat) * sx) / denom
          const u = ((x1 - a.lng) * ry - (y1 - a.lat) * rx) / denom
          if (u >= 0 && u <= 1 && t > tMin && t < tMax) return true
        }
      }
    }

    // No shoreline crossed away from the ends, so the middle of the line is
    // either all water or all land.
    return isLand(a.lat + ry / 2, a.lng + rx / 2)
  }

  /**
   * Where a straight line runs over land, for the probe: the total and longest
   * continuous distance more than `margin` inland, and the deepest point. Null
   * when it stays on the water.
   */
  function landAlong(a, b, { stepNM = 0.02, margin = SHORE_ERROR_NM, graceNM = 0 } = {}) {
    const cosLat = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
    const lengthNM = Math.hypot((b.lat - a.lat) * 60, (b.lng - a.lng) * 60 * cosLat)
    const steps = Math.max(1, Math.ceil(lengthNM / stepNM))
    let total = 0
    let run = 0
    let longest = 0
    let deepest = 0
    let at = null
    for (let s = 1; s < steps; s++) {
      const along = (s / steps) * lengthNM
      if (along < graceNM || lengthNM - along < graceNM) continue
      const lat = a.lat + (b.lat - a.lat) * (s / steps)
      const lng = a.lng + (b.lng - a.lng) * (s / steps)
      const depth = inlandNM(lat, lng)
      if (depth > margin) {
        total += lengthNM / steps
        run += lengthNM / steps
        longest = Math.max(longest, run)
        if (depth > deepest) {
          deepest = depth
          at = { lat, lng }
        }
      } else {
        run = 0
      }
    }
    return at ? { lengthNM, landNM: total, longestNM: longest, deepestNM: deepest, at } : null
  }

  return { bbox, isLand, shoreDistanceNM, inlandNM, crossesLand, landAlong }
}

export const coastline = createCoastline({ bbox: COASTLINE_BBOX, rings: COASTLINE_RINGS })
