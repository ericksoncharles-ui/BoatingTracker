export const marinas = [
  // Connecticut — approachDepthFt is controlling depth at MLW in feet
  // approach: open-water waypoint just outside the harbor entrance
  { id: 'norwalk', name: 'Norwalk Cove Marina, CT', lat: 41.0965, lng: -73.4150, approachDepthFt: 6, approach: { lat: 41.070, lng: -73.415 } },
  { id: 'bridgeport', name: 'Bridgeport Harbor Marina, CT', lat: 41.1735, lng: -73.1815, approachDepthFt: 16, approach: { lat: 41.150, lng: -73.180 } },
  { id: 'stamford', name: 'Stamford Safe Harbor Marina, CT', lat: 41.0430, lng: -73.5435, approachDepthFt: 8, approach: { lat: 41.030, lng: -73.540 } },
  { id: 'greenwich', name: 'Greenwich Harbor, CT', lat: 41.0210, lng: -73.6240, approachDepthFt: 7, approach: { lat: 41.000, lng: -73.620 } },
  { id: 'westport', name: 'Cedar Point Yacht Club, Westport, CT', lat: 41.1070, lng: -73.3580, approachDepthFt: 5, approach: { lat: 41.085, lng: -73.358 } },
  { id: 'milford', name: 'Milford Harbor, CT', lat: 41.2070, lng: -73.0540, approachDepthFt: 6, approach: { lat: 41.185, lng: -73.055 } },
  { id: 'new-haven', name: 'New Haven Harbor, CT', lat: 41.2830, lng: -72.9080, approachDepthFt: 18, approach: { lat: 41.220, lng: -72.910 } },
  { id: 'branford', name: 'Branford River Marina, CT', lat: 41.2630, lng: -72.8140, approachDepthFt: 5, approach: { lat: 41.240, lng: -72.815 } },
  { id: 'guilford', name: 'Guilford Harbor, CT', lat: 41.2640, lng: -72.6730, approachDepthFt: 4, approach: { lat: 41.240, lng: -72.675 } },
  { id: 'clinton', name: 'Clinton Harbor, CT', lat: 41.2630, lng: -72.5280, approachDepthFt: 5, approach: { lat: 41.240, lng: -72.530 } },
  { id: 'old-saybrook', name: 'Old Saybrook Marina, CT', lat: 41.2820, lng: -72.3430, approachDepthFt: 6, approach: { lat: 41.255, lng: -72.343 } },
  { id: 'essex', name: 'Essex Island Marina, CT', lat: 41.3510, lng: -72.3890, approachDepthFt: 6, approach: { lat: 41.265, lng: -72.375 } },
  { id: 'mystic', name: 'Mystic Seaport Marina, CT', lat: 41.3590, lng: -71.9660, approachDepthFt: 8, approach: { lat: 41.320, lng: -71.970 } },
  { id: 'stonington', name: 'Stonington Harbor, CT', lat: 41.3310, lng: -71.9050, approachDepthFt: 7, approach: { lat: 41.310, lng: -71.905 } },
  { id: 'niantic', name: 'Niantic Bay Marina, CT', lat: 41.3180, lng: -72.1950, approachDepthFt: 6, approach: { lat: 41.290, lng: -72.195 } },
  { id: 'new-london', name: 'New London City Pier, CT', lat: 41.3520, lng: -72.0890, approachDepthFt: 20, approach: { lat: 41.310, lng: -72.090 } },

  // New York — Long Island Sound
  { id: 'port-jefferson', name: 'Port Jefferson Harbor, NY', lat: 40.9465, lng: -73.0690, approachDepthFt: 10, approach: { lat: 40.975, lng: -73.070 } },
  { id: 'oyster-bay-marina', name: 'Oyster Bay Marine Center, NY', lat: 40.8730, lng: -73.5300, approachDepthFt: 7, approach: { lat: 40.920, lng: -73.500 } },
  { id: 'northport', name: 'Northport Harbor, NY', lat: 40.9010, lng: -73.3430, approachDepthFt: 8, approach: { lat: 40.925, lng: -73.340 } },
  { id: 'cold-spring', name: 'Cold Spring Harbor, NY', lat: 40.8710, lng: -73.4560, approachDepthFt: 5, approach: { lat: 40.915, lng: -73.475 } },
  { id: 'huntington', name: 'Huntington Harbor, NY', lat: 40.8990, lng: -73.4200, approachDepthFt: 7, approach: { lat: 40.920, lng: -73.415 } },
  { id: 'manhasset', name: 'Manhasset Bay Marina, NY', lat: 40.8310, lng: -73.7130, approachDepthFt: 8, approach: { lat: 40.845, lng: -73.710 } },
  { id: 'mamaroneck', name: 'Mamaroneck Harbor, NY', lat: 40.9420, lng: -73.7370, approachDepthFt: 6, approach: { lat: 40.930, lng: -73.730 } },
  { id: 'new-rochelle', name: 'New Rochelle Municipal Marina, NY', lat: 40.8940, lng: -73.7730, approachDepthFt: 6, approach: { lat: 40.880, lng: -73.770 } },
  { id: 'city-island', name: 'City Island Marina, NY', lat: 40.8470, lng: -73.7870, approachDepthFt: 7, approach: { lat: 40.840, lng: -73.775 } },
  { id: 'glen-cove', name: 'Glen Cove Marina, NY', lat: 40.8650, lng: -73.6290, approachDepthFt: 7, approach: { lat: 40.880, lng: -73.620 } },
  { id: 'mattituck', name: 'Mattituck Inlet Marina, NY', lat: 41.0120, lng: -72.5590, approachDepthFt: 5, approach: { lat: 41.030, lng: -72.555 } },
  { id: 'greenport', name: 'Greenport Yacht Club, NY', lat: 41.1030, lng: -72.3590, approachDepthFt: 8, approach: { lat: 41.115, lng: -72.355 } },

  // Rhode Island (eastern Sound access)
  { id: 'watch-hill', name: 'Watch Hill Docks, RI', lat: 41.3060, lng: -71.8600, approachDepthFt: 8, approach: { lat: 41.305, lng: -71.862 } },

  // ── Anchorages, beaches, and landmarks in the western Sound ────────────────
  // Day-trip destinations rather than marinas — no slips or fuel dock — so
  // `kind` groups them apart from the harbors in the departure/destination
  // dropdowns. approachDepthFt is set ONLY where a charted or published
  // controlling depth exists: the calculator skips the draft check when the
  // field is absent, which is the honest outcome for a beach or open roadstead
  // that has no single controlling depth. Inventing one would fire a
  // confident-looking draft warning off a number nobody surveyed.
  // `note` carries local knowledge that a depth figure alone doesn't convey.

  // Connecticut — Greenwich east to Westport
  { id: 'great-captain', kind: 'anchorage', name: 'Great Captain Island, Greenwich, CT', lat: 40.9825, lng: -73.6233, approach: { lat: 40.974, lng: -73.615 } },
  { id: 'calf-island', kind: 'anchorage', name: 'Calf Island, Greenwich, CT', lat: 40.9930, lng: -73.6395, approach: { lat: 40.983, lng: -73.639 } },
  { id: 'tods-point', kind: 'anchorage', name: "Tod's Point (Greenwich Point), CT", lat: 41.0020, lng: -73.5710, approach: { lat: 40.990, lng: -73.572 } },
  { id: 'westcott-cove', kind: 'anchorage', name: 'Westcott Cove, Stamford, CT', lat: 41.0354, lng: -73.5185, approach: { lat: 41.022, lng: -73.516 } },
  { id: 'zieglers-cove', kind: 'anchorage', name: "Ziegler's Cove, Darien, CT", lat: 41.0511, lng: -73.4713, approachDepthFt: 8, approach: { lat: 41.038, lng: -73.470 }, note: 'Best water is near the channel into the cove (about 10 ft at MLW). Shoreline is private — no shore access.' },
  { id: 'shea-island', kind: 'anchorage', name: 'Shea Island, Norwalk, CT', lat: 41.0595, lng: -73.4020, approach: { lat: 41.050, lng: -73.406 } },
  { id: 'chimon-island', kind: 'anchorage', name: 'Chimon Island (SW beach), Norwalk, CT', lat: 41.0620, lng: -73.3945, approach: { lat: 41.054, lng: -73.399 } },
  // Placed west of the sand spit, where published depths run over 7 ft. The
  // island group's charted shoal (sh-cockenoe) sits east of here — the inner
  // harbor carries only 3-4 ft and is not the anchorage this points at.
  { id: 'cockenoe-island', kind: 'anchorage', name: 'Cockenoe Island (west of the spit), Westport, CT', lat: 41.0865, lng: -73.3620, approachDepthFt: 7, approach: { lat: 41.078, lng: -73.366 }, note: 'Bottom is irregular with rocks throughout the island group. Inner harbor holds only 3-4 ft at low water and needs half tide or better.' },

  // Long Island north shore — directly across the Sound
  { id: 'bayville-beach', kind: 'anchorage', name: 'Bayville Beach, NY', lat: 40.9130, lng: -73.5621, approach: { lat: 40.926, lng: -73.562 } },
  // Position is approximate — no published lat/lng for the basin was found, so
  // this is the north end of Lloyd Neck rather than a surveyed fix. The
  // entrance caution below is the part that matters.
  { id: 'sand-hole', kind: 'anchorage', name: 'The Sand Hole, Lloyd Neck, NY', lat: 40.9450, lng: -73.4800, approach: { lat: 40.956, lng: -73.479 }, note: 'Deep inside (up to 25 ft at low water) but entered through two narrow, steep-sided channels running as much as 5 kt. Enter near high water, and only with local knowledge.' },
  { id: 'lloyd-harbor', kind: 'anchorage', name: 'Lloyd Harbor, NY', lat: 40.9060, lng: -73.4542, approach: { lat: 40.915, lng: -73.435 } },
  { id: 'sand-city', kind: 'anchorage', name: 'Sand City, Eatons Neck, NY', lat: 40.9198, lng: -73.4037, approach: { lat: 40.942, lng: -73.418 }, note: 'Tucked behind Eatons Neck — anchor, pick up a mooring, or beach the bow. Exposed when the wind pipes up from the east.' },

  // Lighthouses — visited by boat as waypoints and photo stops, not landings
  { id: 'stamford-ledge-light', kind: 'landmark', name: 'Stamford Harbor Ledge Light, CT', lat: 41.0137, lng: -73.5426, approach: { lat: 41.005, lng: -73.542 } },
  // Sits in about 10 ft on the west end of Greens Ledge, but the ledge itself
  // carries 3 ft (see sh-greens-ledge) — hence the shallow approach depth.
  { id: 'greens-ledge-light', kind: 'landmark', name: 'Greens Ledge Light, Norwalk, CT', lat: 41.0420, lng: -73.4440, approachDepthFt: 3, approach: { lat: 41.033, lng: -73.444 }, note: 'Stand off and view from deep water — the ledge running east toward Sheffield Island carries as little as 3 ft.' },
  { id: 'peck-ledge-light', kind: 'landmark', name: 'Peck Ledge Light, Norwalk, CT', lat: 41.0773, lng: -73.3698, approach: { lat: 41.069, lng: -73.372 } },
  { id: 'huntington-light', kind: 'landmark', name: 'Huntington Harbor Light, Lloyd Harbor, NY', lat: 40.9107, lng: -73.4313, approach: { lat: 40.922, lng: -73.428 } },
  { id: 'eatons-neck-light', kind: 'landmark', name: 'Eatons Neck Light, NY', lat: 40.9540, lng: -73.3951, approach: { lat: 40.964, lng: -73.395 } },
]

