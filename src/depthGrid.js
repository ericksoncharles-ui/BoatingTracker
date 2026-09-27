// Charted depth, cell by cell, from City Island to Nantucket: the water the
// router plans through.
//
// Built by scripts/build-depth.py from NOAA's National Bathymetric Source
// navigation surfaces, the compiled surveys the ENCs are drawn from, on chart
// datum (MLLW). Each cell is about 18.5 m square and holds the least depth
// surveyed anywhere in it, so a rock or the lip of a bar is never averaged into
// the deep water beside it. Depths are kept as a count of DEPTH steps reached
// (0 is dry at low water, land, or not surveyed; see stepsFt in the header),
// which is all a go/no-go question for a keel needs.
//
// Each cell also carries the least depth within about a hundred yards of it
// (header.clearanceM), in the high four bits of its byte: the survey has the
// soundings but not the rocks drawn between them or the buoys set off a ledge,
// and a route that keeps that far from anything too shallow for the boat stays
// outside them. The router charges for water whose surroundings are shallow;
// a narrow channel is all such water, and still the way in.
//
// Most of the region is one value over wide areas: the middle of the Sound,
// the interior of Long Island. So cells are grouped 8 x 8 into blocks and blocks
// 8 x 8 into super-blocks (about 1.2 km square), and a group that is one value
// throughout is stored, and walked by the router, as that one value. The router
// calls each such square a leaf: a super-block, a block, or a single cell.
//
// The file (public/depth-grid.bin) is gzip over:
//   'DGRD', u16 version, u32 header length, header JSON,
//   super-block codes      one byte each, row-major; 255 = split into blocks
//   block codes            64 per split super-block, in order; 255 = split
//   cell values            64 per split block, in order
// where a code or value is depth | around << 4 (version 1 had depth only).
//
// Plain functions over plain data and no React, like utils.js.

export const DEPTH_GRID_URL = '/depth-grid.bin'
export const DEPTH_ATTRIBUTION = 'Depths: NOAA National Bathymetric Source'

const MAGIC = 'DGRD'
const FORMAT_VERSION = 2
const SPLIT = 255
const B = 8 // cells per block side
const S = 64 // cells per super-block side

/**
 * The grid, from the decompressed file contents.
 */
export function decodeDepthGrid(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const magic = String.fromCharCode(...bytes.subarray(0, 4))
  if (magic !== MAGIC) throw new Error('Not a depth grid')
  const version = view.getUint16(4, true)
  if (version !== FORMAT_VERSION && version !== 1) throw new Error(`Depth grid format ${version} is not supported`)
  const headLength = view.getUint32(6, true)
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(10, 10 + headLength)))
  if (header.block !== B || header.block * header.super !== S) throw new Error('Unexpected depth grid layout')

  let at = 10 + headLength
  const superCodes = bytes.subarray(at, (at += header.superRows * header.superCols))
  const blockCodes = bytes.subarray(at, (at += header.counts.blockCodes))
  const cellValues = bytes.subarray(at, (at += header.counts.fineValues))
  if (cellValues.length !== header.counts.fineValues) throw new Error('Depth grid is truncated')
  // A version 1 grid, kept by a service worker from before, knows nothing of
  // the water around a cell: read it as clear all round, as it was planned.
  const upgrade = (codes) => (version === 1 ? codes.map((v) => (v === SPLIT ? v : v | (v << 4))) : codes)
  return createDepthGrid({
    header, superCodes: upgrade(superCodes), blockCodes: upgrade(blockCodes), cellValues: upgrade(cellValues),
  })
}

