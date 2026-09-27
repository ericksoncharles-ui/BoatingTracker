#!/usr/bin/env python3
"""Builds public/depth-grid.bin, the charted depths the router plans against.

The router used to walk a channel graph somebody drew by hand, with an
"approach" point placed by eye off every harbor, and every wrong point was a
route over land: Marion's approach sat on the neck west of Sippican Harbor. This
replaces the drawing with the survey. Every cell of the water between City
Island and Nantucket carries the least depth charted in it, and the router finds
the shortest way through the cells deep enough for the boat.

Source: NOAA Office of Coast Survey's National Bathymetric Source navigation
surfaces, published as BAG files on NOAA's open data bucket on AWS. These are
the compiled surveys the ENCs are made from, on chart datum (MLLW) and at 4 m in
the harbors and 16 m offshore. They are public domain. BlueTopo, next to them in
the same bucket, is the same compilation on NAVD88, which sits one to four feet
off MLLW across these waters: the wrong datum for asking whether a keel clears.

What is kept of a 4 m survey is, per ~18.5 m cell, its *shallowest* point, so a
rock or the edge of a bar is never averaged away into the water beside it. That
choice narrows every channel by up to a cell each side, which is why cells stay
at 18.5 m near land, where the dredged channels are. Out in open water a 148 m
block that is mostly deep but has a lump in it is kept as that lump's depth
across the whole block: a route there gives a shoal an extra hundred yards, and
the file loses a megabyte.

Depths are kept in the steps of DEPTH_STEPS_FT, not in feet. A boat needing 9 ft
is held to the 10 ft step, never allowed the 8. The encoding is described in
src/depthGrid.js, which reads it.

Needs Python 3.9+ with rasterio (which bundles GDAL) and numpy:

    pip install rasterio numpy
    npm run depth:build            # or: python3 scripts/build-depth.py

Downloads about 1.3 GB of BAG files into a cache directory (default: a folder in
the system temp directory, --cache to choose) and takes a couple of minutes.
"""

import argparse
import concurrent.futures as cf
import gzip
import hashlib
import json
import os
import re
import sqlite3
import struct
import sys
import tempfile
import time
import urllib.request
import warnings
from datetime import date

try:
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject
except ImportError:
    sys.exit('build-depth needs rasterio and numpy: pip install rasterio numpy')

warnings.filterwarnings('ignore', category=rasterio.errors.NotGeoreferencedWarning)

BUCKET = 'https://noaa-ocs-nationalbathymetry-pds.s3.amazonaws.com'
SCHEME_PREFIX = 'Test-and-Evaluation/Navigation_Test_and_Evaluation/_Navigation_Tile_Scheme/'

# City Island to Nantucket, Montauk to the heads of Narragansett and Buzzards
# Bays. The edges sit on the 0.075 degree lines NOAA's harbor-scale tiles are
# cut on, so every tile covers whole cells.
BBOX = dict(minLat=40.725, maxLat=41.85, minLng=-73.875, maxLng=-69.9)

# Cells per 0.075 degree tile: 450 rows and 336 columns is about 18.5 m either
# way at this latitude.
TILE_DEG = 0.075
ROWS_PER_TILE = 450
COLS_PER_TILE = 336

# The depths a cell is sorted into, in feet at MLLW. A cell's value is how many
# of these its least depth reaches: 0 is dry at low water (or land, or not
# surveyed), 1 is water under 3 ft, 12 is 25 ft or more. A boat needing a depth
# between two steps is held to the deeper one.
DEPTH_STEPS_FT = [1, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25]

# 8 x 8 cells to a block, 8 x 8 blocks to a super-block (about 1.2 km square).
# A block or super-block that is one value throughout is stored as that value.
BLOCK = 8
SUPER = 8
SPLIT = 255

# Blocks further than this from any dry cell are open water, and are kept at
# block size, as their shallowest cell (see the docstring).
NEAR_LAND_BLOCKS = 2

FT_PER_M = 3.28084
MAGIC = b'DGRD'
FORMAT_VERSION = 1

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'depth-grid.bin')


def http_get(url, attempts=4):
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                return response.read()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)


def latest_scheme(cache):
    listing = http_get(f'{BUCKET}/?list-type=2&prefix={SCHEME_PREFIX}').decode()
    keys = sorted(k for k in re.findall(r'<Key>([^<]+\.gpkg)</Key>', listing))
    if not keys:
        sys.exit('No navigation tile scheme found in the bucket')
    path = os.path.join(cache, keys[-1].rsplit('/', 1)[1])
    if not os.path.exists(path):
        print(f'Fetching {keys[-1]}')
        with open(path, 'wb') as f:
            f.write(http_get(f'{BUCKET}/{keys[-1]}'))
    return path