// Main navigation channel waypoints through Long Island Sound (west to east).
// Boats transit along this spine and branch off to individual marinas.
export const navigationSpine = [
  { id: 'sp-00', lat: 40.830, lng: -73.785 },  // Western entrance off Throgs Neck
  { id: 'sp-01', lat: 40.878, lng: -73.737 },  // Execution Rocks
  { id: 'sp-02', lat: 40.895, lng: -73.660 },  // Off Matinecock Point
  { id: 'sp-03', lat: 41.010, lng: -73.600 },  // Connecticut coast channel
  { id: 'sp-04', lat: 41.050, lng: -73.500 },  // Off Stamford / Darien
  { id: 'sp-05', lat: 41.070, lng: -73.350 },  // Mid-Sound off Westport
  { id: 'sp-06', lat: 41.000, lng: -73.200 },  // Off Stratford Shoal
  { id: 'sp-07', lat: 41.050, lng: -73.060 },  // Mid-Sound off Bridgeport
  { id: 'sp-08', lat: 41.110, lng: -72.920 },  // Off New Haven breakwater
  { id: 'sp-09', lat: 41.160, lng: -72.790 },  // Off Branford / Thimble Islands
  { id: 'sp-10', lat: 41.180, lng: -72.660 },  // Off Falkner Island
  { id: 'sp-11', lat: 41.180, lng: -72.530 },  // Off Westbrook / Clinton
  { id: 'sp-12', lat: 41.200, lng: -72.370 },  // Off Connecticut River mouth
  { id: 'sp-13', lat: 41.185, lng: -72.210 },  // Off Plum Gut
  { id: 'sp-14', lat: 41.250, lng: -72.090 },  // Off New London / The Race
  { id: 'sp-15', lat: 41.290, lng: -71.950 },  // Off Fishers Island
  { id: 'sp-16', lat: 41.308, lng: -71.865 },  // Watch Hill Passage
]