export function createDepthGrid({ header, superCodes: superRaw, blockCodes: blockRaw, cellValues: cellRaw }) {
  const { minLat, maxLat, minLng, dLat, dLng, superRows, superCols, stepsFt } = header
  const superCount = superRaw.length
  const blockCount = blockRaw.length

  // Each byte split in two: its depth, and the least depth around it.
  const depthOf = (raw) => raw.map((v) => (v === SPLIT ? SPLIT : v & 15))
  const aroundOf = (raw) => raw.map((v) => (v === SPLIT ? SPLIT : v >> 4))
  const superCodes = depthOf(superRaw)
  const blockCodes = depthOf(blockRaw)
  const cellValues = depthOf(cellRaw)
  const superAround = aroundOf(superRaw)
  const blockAround = aroundOf(blockRaw)
  const cellAround = aroundOf(cellRaw)

  // Where each split super-block's codes start, and whose each run of 64 codes
  // is; the same one level down for split blocks.
  const superFirst = new Int32Array(superCount).fill(-1)
  const superOfGroup = new Int32Array(blockCount / 64)
  for (let s = 0, g = 0; s < superCount; s++) {
    if (superCodes[s] === SPLIT) {
      superFirst[s] = g * 64
      superOfGroup[g++] = s
    }
  }
  const blockFirst = new Int32Array(blockCount).fill(-1)
  const blockOfGroup = new Int32Array(cellValues.length / 64)
  for (let b = 0, g = 0; b < blockCount; b++) {
    if (blockCodes[b] === SPLIT) {
      blockFirst[b] = g * 64
      blockOfGroup[g++] = b
    }
  }

  // Inside a split block, a 4 x 4 or 2 x 2 square of one depth is a leaf of
  // its own too: a block with a corner of beach in it is otherwise sixty-four
  // leaves for the router to step through, most of them the same water.
  // Recorded per cell as the side of the square it belongs to. A square is
  // close to shallows if any cell of it is: split on that too, the band along
  // every shore went cell by cell, and routes took twice as long to plan.
  const cellSize = new Uint8Array(cellValues.length).fill(1)
  const squareAround = cellAround.slice()
  const uniform = (base, r, c, n) => {
    const v = cellValues[base + r * 8 + c]
    for (let i = r; i < r + n; i++) {
      for (let j = c; j < c + n; j++) if (cellValues[base + i * 8 + j] !== v) return false
    }
    return true
  }
  const mark = (base, r, c, n) => {
    let lo = 255
    for (let i = r; i < r + n; i++) {
      cellSize.fill(n, base + i * 8 + c, base + i * 8 + c + n)
      for (let j = c; j < c + n; j++) lo = Math.min(lo, cellAround[base + i * 8 + j])
    }
    squareAround[base + r * 8 + c] = lo
  }
  for (let base = 0; base < cellValues.length; base += 64) {
    for (let qr = 0; qr < 8; qr += 4) {
      for (let qc = 0; qc < 8; qc += 4) {
        if (uniform(base, qr, qc, 4)) {
          mark(base, qr, qc, 4)
          continue
        }
        for (let hr = qr; hr < qr + 4; hr += 2) {
          for (let hc = qc; hc < qc + 4; hc += 2) {
            if (uniform(base, hr, hc, 2)) mark(base, hr, hc, 2)
          }
        }
      }
    }
  }

  const rows = superRows * S
  const cols = superCols * S

  // Leaves are numbered super-blocks first, then blocks, then cells, by their
  // index in the arrays above; a square of cells by its top-left cell. -1 is
  // off the grid, which is as good as dry.
  function leafAtCell(r, c) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return -1
    const s = (r >> 6) * superCols + (c >> 6)
    if (superCodes[s] !== SPLIT) return s
    const b = superFirst[s] + ((r >> 3) & 7) * 8 + ((c >> 3) & 7)
    if (blockCodes[b] !== SPLIT) return superCount + b
    const first = blockFirst[b]
    const n = cellSize[first + (r & 7) * 8 + (c & 7)]
    return superCount + blockCount + first + ((r & 7) & -n) * 8 + ((c & 7) & -n)
  }

  function leafValueOf(id) {
    if (id < 0) return 0
    if (id < superCount) return superCodes[id]
    if (id < superCount + blockCount) return blockCodes[id - superCount]
    return cellValues[id - superCount - blockCount]
  }

  // The square a leaf covers, in cells: [r0, r0 + size) x [c0, c0 + size).
  // Written into `out` rather than returned, since the router asks this of
  // every leaf it touches.
  function leafRect(id, out) {
    if (id < superCount) {
      const sr = (id / superCols) | 0
      out[0] = sr * S
      out[1] = (id - sr * superCols) * S
      out[2] = S
      return out
    }
    let cell = -1
    let b = id - superCount
    if (b >= blockCount) {
      cell = b - blockCount
      b = blockOfGroup[cell >> 6]
    }
    const s = superOfGroup[b >> 6]
    const sr = (s / superCols) | 0
    const i = b & 63
    out[0] = sr * S + (i >> 3) * B
    out[1] = (s - sr * superCols) * S + (i & 7) * B
    out[2] = B
    if (cell >= 0) {
      out[0] += (cell & 63) >> 3
      out[1] += cell & 7
      out[2] = cellSize[cell]
    }
    return out
  }

  function leafAroundOf(id) {
    if (id < 0) return 0
    if (id < superCount) return superAround[id]
    if (id < superCount + blockCount) return blockAround[id - superCount]
    return squareAround[id - superCount - blockCount]
  }

  const valueAtCellOf = (r, c) => leafValueOf(leafAtCell(r, c))
  const cellView = { leafAt: leafAtCell, leafValue: leafValueOf, leafAround: leafAroundOf }

  // The shallowest and deepest step in each block and super-block. A route
  // needing 5 ft sees a block whose cells run 8 to 25 ft as one square of
  // deep water, however many depths are in it: see viewFor.
  const blockMin = new Uint8Array(blockCount)
  const blockMax = new Uint8Array(blockCount)
  for (let b = 0; b < blockCount; b++) {
    if (blockCodes[b] !== SPLIT) {
      blockMin[b] = blockMax[b] = blockCodes[b]
      continue
    }
    let lo = 255
    let hi = 0
    for (let f = blockFirst[b]; f < blockFirst[b] + 64; f++) {
      if (cellValues[f] < lo) lo = cellValues[f]
      if (cellValues[f] > hi) hi = cellValues[f]
    }
    blockMin[b] = lo
    blockMax[b] = hi
  }
  const superMin = new Uint8Array(superCount)
  const superMax = new Uint8Array(superCount)
  for (let s = 0; s < superCount; s++) {
    if (superCodes[s] !== SPLIT) {
      superMin[s] = superMax[s] = superCodes[s]
      continue
    }
    let lo = 255
    let hi = 0
    for (let b = superFirst[s]; b < superFirst[s] + 64; b++) {
      if (blockMin[b] < lo) lo = blockMin[b]
      if (blockMax[b] > hi) hi = blockMax[b]
    }
    superMin[s] = lo
    superMax[s] = hi
  }

  // The least depth around any cell of each block and super-block.
  const blockAroundMin = new Uint8Array(blockCount)
  for (let b = 0; b < blockCount; b++) {
    if (blockCodes[b] !== SPLIT) {
      blockAroundMin[b] = blockAround[b]
      continue
    }
    let lo = 255
    for (let f = blockFirst[b]; f < blockFirst[b] + 64; f++) if (cellAround[f] < lo) lo = cellAround[f]
    blockAroundMin[b] = lo
  }
  const superAroundMin = new Uint8Array(superCount)
  for (let s = 0; s < superCount; s++) {
    if (superCodes[s] !== SPLIT) {
      superAroundMin[s] = superAround[s]
      continue
    }
    let lo = 255
    for (let b = superFirst[s]; b < superFirst[s] + 64; b++) if (blockAroundMin[b] < lo) lo = blockAroundMin[b]
    superAroundMin[s] = lo
  }

  // The least, over each super-block's blocks, of the deepest cell in each.
  const superLeastBlockMax = new Uint8Array(superCount)
  for (let s = 0; s < superCount; s++) {
    if (superCodes[s] !== SPLIT) {
      superLeastBlockMax[s] = superCodes[s]
      continue
    }
    let lo = 255
    for (let b = superFirst[s]; b < superFirst[s] + 64; b++) if (blockMax[b] < lo) lo = blockMax[b]
    superLeastBlockMax[s] = lo
  }

  /**
   * A rough map of the water, for the router to find which way to go before
   * it looks cell by cell (router.js): blocks, and whole super-blocks where
   * every block has water deep enough in it. A block counts as deep as the
   * deepest cell in it, so a pass one cell wide is still a way through; the
   * price is that now and then a breakwater is too, which the search cell by
   * cell then finds is not.
   */
  function roughViewFor(need) {
    return {
      leafAt: (r, c) => {
        if (r < 0 || c < 0 || r >= rows || c >= cols) return -1
        const s = (r >> 6) * superCols + (c >> 6)
        if (superCodes[s] !== SPLIT || superLeastBlockMax[s] >= need) return s
        return superCount + superFirst[s] + ((r >> 3) & 7) * 8 + ((c >> 3) & 7)
      },
      leafValue: (id) => {
        if (id < 0) return 0
        if (id < superCount) return superCodes[id] !== SPLIT ? superCodes[id] : superMax[id]
        return blockMax[id - superCount]
      },
    }
  }

  /**
   * The leaves as one route sees them. A block or super-block is a single
   * leaf when every cell in it is deep enough for the boat (`need` or more),
   * and a super-block only when clear of anything shallower all round too,
   * since a route charged for going close in across all of it for one rock at
   * its edge would steer round a mile of open water; or when none of it is
   * water the route may use: all of it too shallow, and
   * `unusable(r0, c0, size, deepest)` says that square is too far from either
   * end for shallow or dry water to be allowed there. Most of the cells along
   * a shore are one or the other for any one boat, and the router steps
   * through what is left.
   */
  function viewFor(need, unusable) {
    const leafAt = (r, c) => {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return -1
      const s = (r >> 6) * superCols + (c >> 6)
      if (superCodes[s] !== SPLIT) return s
      if (superAroundMin[s] >= need || (superMax[s] < need && unusable(r & -S, c & -S, S, superMax[s]))) return s
      const b = superFirst[s] + ((r >> 3) & 7) * 8 + ((c >> 3) & 7)
      if (blockCodes[b] !== SPLIT) return superCount + b
      if (blockMin[b] >= need || (blockMax[b] < need && unusable(r & -B, c & -B, B, blockMax[b]))) return superCount + b
      const first = blockFirst[b]
      const n = cellSize[first + (r & 7) * 8 + (c & 7)]
      return superCount + blockCount + first + ((r & 7) & -n) * 8 + ((c & 7) & -n)
    }
    const leafValue = (id) => {
      if (id < 0) return 0
      if (id < superCount) {
        if (superCodes[id] !== SPLIT) return superCodes[id]
        return superAroundMin[id] >= need ? superMin[id] : superMax[id]
      }
      if (id < superCount + blockCount) {
        const b = id - superCount
        if (blockCodes[b] !== SPLIT) return blockCodes[b]
        return blockMin[b] >= need ? blockMin[b] : blockMax[b]
      }
      return cellValues[id - superCount - blockCount]
    }
    // Only ever asked of a leaf deep enough for the boat, which is one depth
    // and one depth around it unless it is clear all round.
    const leafAround = (id) => {
      if (id < 0) return 0
      if (id < superCount) return superAroundMin[id]
      if (id < superCount + blockCount) return blockAroundMin[id - superCount]
      return squareAround[id - superCount - blockCount]
    }
    return { leafAt, leafValue, leafAround }
  }

  // Positions are carried as fractional cells: y down from the north edge, x
  // east from the west edge. Across a region one degree tall the cosine of the
  // latitude moves under 2%, so one scale for east-west distance is enough to
  // choose between routes; the distance the planner reports is measured on the
  // finished waypoints, great-circle.
  const midLat = (minLat + maxLat) / 2
  const nmPerRow = dLat * 60
  const nmPerCol = dLng * 60 * Math.cos((midLat * Math.PI) / 180)
  const cellOf = (lat, lng) => ({ y: (maxLat - lat) / dLat, x: (lng - minLng) / dLng })
  const latLngOf = (y, x) => ({ lat: maxLat - y * dLat, lng: minLng + x * dLng })
  const distanceNM = (y0, x0, y1, x1) => {
    const dy = (y1 - y0) * nmPerRow
    const dx = (x1 - x0) * nmPerCol
    return Math.sqrt(dy * dy + dx * dx)
  }

  const rect = new Int32Array(3)

  /**
   * Walk the straight line from (y0, x0) to (y1, x1) leaf by leaf, calling
   * visit(leaf, value, lengthNM, squeeze) for each stretch of it. Where the
   * line passes exactly through a corner on its way into a leaf (a 45-degree
   * course from a cell centre does, every cell), `squeeze` is the better of
   * the two cells either side of that corner, and -1 otherwise: a line cannot
   * slip diagonally between two dry cells, which is how a jetty drawn corner
   * to corner would otherwise let a course through. Returning false from
   * visit stops the walk.
   */
  function walk(y0, x0, y1, x1, visit, view = cellView) {
    const { leafAt, leafValue } = view
    const dy = y1 - y0
    const dx = x1 - x0
    const length = distanceNM(y0, x0, y1, x1)
    let r = Math.floor(y0)
    let c = Math.floor(x0)
    let s = 0
    let squeeze = -1
    for (let guard = 0; guard < 1e6; guard++) {
      const id = leafAt(r, c)
      const value = leafValue(id)
      let r0, c0, size
      if (id < 0) {
        r0 = r
        c0 = c
        size = 1
      } else {
        leafRect(id, rect)
        r0 = rect[0]
        c0 = rect[1]
        size = rect[2]
      }
      const sy = dy > 0 ? (r0 + size - y0) / dy : dy < 0 ? (r0 - y0) / dy : Infinity
      const sx = dx > 0 ? (c0 + size - x0) / dx : dx < 0 ? (c0 - x0) / dx : Infinity
      const exit = Math.min(sy, sx)
      if (exit >= 1) {
        visit(id, value, (1 - s) * length, squeeze)
        return
      }
      if (visit(id, value, (exit - s) * length, squeeze) === false) return
      squeeze = -1
      s = exit
      const cornerY = dy > 0 ? r0 + size : r0
      const cornerX = dx > 0 ? c0 + size : c0
      if (Math.abs(sy - sx) < 1e-9) {
        const beyondR = dy > 0 ? cornerY : cornerY - 1
        const beyondC = dx > 0 ? cornerX : cornerX - 1
        const hereR = dy > 0 ? cornerY - 1 : cornerY
        const hereC = dx > 0 ? cornerX - 1 : cornerX
        squeeze = Math.max(valueAtCellOf(beyondR, hereC), valueAtCellOf(hereR, beyondC))
        r = beyondR
        c = beyondC
      } else if (sy < sx) {
        r = dy > 0 ? cornerY : cornerY - 1
        c = Math.min(c0 + size - 1, Math.max(c0, Math.floor(x0 + dx * exit)))
      } else {
        c = dx > 0 ? cornerX : cornerX - 1
        r = Math.min(r0 + size - 1, Math.max(r0, Math.floor(y0 + dy * exit)))
      }
    }
    throw new Error('Depth grid walk did not finish')
  }

  /** The depth step index at a position; 0 is dry, land or unsurveyed. */
  function valueAt(lat, lng) {
    const { y, x } = cellOf(lat, lng)
    return valueAtCellOf(Math.floor(y), Math.floor(x))
  }

  /**
   * What a step index means in feet at MLLW: at least `minFt`, and less than
   * `maxFt` (null for the deepest step). Null for dry.
   */
  function depthRange(value) {
    if (value <= 0) return null
    return { minFt: stepsFt[value - 1], maxFt: value < stepsFt.length ? stepsFt[value] : null }
  }

  return {
    header, stepsFt, rows, cols, superRows, superCols, superCount, blockCount,
    nmPerRow, nmPerCol, cellOf, latLngOf, distanceNM,
    leafAt: leafAtCell, leafValue: leafValueOf, leafAround: leafAroundOf, leafRect,
    valueAtCell: valueAtCellOf, valueAt, depthRange, walk,
    viewFor, roughViewFor,
  }
}

let loading = null

/**
 * The grid, fetched and decoded once per page. It is a megabyte and a half, so
 * the planner starts on it as soon as a destination is picked rather than
 * when Plan Trip is pressed, and the service worker keeps it for use with no
 * signal.
 */
export function loadDepthGrid() {
  if (!loading) {
    loading = (async () => {
      const response = await fetch(DEPTH_GRID_URL)
      if (!response.ok) throw new Error(`Depth data could not be loaded (${response.status})`)
      let bytes = new Uint8Array(await response.arrayBuffer())
      // A host that recognises the gzip and serves it with Content-Encoding
      // has the browser unpack it on the way in; only unpack what still is.
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
        bytes = new Uint8Array(await new Response(stream).arrayBuffer())
      }
      return decodeDepthGrid(bytes)
    })()
    // A failed load is retried on the next plan, not cached as a failure.
    loading.catch(() => { loading = null })
  }
  return loading
}