def envelope(blob):
    # A GeoPackage geometry starts 'GP', version, flags, srs id, then the
    # envelope the flags describe. Every tile in the scheme carries [x0 x1 y0 y1].
    flags = blob[3]
    order = '<' if flags & 1 else '>'
    if (flags >> 1) & 7 == 0:
        raise ValueError('tile geometry has no envelope')
    x0, x1, y0, y1 = struct.unpack(order + '4d', blob[8:40])
    return x0, y0, x1, y1


def tiles_in_bbox(scheme):
    db = sqlite3.connect(scheme)
    table = db.execute("select table_name from gpkg_contents where data_type = 'features'").fetchone()[0]
    tiles = []
    for tile_id, bag, sha, blob in db.execute(f'select TILE_ID, BAG, BAG_SHA256, geom from "{table}"'):
        if not bag or bag == 'None' or blob is None:
            continue
        w, s, e, n = envelope(blob)
        if e <= BBOX['minLng'] or w >= BBOX['maxLng'] or n <= BBOX['minLat'] or s >= BBOX['maxLat']:
            continue
        tiles.append(dict(id=tile_id, url=bag, sha256=sha, bounds=(w, s, e, n)))
    return tiles


def download(tile, cache):
    path = os.path.join(cache, tile['url'].rsplit('/', 1)[1])
    if os.path.exists(path):
        return path
    data = http_get(tile['url'])
    if tile['sha256'] and hashlib.sha256(data).hexdigest() != tile['sha256']:
        raise RuntimeError(f"{tile['id']}: checksum mismatch")
    with open(path + '.part', 'wb') as f:
        f.write(data)
    os.replace(path + '.part', path)
    return path


def mosaic(tiles, paths):
    d_lat = TILE_DEG / ROWS_PER_TILE
    d_lng = TILE_DEG / COLS_PER_TILE
    rows = round((BBOX['maxLat'] - BBOX['minLat']) / d_lat)
    cols = round((BBOX['maxLng'] - BBOX['minLng']) / d_lng)
    grid = np.full((rows, cols), np.nan, dtype=np.float32)

    # The offshore band (16 m, 0.3 degree tiles) first, so the harbor band
    # (4 m, 0.075 degree tiles) overwrites it wherever both exist.
    for tile in sorted(tiles, key=lambda t: t['id'][:3]):
        w, s, e, n = tile['bounds']
        r0 = max(0, round((BBOX['maxLat'] - n) / d_lat))
        r1 = min(rows, round((BBOX['maxLat'] - s) / d_lat))
        c0 = max(0, round((w - BBOX['minLng']) / d_lng))
        c1 = min(cols, round((e - BBOX['minLng']) / d_lng))
        if r0 >= r1 or c0 >= c1:
            continue
        with rasterio.open(paths[tile['id']]) as ds:
            elevation = ds.read(1)
            # A hole in the survey is ignored while the tile is pooled, and
            # only counts as land if no survey covers the cell at all. Filled
            # in as land here, every hole at a tile's edge drew a wall across
            # the Sound along the tile boundary.
            elevation = np.where(elevation >= 1e5, np.nan, elevation).astype(np.float32)
            out = np.full((r1 - r0, c1 - c0), np.nan, dtype=np.float32)
            reproject(
                elevation, out,
                src_transform=ds.transform, src_crs=ds.crs, src_nodata=np.nan,
                dst_transform=from_origin(BBOX['minLng'] + c0 * d_lng, BBOX['maxLat'] - r0 * d_lat, d_lng, d_lat),
                dst_crs='EPSG:4326', dst_nodata=np.nan,
                # The highest point in the cell: its shallowest water.
                resampling=Resampling.max,
            )
        view = grid[r0:r1, c0:c1]
        covered = ~np.isnan(out)
        view[covered] = out[covered]
    return grid, d_lat, d_lng