export const pointsOfInterest = [
  {
    id: 'thimble-islands',
    name: 'Thimble Islands',
    lat: 41.2420,
    lng: -72.7740,
    description: 'Archipelago of small islands off Branford — great for sightseeing by boat.',
  },
  {
    id: 'duck-island',
    name: 'Duck Island',
    lat: 41.2050,
    lng: -72.8900,
    description: 'Wildlife refuge near Clinton with calm anchorage opportunities.',
  },
  {
    id: 'port-jefferson-village',
    name: 'Port Jefferson Village',
    lat: 40.9510,
    lng: -73.0650,
    description: 'Historic village with waterfront dining, shops, and transient slips.',
  },
  {
    id: 'oyster-bay',
    name: 'Oyster Bay',
    lat: 40.8710,
    lng: -73.5320,
    description: "Theodore Roosevelt's waterfront town — scenic anchorage and restaurants.",
  },
  {
    id: 'shelter-island',
    name: 'Shelter Island',
    lat: 41.0680,
    lng: -72.3350,
    description: 'Quiet island between the North and South Forks with protected harbors.',
  },
  {
    id: 'sheffield-island',
    name: 'Sheffield Island Lighthouse',
    lat: 41.0480,
    lng: -73.4180,
    description: 'Historic lighthouse on a Norwalk island — tours and scenic anchorage.',
  },
  {
    id: 'captain-islands',
    name: 'Captain Islands',
    // Was plotted at 41.001/-73.630, which is up in the mouth of Greenwich
    // Harbor — over a mile north of the islands. Centred on the group instead:
    // Great Captain sits at 40.9825/-73.6233, Calf Island at 40.993/-73.6395.
    lat: 40.9880,
    lng: -73.6280,
    description: 'Three small islands off Greenwich with beaches and a lighthouse.',
  },
  {
    id: 'execution-rocks',
    name: 'Execution Rocks Lighthouse',
    lat: 40.8780,
    lng: -73.7370,
    description: 'Iconic lighthouse in western Sound — a popular photo-op waypoint.',
  },
  {
    id: 'plum-island',
    name: 'Plum Island',
    lat: 41.1750,
    lng: -72.1640,
    description: 'Mysterious island near Orient Point with restricted access and rich history.',
  },
  {
    id: 'charles-island',
    name: 'Charles Island',
    lat: 41.2000,
    lng: -73.0630,
    description: 'Tidal island off Milford with legends of buried treasure.',
  },
  {
    id: 'falkner-island',
    name: 'Falkner Island Light',
    lat: 41.2120,
    lng: -72.6550,
    description: 'Remote lighthouse and tern sanctuary in the middle of the Sound.',
  },
  {
    id: 'sag-harbor',
    name: 'Sag Harbor',
    lat: 40.9990,
    lng: -72.2960,
    description: 'Charming former whaling village with boutiques and fine dining.',
  },
]

// Known shoals, reefs, and rocks on Long Island Sound with charted minimum
// depths (feet at MLW). The router detours around any area shallower than the
// boat's draft plus a safety clearance. Radii approximate the hazard extent.
export const shoalAreas = [
  { id: 'sh-penfield', name: 'Penfield Reef', lat: 41.1170, lng: -73.2220, radiusNM: 0.8, minDepthFt: 1 },
  { id: 'sh-stratford-shoal', name: 'Stratford Shoal (Middle Ground)', lat: 41.0590, lng: -73.1010, radiusNM: 0.9, minDepthFt: 5 },
  { id: 'sh-cockenoe', name: 'Cockenoe Island Shoal', lat: 41.0880, lng: -73.3430, radiusNM: 0.7, minDepthFt: 2 },
  { id: 'sh-greens-ledge', name: 'Greens Ledge', lat: 41.0418, lng: -73.4440, radiusNM: 0.4, minDepthFt: 3 },
  { id: 'sh-the-cows', name: 'The Cows (off Shippan Point)', lat: 41.0060, lng: -73.5170, radiusNM: 0.4, minDepthFt: 2 },
  { id: 'sh-execution', name: 'Execution Rocks', lat: 40.8790, lng: -73.7380, radiusNM: 0.35, minDepthFt: 1 },
  { id: 'sh-stepping-stones', name: 'Stepping Stones', lat: 40.8490, lng: -73.7730, radiusNM: 0.3, minDepthFt: 2 },
  { id: 'sh-eatons-shoal', name: 'Eatons Neck Shoal', lat: 40.9680, lng: -73.4000, radiusNM: 0.6, minDepthFt: 5 },
  { id: 'sh-falkner', name: 'Falkner Island Shoals', lat: 41.2120, lng: -72.6530, radiusNM: 0.5, minDepthFt: 3 },
  { id: 'sh-six-mile', name: 'Six Mile Reef', lat: 41.1630, lng: -72.4850, radiusNM: 0.7, minDepthFt: 6 },
  { id: 'sh-long-sand-w', name: 'Long Sand Shoal (west)', lat: 41.2480, lng: -72.4450, radiusNM: 1.2, minDepthFt: 5 },
  { id: 'sh-long-sand-e', name: 'Long Sand Shoal (east)', lat: 41.2500, lng: -72.3700, radiusNM: 1.2, minDepthFt: 5 },
  { id: 'sh-bartlett', name: 'Bartlett Reef', lat: 41.2740, lng: -72.1350, radiusNM: 0.5, minDepthFt: 2 },
  { id: 'sh-valiant', name: 'Valiant Rock (The Race)', lat: 41.2350, lng: -72.0530, radiusNM: 0.3, minDepthFt: 4 },
]