def encode(values):
    rows, cols = values.shape
    brows, bcols = -(-rows // BLOCK), -(-cols // BLOCK)
    srows, scols = -(-brows // SUPER), -(-bcols // SUPER)
    # Pad to whole super-blocks with dry cells: off the edge is nowhere to go.
    padded = np.zeros((srows * SUPER * BLOCK, scols * SUPER * BLOCK), dtype=np.uint8)
    padded[:rows, :cols] = values
    cells = padded.reshape(srows * SUPER, BLOCK, scols * SUPER, BLOCK).transpose(0, 2, 1, 3)
    bmin = cells.min(axis=(2, 3))
    bmax = cells.max(axis=(2, 3))
    mixed = bmin != bmax

    dry = cells.min(axis=(2, 3)) == 0
    near = dry.copy()
    for _ in range(NEAR_LAND_BLOCKS):
        grown = near.copy()
        grown[1:, :] |= near[:-1, :]
        grown[:-1, :] |= near[1:, :]
        grown[:, 1:] |= near[:, :-1]
        grown[:, :-1] |= near[:, 1:]
        near = grown
    fine = mixed & near
    block_code = np.where(fine, SPLIT, bmin).astype(np.uint8)

    super_blocks = block_code.reshape(srows, SUPER, scols, SUPER).transpose(0, 2, 1, 3).reshape(srows, scols, SUPER * SUPER)
    uniform = (super_blocks == super_blocks[:, :, :1]).all(axis=2) & (super_blocks[:, :, 0] != SPLIT)
    super_code = np.where(uniform, super_blocks[:, :, 0], SPLIT).astype(np.uint8)

    # Split super-blocks in row-major order, each with its 64 block codes in
    # row-major order; then split blocks in the order those codes list them,
    # each with its 64 cells in row-major order.
    split_supers = np.argwhere(super_code == SPLIT)
    block_codes = np.concatenate([super_blocks[r, c] for r, c in split_supers]) if len(split_supers) else np.zeros(0, np.uint8)
    fine_blocks = []
    for r, c in split_supers:
        for i in range(SUPER * SUPER):
            br, bc = r * SUPER + i // SUPER, c * SUPER + i % SUPER
            if block_code[br, bc] == SPLIT:
                fine_blocks.append(cells[br, bc].reshape(-1))
    fine_values = np.concatenate(fine_blocks) if fine_blocks else np.zeros(0, np.uint8)
    stats = dict(
        superBlocks=int(super_code.size), splitSuperBlocks=int(len(split_supers)),
        splitBlocks=len(fine_blocks), coarsenedOffshore=int((mixed & ~near).sum()),
    )
    return super_code, block_codes.astype(np.uint8), fine_values.astype(np.uint8), (srows, scols), stats


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'soundcaptain-depth'))
    parser.add_argument('--out', default=OUT)
    args = parser.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    scheme = latest_scheme(args.cache)
    tiles = tiles_in_bbox(scheme)
    print(f'{len(tiles)} navigation surface tiles cover the planner\'s waters')
    t0 = time.time()
    with cf.ThreadPoolExecutor(12) as pool:
        paths = dict(zip([t['id'] for t in tiles], pool.map(lambda t: download(t, args.cache), tiles)))
    print(f'  downloaded or found in {args.cache} in {time.time() - t0:.0f} s')

    t0 = time.time()
    elevation, d_lat, d_lng = mosaic(tiles, paths)
    print(f'  mosaicked {elevation.shape[0]} x {elevation.shape[1]} cells in {time.time() - t0:.0f} s')

    depth_ft = -elevation * FT_PER_M
    # Not surveyed by any tile: land, a structure, or water nobody sounded.
    depth_ft[np.isnan(depth_ft)] = -1
    values = np.searchsorted(np.array(DEPTH_STEPS_FT, dtype=np.float32), depth_ft, side='right').astype(np.uint8)

    super_code, block_codes, fine_values, (srows, scols), stats = encode(values)
    header = dict(
        source='NOAA Office of Coast Survey, National Bathymetric Source navigation surfaces (BAG, MLLW)',
        scheme=os.path.basename(scheme),
        tiles=len(tiles),
        built=date.today().isoformat(),
        minLat=BBOX['minLat'], maxLat=BBOX['maxLat'], minLng=BBOX['minLng'], maxLng=BBOX['maxLng'],
        dLat=d_lat, dLng=d_lng, rows=int(values.shape[0]), cols=int(values.shape[1]),
        block=BLOCK, super=SUPER, superRows=srows, superCols=scols,
        stepsFt=DEPTH_STEPS_FT,
        counts=dict(blockCodes=int(block_codes.size), fineValues=int(fine_values.size)),
    )
    head = json.dumps(header, separators=(',', ':')).encode()
    payload = b''.join([
        MAGIC, struct.pack('<HI', FORMAT_VERSION, len(head)), head,
        super_code.tobytes(), block_codes.tobytes(), fine_values.tobytes(),
    ])
    with open(args.out, 'wb') as f:
        f.write(gzip.compress(payload, 9, mtime=0))
    print(f'  {stats}')
    print(f'Wrote {os.path.relpath(args.out)}: {len(payload) / 1e6:.1f} MB decoded, {os.path.getsize(args.out) / 1e3:.0f} KB on disk')


if __name__ == '__main__':
    main()