// Headlands and peninsulas that project far enough into the Sound to sit
// between two marina approaches that are otherwise close together — the
// direct-line short-hop rule in buildRouteWaypoints would draw straight
// through them. Detection is a circular keep-out zone like shoalAreas, but
// unconditional on draft since this is land, not a depth hazard. Unlike a
// shoal — open water on every side, so a route can be nudged toward
// whichever side it already favors — a peninsula only has water on one
// side, so each entry also carries a curated `bypass` point (the maritime
// equivalent of a marina's `approach`: a known-safe point beyond the tip)
// that applyLandAvoidance routes through instead of computing a direction.
// Coordinates are approximate — enough to catch the crossing, not surveyed —
// add more here as bad-looking routes turn up between other marina pairs.
export const headlands = [
  // Eatons Neck splits Huntington Bay (west) from Northport Bay (east); a
  // direct line between their approaches cuts across the peninsula's full
  // north-south extent, not just its charted tip (sh-eatons-shoal covers the
  // shoal water just off that tip, a separate depth hazard). Only the north
  // side, around the light and shoal, is open water — bypass goes there.
  { id: 'hl-eatons-neck', name: 'Eatons Neck', lat: 40.9400, lng: -73.3970, radiusNM: 1.0, bypass: { lat: 40.9900, lng: -73.3980 } },
  // Lloyd Neck sits between Cold Spring Harbor/Lloyd Harbor and Huntington
  // Bay; only the water north of Lloyd Point is clear.
  { id: 'hl-lloyd-neck', name: 'Lloyd Neck', lat: 40.9250, lng: -73.4620, radiusNM: 1.3, bypass: { lat: 40.9750, lng: -73.4680 } },
]

// No-wake zones near marinas and harbors on Long Island Sound.
// Each zone has a center point and a radius (in NM) where speed is restricted,
// plus the enforced speed limit in knots.
export const noWakeZones = [
  { id: 'nwz-norwalk', name: 'Norwalk Harbor', lat: 41.0965, lng: -73.4150, radiusNM: 0.3, speedLimit: 5, marinaId: 'norwalk' },
  { id: 'nwz-bridgeport', name: 'Bridgeport Harbor', lat: 41.1735, lng: -73.1815, radiusNM: 0.4, speedLimit: 5, marinaId: 'bridgeport' },
  { id: 'nwz-stamford', name: 'Stamford Harbor', lat: 41.0430, lng: -73.5435, radiusNM: 0.3, speedLimit: 5, marinaId: 'stamford' },
  { id: 'nwz-greenwich', name: 'Greenwich Harbor', lat: 41.0210, lng: -73.6240, radiusNM: 0.25, speedLimit: 5, marinaId: 'greenwich' },
  { id: 'nwz-milford', name: 'Milford Harbor', lat: 41.2070, lng: -73.0540, radiusNM: 0.3, speedLimit: 5, marinaId: 'milford' },
  { id: 'nwz-new-haven', name: 'New Haven Harbor', lat: 41.2830, lng: -72.9080, radiusNM: 0.5, speedLimit: 5, marinaId: 'new-haven' },
  { id: 'nwz-branford', name: 'Branford River', lat: 41.2630, lng: -72.8140, radiusNM: 0.2, speedLimit: 5, marinaId: 'branford' },
  { id: 'nwz-essex', name: 'Connecticut River (Essex)', lat: 41.3510, lng: -72.3890, radiusNM: 0.5, speedLimit: 5, marinaId: 'essex' },
  { id: 'nwz-mystic', name: 'Mystic River', lat: 41.3590, lng: -71.9660, radiusNM: 0.4, speedLimit: 5, marinaId: 'mystic' },
  { id: 'nwz-stonington', name: 'Stonington Harbor', lat: 41.3310, lng: -71.9050, radiusNM: 0.2, speedLimit: 5, marinaId: 'stonington' },
  { id: 'nwz-new-london', name: 'New London Harbor', lat: 41.3520, lng: -72.0890, radiusNM: 0.4, speedLimit: 5, marinaId: 'new-london' },
  { id: 'nwz-port-jefferson', name: 'Port Jefferson Harbor', lat: 40.9465, lng: -73.0690, radiusNM: 0.35, speedLimit: 5, marinaId: 'port-jefferson' },
  { id: 'nwz-oyster-bay', name: 'Oyster Bay', lat: 40.8730, lng: -73.5300, radiusNM: 0.3, speedLimit: 5, marinaId: 'oyster-bay-marina' },
  { id: 'nwz-northport', name: 'Northport Harbor', lat: 40.9010, lng: -73.3430, radiusNM: 0.25, speedLimit: 5, marinaId: 'northport' },
  { id: 'nwz-huntington', name: 'Huntington Harbor', lat: 40.8990, lng: -73.4200, radiusNM: 0.3, speedLimit: 5, marinaId: 'huntington' },
  { id: 'nwz-cold-spring', name: 'Cold Spring Harbor', lat: 40.8710, lng: -73.4560, radiusNM: 0.25, speedLimit: 5, marinaId: 'cold-spring' },
  { id: 'nwz-manhasset', name: 'Manhasset Bay', lat: 40.8310, lng: -73.7130, radiusNM: 0.3, speedLimit: 5, marinaId: 'manhasset' },
  { id: 'nwz-mamaroneck', name: 'Mamaroneck Harbor', lat: 40.9420, lng: -73.7370, radiusNM: 0.25, speedLimit: 5, marinaId: 'mamaroneck' },
  { id: 'nwz-city-island', name: 'City Island', lat: 40.8470, lng: -73.7870, radiusNM: 0.2, speedLimit: 5, marinaId: 'city-island' },
  { id: 'nwz-greenport', name: 'Greenport Harbor', lat: 41.1030, lng: -72.3590, radiusNM: 0.2, speedLimit: 5, marinaId: 'greenport' },
  { id: 'nwz-old-saybrook', name: 'Connecticut River Mouth', lat: 41.2700, lng: -72.3430, radiusNM: 0.5, speedLimit: 5, marinaId: 'old-saybrook' },
  { id: 'nwz-thimble', name: 'Thimble Islands', lat: 41.2420, lng: -72.7740, radiusNM: 0.3, speedLimit: 5 },
]

// UConn LISICOS's Long Island Sound wave buoys, which report into the national
// observing network under NDBC station ids. Listed west to east; erddapBuoy.js
// walks them nearest-first because any one of them can go quiet — WLIS in
// particular reports intermittently — and a reading from the next buoy up the
// Sound beats a wind-driven guess. Each lat/lng is the NDBC mooring position,
// which erddapBuoy.js checks against the position ERDDAP returns so a dataset
// change can't silently feed us a different buoy's readings. The tolerance is
// 5 NM because the closest pair (Execution Rocks and WLIS) sit only ~8 NM
// apart — a looser check couldn't tell neighbors from each other.
// The UConn LISICOS buoys, with the pages `/api/sea-state` reads them from.
//
// `sources` is tried in order and the first page that comes back readable wins.
// UConn's own station panel is listed first because it is the buoy's operator
// and publishes the freshest numbers; the NDBC station page for the same hull
// is the backstop, since NDBC redistributes these buoys and its page URLs have
// been stable for years. Only the WLIS panel URL is confirmed (it is the one
// linked from the Conditions tab) — the other three follow LISICOS's own naming
// pattern, and a wrong guess costs nothing but a fall through to NDBC.
export const LIS_WAVE_STATIONS = [
  {
    id: '44022',
    name: 'Execution Rocks',
    label: 'Execution Rocks buoy',
    operator: 'UConn LISICOS',
    lat: 40.883,
    lng: -73.728,
    toleranceNM: 5,
    sources: [
      { label: 'UConn LISICOS', url: 'https://lisicos.uconn.edu/stn_exrx.php?id=exrx_wv_panel' },
      { label: 'NDBC 44022', url: 'https://www.ndbc.noaa.gov/station_page.php?station=44022' },
    ],
  },
  {
    id: '44040',
    name: 'WLIS',
    label: 'Western Long Island Sound buoy',
    operator: 'UConn LISICOS',
    lat: 40.956,
    lng: -73.580,
    toleranceNM: 5,
    sources: [
      { label: 'UConn LISICOS', url: 'https://lisicos.uconn.edu/stn_wlis.php?id=wlis_wv_panel' },
      { label: 'NDBC 44040', url: 'https://www.ndbc.noaa.gov/station_page.php?station=44040' },
    ],
  },
  {
    id: '44039',
    name: 'CLIS',
    label: 'Central Long Island Sound buoy',
    operator: 'UConn LISICOS',
    lat: 41.138,
    lng: -72.655,
    toleranceNM: 5,
    sources: [
      { label: 'UConn LISICOS', url: 'https://lisicos.uconn.edu/stn_clis.php?id=clis_wv_panel' },
      { label: 'NDBC 44039', url: 'https://www.ndbc.noaa.gov/station_page.php?station=44039' },
    ],
  },
  {
    id: '44060',
    name: 'ELIS',
    label: 'Eastern Long Island Sound buoy',
    operator: 'UConn LISICOS',
    lat: 41.263,
    lng: -72.067,
    toleranceNM: 5,
    sources: [
      { label: 'UConn LISICOS', url: 'https://lisicos.uconn.edu/stn_elis.php?id=elis_wv_panel' },
      { label: 'NDBC 44060', url: 'https://www.ndbc.noaa.gov/station_page.php?station=44060' },
    ],
  },
]

// Long Island Sound bounding box, used to trim NOAA's nationwide tide-station
// list down to stations that could plausibly serve a trip on the Sound.
export const LIS_BBOX = { minLat: 40.5, maxLat: 41.7, minLng: -74.2, maxLng: -71.6 }

// Outbound links to the authoritative UConn LISICOS pages. Only URLs that have
// been confirmed to exist are listed — the per-station URL pattern looks
// predictable, but a dead link is worse than a missing one.
export const lisicosLinks = [
  {
    id: 'wlis-waves',
    label: 'WLIS wave & weather panel',
    description: 'Live wave and meteorological panel for the Western Sound buoy.',
    url: 'https://lisicos.uconn.edu/stn_wlis.php?id=wlis_wv_panel',
  },
  {
    id: 'lisicos-home',
    label: 'LISICOS observing system',
    description: 'All UConn Long Island Sound buoys, maps, and archived data.',
    url: 'https://lisicos.uconn.edu/',
  },
]

// Outbound links to fishing reports, same "only confirmed URLs" rule as
// lisicosLinks above. Fisherman's World is the Norwalk tackle shop closest to
// the app's home waters; the rest are aggregate reports covering the wider
// Sound from both the Connecticut and Long Island shores.
export const fishingLinks = [
  {
    id: 'fishermans-world',
    label: "Fisherman's World, Norwalk CT",
    description: 'Local tackle shop report — species, bait, and hot spots around western Long Island Sound.',
    url: 'https://www.thefisherman.com/contributor/fishermans-world/',
    kind: 'shop',
  },
  {
    id: 'onthewater-ct',
    label: 'On The Water — Connecticut',
    description: 'Weekly aggregate fishing reports for the Connecticut shore of the Sound.',
    url: 'https://onthewater.com/regions/connecticut',
    kind: 'aggregate',
  },
  {
    id: 'onthewater-ny',
    label: 'On The Water — New York & Long Island',
    description: 'Weekly aggregate fishing reports for the Long Island / North Shore side of the Sound.',
    url: 'https://onthewater.com/regions/new-york',
    kind: 'aggregate',
  },
  {
    id: 'thefisherman-northshore',
    label: 'The Fisherman — North Shore, LI',
    description: "Regional reports covering Long Island's North Shore and western Long Island Sound.",
    url: 'https://www.thefisherman.com/area/north-shore/',
    kind: 'aggregate',
  },
  {
    id: 'ct-deep-regs',
    label: 'CT DEEP — Saltwater Regulations',
    description: 'Current Connecticut species seasons, size, and bag limits.',
    url: 'https://portal.ct.gov/deep/fishing/saltwater-fishing-guide/species-regulations',
    kind: 'regs',
  },
  {
    id: 'ny-dec-regs',
    label: 'NY DEC — Saltwater Fishing',
    description: 'Current New York saltwater seasons, size, and bag limits.',
    url: 'https://dec.ny.gov/things-to-do/saltwater-fishing',
    kind: 'regs',
  },
]

// General species timing for Long Island Sound, month indices 0-11 (Jan-Dec).
// This is typical-year seasonal behavior, not a live report or a regulatory
// calendar — season/size/bag limits shift year to year and by state, so the
// Fishing tab links out to the actual CT/NY regs rather than restating them.
export const soundSpecies = [
  {
    id: 'striped-bass',
    name: 'Striped Bass',
    months: [3, 4, 5, 6, 7, 8, 9, 10],
    note: 'Spring push up the Sound, steady through summer around structure, then a fall run as they head back out.',
  },
  {
    id: 'bluefish',
    name: 'Bluefish',
    months: [4, 5, 6, 7, 8, 9, 10],
    note: 'Blitzes on bait pods in open water — look for diving birds.',
  },
  {
    id: 'fluke',
    name: 'Fluke (Summer Flounder)',
    months: [4, 5, 6, 7, 8, 9],
    note: 'Drift bucktails or bait over sandy bottom near channels and inlets.',
  },
  {
    id: 'black-sea-bass',
    name: 'Black Sea Bass',
    months: [4, 5, 6, 7, 8, 9, 10, 11],
    note: 'Jigs or cut bait over wrecks, rock piles, and reefs.',
  },
  {
    id: 'scup',
    name: 'Scup (Porgy)',
    months: [4, 5, 6, 7, 8, 9, 10],
    note: 'Easy, reliable bottom fishing over reefs and rocky structure.',
  },
  {
    id: 'tautog',
    name: 'Tautog (Blackfish)',
    months: [3, 4, 9, 10, 11],
    note: 'Spring and fall runs around rock piles and jetties — green crab is the standard bait.',
  },
  {
    id: 'bonito-albacore',
    name: 'False Albacore & Bonito',
    months: [7, 8, 9],
    note: 'Fast-moving late-summer run on light tackle, chasing bay anchovies.',
  },
  {
    id: 'weakfish',
    name: 'Weakfish',
    months: [4, 5, 8, 9],
    note: 'Less consistent than the rest of the Sound — worth a drift over deep holes at dawn or dusk.',
  },
]
