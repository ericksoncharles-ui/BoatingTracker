// Places a trip can start or end at.
//
// Every entry carries the `region` it sits in. The list used to be one body of
// water; it now runs from City Island to Nantucket, and the pickers group by
// region so a 90-entry list stays scannable. Regions are written as sections
// rather than a field repeated on every line — the order of the sections *is*
// the west-to-east ordering the pickers present, so keep them in that order.
//
// `kind` separates working harbors from day-trip destinations:
//   (absent)   — a marina or harbor with slips and usually fuel
//   anchorage  — somewhere to anchor, moor, or beach; no slips, no fuel
//   landmark   — a lighthouse or feature you stand off and look at, not a landing
//
// approachDepthFt is the controlling depth at MLW on the way in, and is set
// ONLY where a published figure exists: the calculator skips the draft check
// when the field is absent, which is the honest outcome for a beach or open
// roadstead nobody has surveyed a controlling depth for. Inventing one would
// fire a confident-looking draft warning off a number that doesn't exist.
//
// `approach` is an open-water waypoint outside the harbor entrance — routing
// runs between approach points, and the marina coordinates are only the first
// and last legs. Approach points are placed by eye off the chart rather than
// surveyed, so they are good to a few tenths of a mile, no better.
//
// `note` carries local knowledge a depth figure alone doesn't convey.

const inRegion = (region, places) => places.map((place) => ({ region, ...place }))

export const marinas = [
  ...inRegion('Long Island Sound', [
    // Connecticut
    { id: 'norwalk', name: 'Norwalk Cove Marina, CT', lat: 41.0965, lng: -73.4150, approachDepthFt: 6, approach: { lat: 41.070, lng: -73.415 } },
    { id: 'bridgeport', name: 'Bridgeport Harbor Marina, CT', lat: 41.1735, lng: -73.1815, approachDepthFt: 16, approach: { lat: 41.150, lng: -73.180 } },
    // At the harbor entrance below Shippan Point. Inside it, every route east
    // or south had the point in the way.
    { id: 'stamford', name: 'Stamford Safe Harbor Marina, CT', lat: 41.0430, lng: -73.5435, approachDepthFt: 8, approach: { lat: 41.012, lng: -73.535 } },
    { id: 'greenwich', name: 'Greenwich Harbor, CT', lat: 41.0210, lng: -73.6240, approachDepthFt: 7, approach: { lat: 41.000, lng: -73.620 } },
    // Off the Saugatuck mouth, north of Cockenoe. It used to sit in the notch
    // of the island itself, and inside its shoal circle.
    { id: 'westport', name: 'Cedar Point Yacht Club, Westport, CT', lat: 41.1070, lng: -73.3580, approachDepthFt: 5, approach: { lat: 41.095, lng: -73.362 } },
    { id: 'milford', name: 'Milford Harbor, CT', lat: 41.2070, lng: -73.0540, approachDepthFt: 6, approach: { lat: 41.185, lng: -73.055 } },
    { id: 'new-haven', name: 'New Haven Harbor, CT', lat: 41.2830, lng: -72.9080, approachDepthFt: 18, approach: { lat: 41.220, lng: -72.910 } },
    { id: 'branford', name: 'Branford River Marina, CT', lat: 41.2630, lng: -72.8140, approachDepthFt: 5, approach: { lat: 41.240, lng: -72.815 } },
    { id: 'guilford', name: 'Guilford Harbor, CT', lat: 41.2640, lng: -72.6730, approachDepthFt: 4, approach: { lat: 41.240, lng: -72.675 } },
    { id: 'clinton', name: 'Clinton Harbor, CT', lat: 41.2630, lng: -72.5280, approachDepthFt: 5, approach: { lat: 41.240, lng: -72.530 } },
    // In the river mouth, where the marina is, rather than out in the Sound: a
    // run up to Essex used to go out past the breakwater and back in.
    { id: 'old-saybrook', name: 'Old Saybrook Marina, CT', lat: 41.2820, lng: -72.3430, approachDepthFt: 6, approach: { lat: 41.279, lng: -72.339 } },
    // Up the Connecticut River (br-connecticut-river). The approach used to be
    // on the Old Saybrook shore at the mouth, with a straight five-mile line
    // from there to the dock over the town.
    { id: 'essex', name: 'Essex Island Marina, CT', lat: 41.3510, lng: -72.3890, approachDepthFt: 6, approach: { lat: 41.344, lng: -72.378 } },
    { id: 'mystic', name: 'Mystic Seaport Marina, CT', lat: 41.3590, lng: -71.9660, approachDepthFt: 8, approach: { lat: 41.320, lng: -71.970 } },
    { id: 'stonington', name: 'Stonington Harbor, CT', lat: 41.3310, lng: -71.9050, approachDepthFt: 7, approach: { lat: 41.310, lng: -71.905 } },
    { id: 'niantic', name: 'Niantic Bay Marina, CT', lat: 41.3180, lng: -72.1950, approachDepthFt: 6, approach: { lat: 41.290, lng: -72.195 } },
    { id: 'new-london', name: 'New London City Pier, CT', lat: 41.3520, lng: -72.0890, approachDepthFt: 20, approach: { lat: 41.310, lng: -72.090 } },

    // New York — Long Island north shore, west to east
    { id: 'city-island', name: 'City Island Marina, NY', lat: 40.8470, lng: -73.7870, approachDepthFt: 7, approach: { lat: 40.840, lng: -73.775 } },
    { id: 'new-rochelle', name: 'New Rochelle Municipal Marina, NY', lat: 40.8940, lng: -73.7730, approachDepthFt: 6, approach: { lat: 40.880, lng: -73.770 } },
    // The harbor opens east, behind the point, not south across it.
    { id: 'mamaroneck', name: 'Mamaroneck Harbor, NY', lat: 40.9405, lng: -73.7225, approachDepthFt: 6, approach: { lat: 40.9385, lng: -73.7170 } },
    // Manhasset Bay opens west toward Hart Island; the approach used to sit
    // ashore on Manhasset Neck, with every route off it crossing Sands Point.
    { id: 'manhasset', name: 'Manhasset Bay Marina, NY', lat: 40.8310, lng: -73.7130, approachDepthFt: 8, approach: { lat: 40.8334, lng: -73.7355 } },
    // At the mouth of Glen Cove Creek on Hempstead Harbor, and in by the harbor
    // itself: both points used to sit a mile inland, in the city.
    { id: 'glen-cove', name: 'Glen Cove Marina, NY', lat: 40.8564, lng: -73.6492, approachDepthFt: 7, approach: { lat: 40.8612, lng: -73.6614 } },
    // Oyster Bay Harbor and Cold Spring Harbor share a mouth north of Centre
    // Island. Each approach sits where a straight run to the dock stays inside
    // its own harbor: Oyster Bay's at the channel past Centre Island, Cold
    // Spring's at the harbor entrance. Cold Spring's used to be ashore on the
    // Lloyd Neck side.
    { id: 'oyster-bay-marina', name: 'Oyster Bay Marine Center, NY', lat: 40.8800, lng: -73.5320, approachDepthFt: 7, approach: { lat: 40.905, lng: -73.500 } },
    { id: 'cold-spring', name: 'Cold Spring Harbor, NY', lat: 40.8705, lng: -73.4665, approachDepthFt: 5, approach: { lat: 40.8985, lng: -73.4885 } },
    { id: 'huntington', name: 'Huntington Harbor, NY', lat: 40.8990, lng: -73.4200, approachDepthFt: 7, approach: { lat: 40.920, lng: -73.415 } },
    // Northport Harbor is reached through Huntington and Northport Bays, round
    // the south side of Eatons Neck. The approach used to be ashore north of the
    // village, and every route off it ran straight over the Asharoken beach.
    { id: 'northport', name: 'Northport Harbor, NY', lat: 40.8980, lng: -73.3570, approachDepthFt: 8, approach: { lat: 40.918, lng: -73.360 } },
    { id: 'stony-brook', name: 'Stony Brook Harbor, NY', lat: 40.9070, lng: -73.1740, approachDepthFt: 4, approach: { lat: 40.933, lng: -73.172 }, note: 'Porpoise Channel across the sand spit is thin and shifts every season — carry half tide or better and favor the marked side.' },
    // Outside the jettied inlet at the harbor's north-west corner. The old
    // approach was off Belle Terre, a mile east, with the point in between.
    { id: 'port-jefferson', name: 'Port Jefferson Harbor, NY', lat: 40.9465, lng: -73.0690, approachDepthFt: 10, approach: { lat: 40.9735, lng: -73.0925 } },
    { id: 'mount-sinai', name: 'Mount Sinai Harbor, NY', lat: 40.9650, lng: -73.0350, approachDepthFt: 6, approach: { lat: 40.982, lng: -73.035 }, note: 'Short jettied inlet straight off the Sound — the bar just outside builds a steep sea in a northerly.' },
    { id: 'mattituck', name: 'Mattituck Inlet Marina, NY', lat: 41.0120, lng: -72.5590, approachDepthFt: 5, approach: { lat: 41.030, lng: -72.555 } },

    // Eastern approaches — Fishers Island Sound
    // West Harbor is the notch in the island's north-west shore. Both points used
    // to be two miles north, on the Connecticut side of Fishers Island Sound.
    { id: 'fishers-island', name: 'West Harbor, Fishers Island, NY', lat: 41.2660, lng: -72.0040, approachDepthFt: 9, approach: { lat: 41.278, lng: -72.004 } },
    { id: 'watch-hill', name: 'Watch Hill Docks, RI', lat: 41.3060, lng: -71.8600, approachDepthFt: 8, approach: { lat: 41.305, lng: -71.862 } },

    // ── Anchorages and beaches in the western Sound ─────────────────────────
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
    { id: 'duck-island-roads', kind: 'anchorage', name: 'Duck Island Roads, Westbrook, CT', lat: 41.2660, lng: -72.4860, approach: { lat: 41.253, lng: -72.486 }, note: 'Roadstead behind the breakwaters — good shelter from the south and west, wide open to the east.' },

    // Long Island north shore — directly across the Sound
    { id: 'bayville-beach', kind: 'anchorage', name: 'Bayville Beach, NY', lat: 40.9130, lng: -73.5621, approach: { lat: 40.926, lng: -73.562 } },
    // Position is approximate — no published lat/lng for the basin was found, so
    // this is the north end of Lloyd Neck rather than a surveyed fix. The
    // entrance caution below is the part that matters.
    { id: 'sand-hole', kind: 'anchorage', name: 'The Sand Hole, Lloyd Neck, NY', lat: 40.9450, lng: -73.4800, approach: { lat: 40.956, lng: -73.479 }, note: 'Deep inside (up to 25 ft at low water) but entered through two narrow, steep-sided channels running as much as 5 kt. Enter near high water, and only with local knowledge.' },
    { id: 'lloyd-harbor', kind: 'anchorage', name: 'Lloyd Harbor, NY', lat: 40.9129, lng: -73.4560, approach: { lat: 40.915, lng: -73.435 } },
    { id: 'sand-city', kind: 'anchorage', name: 'Sand City, Eatons Neck, NY', lat: 40.9198, lng: -73.4037, approach: { lat: 40.922, lng: -73.412 }, note: 'Tucked behind Eatons Neck — anchor, pick up a mooring, or beach the bow. Exposed when the wind pipes up from the east.' },
    { id: 'mount-misery', kind: 'anchorage', name: 'Mount Misery Cove, Port Jefferson, NY', lat: 40.9620, lng: -73.0870, approach: { lat: 40.9735, lng: -73.0925 }, note: 'Inside Port Jefferson Harbor and sheltered from everything — the far side of the harbor from the ferry traffic.' },

    // ── Lighthouses — waypoints and photo stops, not landings ───────────────
    { id: 'stamford-ledge-light', kind: 'landmark', name: 'Stamford Harbor Ledge Light, CT', lat: 41.0137, lng: -73.5426, approach: { lat: 41.005, lng: -73.542 } },
    // Sits in about 10 ft on the west end of Greens Ledge, but the ledge itself
    // carries 3 ft (see sh-greens-ledge) — hence the shallow approach depth.
    { id: 'greens-ledge-light', kind: 'landmark', name: 'Greens Ledge Light, Norwalk, CT', lat: 41.0420, lng: -73.4440, approachDepthFt: 3, approach: { lat: 41.033, lng: -73.444 }, note: 'Stand off and view from deep water — the ledge running east toward Sheffield Island carries as little as 3 ft.' },
    { id: 'peck-ledge-light', kind: 'landmark', name: 'Peck Ledge Light, Norwalk, CT', lat: 41.0773, lng: -73.3698, approach: { lat: 41.069, lng: -73.372 } },
    { id: 'huntington-light', kind: 'landmark', name: 'Huntington Harbor Light, Lloyd Harbor, NY', lat: 40.9107, lng: -73.4313, approach: { lat: 40.922, lng: -73.428 } },
    { id: 'eatons-neck-light', kind: 'landmark', name: 'Eatons Neck Light, NY', lat: 40.9540, lng: -73.3951, approach: { lat: 40.964, lng: -73.395 } },
    { id: 'saybrook-breakwater-light', kind: 'landmark', name: 'Saybrook Breakwater Light, CT', lat: 41.2631, lng: -72.3428, approach: { lat: 41.252, lng: -72.343 } },
    { id: 'new-london-ledge-light', kind: 'landmark', name: 'New London Ledge Light, CT', lat: 41.3061, lng: -72.0772, approach: { lat: 41.296, lng: -72.077 } },
    // The Race runs to 4 kt around the light and boils on a spring ebb. The
    // approach is placed south of it, on the New London side of the tide gate.
    { id: 'race-rock-light', kind: 'landmark', name: 'Race Rock Light, Fishers Island, NY', lat: 41.2461, lng: -72.0470, approach: { lat: 41.240, lng: -72.040 }, note: 'Go at slack or with a fair tide — the current through The Race runs to 4 kt and stands up steep, breaking water against the wind.' },
    { id: 'little-gull-light', kind: 'landmark', name: 'Little Gull Island Light, NY', lat: 41.2044, lng: -72.1150, approach: { lat: 41.194, lng: -72.108 }, note: 'Sits between The Race and the Sluiceway — both run hard, and the overfalls either side of the island are no place to loiter.' },
  ]),

  ...inRegion('Peconic & Gardiners Bay', [
    { id: 'orient-point', name: 'Orient by the Sea, Orient Point, NY', lat: 41.1560, lng: -72.2340, approachDepthFt: 7, approach: { lat: 41.168, lng: -72.230 }, note: 'Right beside Plum Gut, which runs to 5 kt — leave and enter on slack or a fair current.' },
    { id: 'greenport', name: 'Greenport Yacht Club, NY', lat: 41.1030, lng: -72.3590, approachDepthFt: 8, approach: { lat: 41.113, lng: -72.330 } },
    // Dering Harbor opens north-west, toward Greenport; the approach used to be
    // east of it, on Shelter Island itself.
    { id: 'dering-harbor', name: 'Dering Harbor, Shelter Island, NY', lat: 41.0900, lng: -72.3430, approachDepthFt: 10, approach: { lat: 41.099, lng: -72.3462 } },
    { id: 'sag-harbor', name: 'Sag Harbor, NY', lat: 40.9980, lng: -72.2930, approachDepthFt: 10, approach: { lat: 41.012, lng: -72.290 } },
    { id: 'three-mile-harbor', name: 'Three Mile Harbor, East Hampton, NY', lat: 41.0300, lng: -72.1940, approachDepthFt: 8, approach: { lat: 41.052, lng: -72.193 } },

    { id: 'coecles-harbor', kind: 'anchorage', name: 'Coecles Harbor, Shelter Island, NY', lat: 41.0700, lng: -72.3000, approachDepthFt: 7, approach: { lat: 41.085, lng: -72.270 }, note: 'Buoyed dogleg in from Gardiners Bay, then all-round shelter — one of the calmest anchorages east of the Sound.' },

    { id: 'orient-point-light', kind: 'landmark', name: 'Orient Point Light, NY', lat: 41.1622, lng: -72.2325, approach: { lat: 41.172, lng: -72.222 }, note: 'The "coffee pot" marks the west side of Plum Gut — stand off, the current sets straight past it.' },
  ]),

  ...inRegion('Block Island & Rhode Island Sound', [
    { id: 'montauk', name: 'Montauk Harbor (Lake Montauk), NY', lat: 41.0720, lng: -71.9350, approachDepthFt: 12, approach: { lat: 41.095, lng: -71.935 } },
    { id: 'block-island-new', name: 'Great Salt Pond (New Harbor), Block Island, RI', lat: 41.1830, lng: -71.5800, approachDepthFt: 12, approach: { lat: 41.205, lng: -71.587 }, note: 'Entered from the north side of the island. Room for a fleet inside and good holding, but the pond fills by early afternoon on a summer weekend.' },
    { id: 'block-island-old', name: 'Old Harbor, Block Island, RI', lat: 41.1720, lng: -71.5570, approachDepthFt: 12, approach: { lat: 41.172, lng: -71.545 }, note: 'Open to the east and busy with ferries — untenable in an easterly, when New Harbor is the answer.' },
    { id: 'point-judith', name: 'Port of Galilee, Point Judith, RI', lat: 41.3820, lng: -71.5100, approachDepthFt: 15, approach: { lat: 41.362, lng: -71.506 }, note: 'Enter through a gap in the Harbor of Refuge breakwater. Working fishing port — the channel is narrow and the draggers do not manoeuvre for you.' },

    { id: 'montauk-point-light', kind: 'landmark', name: 'Montauk Point Light, NY', lat: 41.0714, lng: -71.8573, approach: { lat: 41.060, lng: -71.848 }, note: 'Stand well off. The rip off the point breaks hard on the ebb with any onshore wind, and it reaches a mile out.' },
    { id: 'block-island-se-light', kind: 'landmark', name: 'Block Island Southeast Light, RI', lat: 41.1531, lng: -71.5522, approach: { lat: 41.148, lng: -71.535 } },
    { id: 'point-judith-light', kind: 'landmark', name: 'Point Judith Light, RI', lat: 41.3614, lng: -71.4815, approach: { lat: 41.340, lng: -71.482 } },
  ]),

  ...inRegion('Narragansett Bay', [
    // The approaches for Newport, Bristol and East Greenwich all used to be
    // ashore: Newport's on Brenton Point, Bristol's on the neck, and East
    // Greenwich's in the Potowomut River, with Potowomut Neck between it and
    // the cove the marina is in.
    { id: 'newport', name: 'Newport Harbor, RI', lat: 41.4870, lng: -71.3260, approachDepthFt: 20, approach: { lat: 41.4843, lng: -71.3357 } },
    { id: 'jamestown', name: 'Conanicut Marina, Jamestown, RI', lat: 41.5030, lng: -71.3670, approachDepthFt: 12, approach: { lat: 41.500, lng: -71.345 } },
    { id: 'bristol', name: 'Bristol Harbor, RI', lat: 41.6720, lng: -71.2830, approachDepthFt: 10, approach: { lat: 41.6567, lng: -71.2838 } },
    { id: 'wickford', name: 'Wickford Harbor, RI', lat: 41.5710, lng: -71.4450, approachDepthFt: 8, approach: { lat: 41.568, lng: -71.418 } },
    { id: 'east-greenwich', name: 'East Greenwich Harbor, RI', lat: 41.6570, lng: -71.4460, approachDepthFt: 8, approach: { lat: 41.6762, lng: -71.4433 } },
    { id: 'sakonnet', name: 'Sakonnet Harbor, Little Compton, RI', lat: 41.4620, lng: -71.1960, approachDepthFt: 6, approach: { lat: 41.430, lng: -71.195 }, note: 'Small basin behind a breakwater at the mouth of the Sakonnet River — the current outside runs hard and the swell wraps the point.' },

    { id: 'potters-cove', kind: 'anchorage', name: 'Potters Cove, Prudence Island, RI', lat: 41.6410, lng: -71.3350, approach: { lat: 41.635, lng: -71.320 }, note: 'Popular weekend anchorage on the north end of Prudence — sheltered except from the north.' },

    { id: 'beavertail-light', kind: 'landmark', name: 'Beavertail Light, Jamestown, RI', lat: 41.4494, lng: -71.3997, approach: { lat: 41.436, lng: -71.400 }, note: 'Marks the split between the East and West Passages. Seas stack up on the ledges either side of the point on an ebb.' },
    { id: 'castle-hill-light', kind: 'landmark', name: 'Castle Hill Light, Newport, RI', lat: 41.4622, lng: -71.3628, approach: { lat: 41.452, lng: -71.362 } },
  ]),

  ...inRegion('Buzzards Bay', [
    { id: 'cuttyhunk', name: 'Cuttyhunk Pond, MA', lat: 41.4200, lng: -70.9280, approachDepthFt: 8, approach: { lat: 41.440, lng: -70.930 }, note: 'Dredged cut into the pond carries about 8 ft and is narrow enough to meet nothing coming out. Moorings go early; the outer harbor is exposed to the north.' },
    { id: 'padanaram', name: 'Padanaram Harbor, South Dartmouth, MA', lat: 41.5780, lng: -70.9400, approachDepthFt: 8, approach: { lat: 41.562, lng: -70.938 } },
    { id: 'new-bedford', name: 'New Bedford Harbor, MA', lat: 41.6350, lng: -70.9130, approachDepthFt: 30, approach: { lat: 41.5887, lng: -70.8987 }, note: 'Entered through the hurricane barrier — a 150 ft gate the tide runs hard through, inside a working commercial port. Call ahead and give the fishing fleet the channel.' },
    { id: 'marion', name: 'Sippican Harbor, Marion, MA', lat: 41.7050, lng: -70.7640, approachDepthFt: 8, approach: { lat: 41.6778, lng: -70.7568 } },

    { id: 'hadley-harbor', kind: 'anchorage', name: 'Hadley Harbor, Naushon Island, MA', lat: 41.5200, lng: -70.6900, approachDepthFt: 8, approach: { lat: 41.527, lng: -70.700 }, note: 'Land-locked and calm in almost anything, entered from the Buzzards Bay side. The islands ashore are private — stay aboard.' },

    { id: 'dumpling-rock-light', kind: 'landmark', name: 'Dumpling Rock Light, South Dartmouth, MA', lat: 41.5383, lng: -70.9200, approach: { lat: 41.529, lng: -70.920 } },
    { id: 'butler-flats-light', kind: 'landmark', name: 'Butler Flats Light, New Bedford, MA', lat: 41.6042, lng: -70.8944, approach: { lat: 41.596, lng: -70.895 } },
  ]),

  ...inRegion('Vineyard & Nantucket Sound', [
    { id: 'woods-hole', name: 'Woods Hole, MA', lat: 41.5240, lng: -70.6720, approachDepthFt: 15, approach: { lat: 41.515, lng: -70.665 }, note: 'The passage runs to 4 kt and boils on a spring ebb. Go at slack or with a fair current, and never against wind and current together.' },
    { id: 'falmouth', name: 'Falmouth Inner Harbor, MA', lat: 41.5450, lng: -70.6070, approachDepthFt: 10, approach: { lat: 41.533, lng: -70.605 } },
    { id: 'menemsha', name: "Menemsha Basin, Martha's Vineyard, MA", lat: 41.3550, lng: -70.7690, approachDepthFt: 8, approach: { lat: 41.365, lng: -70.770 }, note: 'Short jettied entrance straight off Vineyard Sound. The current through the jetties runs hard and the basin inside is small and busy.' },
    { id: 'vineyard-haven', name: 'Vineyard Haven Harbor, MA', lat: 41.4550, lng: -70.6000, approachDepthFt: 12, approach: { lat: 41.495, lng: -70.590 }, note: 'Wide open to the north — a hard northerly makes it untenable, and the ferries use the middle of the harbor.' },
    { id: 'oak-bluffs', name: 'Oak Bluffs Harbor, MA', lat: 41.4600, lng: -70.5550, approachDepthFt: 9, approach: { lat: 41.475, lng: -70.550 } },
    { id: 'edgartown', name: 'Edgartown Harbor, MA', lat: 41.3900, lng: -70.5130, approachDepthFt: 8, approach: { lat: 41.420, lng: -70.495 }, note: 'In from Nantucket Sound past the outer bar. The current runs hard through the moored fleet — pick up a mooring stemming it.' },
    { id: 'hyannis', name: 'Hyannis Inner Harbor, MA', lat: 41.6480, lng: -70.2800, approachDepthFt: 12, approach: { lat: 41.615, lng: -70.278 } },
    { id: 'nantucket', name: 'Nantucket Boat Basin, MA', lat: 41.2870, lng: -70.0980, approachDepthFt: 15, approach: { lat: 41.320, lng: -70.093 }, note: 'Jettied entrance from Nantucket Sound, then a dredged channel past Brant Point where the current sets across the fairway. Reserve a slip — the basin is full all summer.' },

    { id: 'tarpaulin-cove', kind: 'anchorage', name: 'Tarpaulin Cove, Naushon Island, MA', lat: 41.4700, lng: -70.7580, approach: { lat: 41.462, lng: -70.758 }, note: 'Open roadstead on the Vineyard Sound side of Naushon — fine in a northerly, rolly in anything with south in it.' },
    { id: 'lake-tashmoo', kind: 'anchorage', name: "Lake Tashmoo, Martha's Vineyard, MA", lat: 41.4650, lng: -70.6250, approachDepthFt: 6, approach: { lat: 41.478, lng: -70.622 }, note: 'Narrow jettied cut carrying about 6 ft that shifts with the winter storms, and it breaks across in a hard northerly.' },

    { id: 'gay-head-light', kind: 'landmark', name: 'Gay Head Light (Aquinnah), MA', lat: 41.3485, lng: -70.8347, approach: { lat: 41.362, lng: -70.842 }, note: 'Devils Bridge runs out northwest from under the cliffs and has taken ships — stay outside the buoy, not between it and the beach.' },
    { id: 'nobska-light', kind: 'landmark', name: 'Nobska Point Light, Woods Hole, MA', lat: 41.5153, lng: -70.6553, approach: { lat: 41.505, lng: -70.656 } },
    { id: 'cape-poge-light', kind: 'landmark', name: 'Cape Poge Light, Chappaquiddick, MA', lat: 41.4139, lng: -70.4520, approach: { lat: 41.423, lng: -70.444 } },
    { id: 'brant-point-light', kind: 'landmark', name: 'Brant Point Light, Nantucket, MA', lat: 41.2914, lng: -70.0906, approach: { lat: 41.297, lng: -70.093 } },
  ]),
]

// The regions above, in the order they are declared — which is west to east.
// Both pickers group their list by this, so it is the ordering a skipper reads.
export const placeRegions = [...new Set(marinas.map((m) => m.region))]

// Main navigation channel — safe deep water down the middle of the run east,
// west to east: Long Island Sound, The Race, Block Island Sound, Rhode Island
// Sound, Vineyard Sound and Nantucket Sound. Boats transit along this spine and
// branch off to individual harbors.
//
// `corridorNM` is how far either side of a leg is still open water a route may
// legitimately cut across (see buildRouteWaypoints). Absent means the Sound's
// own 6 NM: fine for a body of water 15 NM wide with a headland every 20 miles,
// far too loose for Vineyard Sound, where the Elizabeth Islands sit two miles
// off the channel. Where the water narrows, so does this number.
export const navigationSpine = [
  { id: 'sp-00', lat: 40.830, lng: -73.785 },  // Western entrance off Throgs Neck
  { id: 'sp-01', lat: 40.848, lng: -73.757 },  // Between Hart Island and Kings Point
  // Execution Rocks is a ledge carrying 1 ft with a light on it, and this
  // waypoint used to be on top of it: a hazard at a waypoint sits at the end of
  // both its legs, where no detour ever looked. The water between the rocks
  // and Sands Point is under half a mile and inside their shoal circle, so the
  // channel passes north-west of them instead.
  { id: 'sp-01b', lat: 40.889, lng: -73.748 }, // North-west of Execution Rocks
  { id: 'sp-02', lat: 40.895, lng: -73.660 },  // Off Matinecock Point
  // These three used to follow the Connecticut shore itself, through Cove
  // Island and the Norwalk Islands. The middle of the Sound is where the
  // deep water is and where a shortcut can safely leave from.
  { id: 'sp-03', lat: 40.985, lng: -73.600 },  // Mid-Sound off Greenwich
  { id: 'sp-04', lat: 40.995, lng: -73.500 },  // Mid-Sound off Stamford
  { id: 'sp-05', lat: 41.020, lng: -73.350 },  // Mid-Sound, south of the Norwalk Islands
  { id: 'sp-06', lat: 41.000, lng: -73.200 },  // Off Stratford Shoal
  { id: 'sp-07', lat: 41.050, lng: -73.060 },  // Mid-Sound off Bridgeport
  { id: 'sp-08', lat: 41.110, lng: -72.920 },  // Off New Haven breakwater
  { id: 'sp-09', lat: 41.160, lng: -72.790 },  // Off Branford / Thimble Islands
  { id: 'sp-10', lat: 41.180, lng: -72.660 },  // Off Falkner Island
  { id: 'sp-11', lat: 41.180, lng: -72.530 },  // Off Westbrook / Clinton
  { id: 'sp-12', lat: 41.200, lng: -72.370 },  // Off Connecticut River mouth
  // Far enough north of Plum Gut that the leg east clears Plum Island.
  { id: 'sp-13', lat: 41.198, lng: -72.215 },  // Off Plum Gut
  // Through The Race and along the south side of Fishers Island, which is the
  // way east. The spine used to run from here to Fishers Island Sound across
  // the west end of the island, and then out over Watch Hill; the inside route
  // is br-fishers-island-sound now.
  { id: 'sp-14', lat: 41.218, lng: -72.075 },  // The Race, clear of Valiant Rock
  { id: 'sp-15', lat: 41.232, lng: -71.960 },  // South of Fishers Island
  // Block Island Sound and Rhode Island Sound are open water — the corridor
  // stays wide, because a boat crossing from Montauk to Block Island really can
  // go straight there.
  { id: 'sp-17', lat: 41.255, lng: -71.700 },                    // Block Island Sound, N of Block Island
  { id: 'sp-18', lat: 41.330, lng: -71.520, corridorNM: 5 },     // Off Point Judith and the Harbor of Refuge
  { id: 'sp-19', lat: 41.395, lng: -71.355, corridorNM: 4 },     // Rhode Island Sound off Brenton Reef
  { id: 'sp-20', lat: 41.400, lng: -71.180, corridorNM: 4 },     // Rhode Island Sound, S of Sakonnet Point
  // Into Vineyard Sound between Sow and Pigs Reef off Cuttyhunk and Devils
  // Bridge off Gay Head, then up the Sound on the Elizabeth Islands side. Four
  // miles of water with a shoal down the middle of it — hence the tight
  // corridor from here east.
  { id: 'sp-21', lat: 41.395, lng: -70.905, corridorNM: 0.8 },   // W entrance to Vineyard Sound
  { id: 'sp-22', lat: 41.428, lng: -70.830, corridorNM: 1.2 },   // Vineyard Sound, off Nashawena
  { id: 'sp-23', lat: 41.455, lng: -70.755, corridorNM: 1.2 },   // Vineyard Sound, off Tarpaulin Cove
  // Two miles between Nobska Point and West Chop, so the corridor here is under
  // a mile — otherwise a course up the Sound cuts the corner across West Chop.
  { id: 'sp-24', lat: 41.490, lng: -70.660, corridorNM: 0.8 },   // E end of Vineyard Sound, between Nobska and West Chop
  { id: 'sp-25', lat: 41.500, lng: -70.570, corridorNM: 1.5 },   // Nantucket Sound, N of the Chops
  { id: 'sp-26', lat: 41.450, lng: -70.400, corridorNM: 2.5 },   // Nantucket Sound, S of Horseshoe Shoal
  { id: 'sp-27', lat: 41.395, lng: -70.220, corridorNM: 2.5 },   // Nantucket Sound, S of Cross Rip
  { id: 'sp-28', lat: 41.345, lng: -70.100, corridorNM: 2 },     // Off the Nantucket entrance jetties
]

// Channels off the spine, for water the spine never enters: the bays and the
// passages through the island chains. Each branch leaves an existing waypoint
// (`from`) and, where it comes out somewhere else rather than dead-ending, joins
// another one (`to`) — that is what makes Quicks Hole and Woods Hole shortcuts
// between Vineyard Sound and Buzzards Bay rather than cul-de-sacs.
//
// `from` and `to` name a waypoint on the spine or on any branch, earlier or
// later in this list. A typo there leaves a branch unreachable rather than
// throwing, so run `npm run route:probe` after editing this — it reports any
// waypoint the router cannot get to, and any leg or waypoint on land.
//
// Coordinates are read off the chart, mid-channel, and are good to a few tenths
// of a mile. They mark where the deep water runs, not a course to steer.
export const navigationBranches = [
  // The inside route from The Race to Block Island Sound: Fishers Island Sound,
  // for New London, Mystic, Stonington and Watch Hill, out through the passages
  // east of Fishers Island.
  {
    id: 'br-fishers-island-sound',
    name: 'Fishers Island Sound',
    from: 'sp-14',
    to: 'sp-17',
    waypoints: [
      { id: 'fs-01', lat: 41.290, lng: -72.060, corridorNM: 1.5 },  // Off New London Ledge
      { id: 'fs-02', lat: 41.293, lng: -71.990, corridorNM: 1.0 },  // Fishers Island Sound
      { id: 'fs-03', lat: 41.300, lng: -71.905, corridorNM: 0.8 },  // Off Stonington
      { id: 'fs-04', lat: 41.290, lng: -71.870, corridorNM: 0.8 },  // Watch Hill Passage
    ],
  },
  // The Connecticut River to Essex. GSHHG, the shoreline route:probe checks
  // against, stops at the I-95 bridge, so `river` excuses these legs from that
  // check; the waypoints follow the river's course by eye and are the one part
  // of the graph nothing verifies automatically.
  {
    id: 'br-connecticut-river',
    name: 'Connecticut River',
    from: 'sp-12',
    river: true,
    waypoints: [
      { id: 'ct-01', lat: 41.262, lng: -72.339, corridorNM: 0.3 },  // Between the Saybrook jetties
      { id: 'ct-02', lat: 41.283, lng: -72.340, corridorNM: 0.3 },  // Off Saybrook Point
      { id: 'ct-03', lat: 41.306, lng: -72.350, corridorNM: 0.2 },  // The I-95 and railroad bridges
      { id: 'ct-04', lat: 41.327, lng: -72.363, corridorNM: 0.2 },  // Below Nott Island
      { id: 'ct-05', lat: 41.344, lng: -72.378, corridorNM: 0.2 },  // Off Essex
    ],
  },
  // Huntington Bay and Northport Bay sit behind Lloyd Neck and Eatons Neck, and
  // the only way in from the Sound is between the two. Five harbors and
  // anchorages are in there; without this branch the nearest channel waypoints
  // are out in the Sound, across a neck of land from all of them.
  {
    id: 'br-huntington-bay',
    name: 'Huntington and Northport Bays',
    from: 'sp-04',
    waypoints: [
      // Far enough west of Lloyd Point that Oyster Bay and Cold Spring Harbor
      // can reach it without clipping the neck.
      { id: 'hb-00', lat: 40.955, lng: -73.515, corridorNM: 1.0 },  // Off Lloyd Point
      { id: 'hb-01', lat: 40.975, lng: -73.430, corridorNM: 1.0 },  // Huntington Bay entrance, W of Eatons Neck
      { id: 'hb-02', lat: 40.940, lng: -73.420, corridorNM: 0.8 },  // Huntington Bay
      { id: 'hb-03', lat: 40.912, lng: -73.410, corridorNM: 0.4 },  // Below the Sand City spit
      { id: 'hb-04', lat: 40.915, lng: -73.390, corridorNM: 0.5 },  // Into Northport Bay
      { id: 'hb-05', lat: 40.922, lng: -73.365, corridorNM: 0.6 },  // Northport Bay
    ],
  },
  // Plum Gut is the gate between the Sound and the bays behind the North Fork.
  // It is a third of a mile wide and runs to 5 kt, so the corridor here is
  // tighter than anywhere else east of Hell Gate.
  {
    id: 'br-plum-gut',
    name: 'Plum Gut',
    from: 'sp-13',
    waypoints: [
      { id: 'pg-01', lat: 41.1618, lng: -72.2167, corridorNM: 0.5 },  // The Gut, between Orient Point and Plum Island
      { id: 'pg-02', lat: 41.1230, lng: -72.2365, corridorNM: 1.5 },  // Gardiners Bay, inside the Gut
    ],
  },
  // The Shelter Island Sound waypoints used to sit on the island itself, on
  // North Haven and on Mashomack Point, and the legs between them crossed all
  // three. These are placed mid-channel against the shoreline in coastline.js.
  {
    id: 'br-shelter-island',
    name: 'Shelter Island Sound',
    from: 'pg-02',
    waypoints: [
      { id: 'si-01', lat: 41.1010, lng: -72.2960, corridorNM: 1.0 },  // Into Shelter Island Sound past Youngs Point
      { id: 'si-02', lat: 41.1099, lng: -72.3355, corridorNM: 0.4 },  // Between Greenport and Shelter Island's north point
      { id: 'si-03', lat: 41.1000, lng: -72.3511, corridorNM: 0.4 },  // Greenport Harbor, off Dering Harbor
    ],
  },
  // Shelter Island Sound goes all the way round the island. The west arm, past
  // Shelter Island Heights and down the island's west side to the South Ferry
  // narrows, is how Greenport reaches Sag Harbor without going out round the
  // island's east end.
  {
    id: 'br-shelter-island-west',
    name: 'Shelter Island Sound (west arm)',
    from: 'si-03',
    waypoints: [
      { id: 'si-04', lat: 41.0763, lng: -72.3708, corridorNM: 0.2 },  // Off Shelter Island Heights
      { id: 'si-05', lat: 41.0739, lng: -72.3790, corridorNM: 0.2 },
      { id: 'si-06', lat: 41.0744, lng: -72.3842, corridorNM: 0.2 },
      { id: 'si-07', lat: 41.0711, lng: -72.3894, corridorNM: 0.3 },  // W of Shelter Island
      { id: 'si-08', lat: 41.0464, lng: -72.3758, corridorNM: 0.4 },  // SW of Shelter Island
      { id: 'si-09', lat: 41.0373, lng: -72.3478, corridorNM: 0.3 },  // Off North Haven
      { id: 'si-10', lat: 41.0401, lng: -72.3240, corridorNM: 0.2 },  // The South Ferry narrows
    ],
  },
  // From the South Ferry past Sag Harbor, south of Mashomack Point and out
  // between it and Cedar Point into Gardiners Bay.
  {
    id: 'br-sag-harbor',
    name: 'Sag Harbor and Northwest Harbor',
    from: 'si-10',
    to: 'gb-01',
    waypoints: [
      { id: 'sh-01', lat: 41.0432, lng: -72.3142, corridorNM: 0.2 },  // East of the South Ferry
      { id: 'sh-02', lat: 41.0348, lng: -72.2965, corridorNM: 0.4 },  // Off Sag Harbor
      { id: 'sh-03', lat: 41.0220, lng: -72.2807, corridorNM: 0.3 },  // S of Mashomack Point
      { id: 'sh-04', lat: 41.0260, lng: -72.2681, corridorNM: 0.3 },  // Between Mashomack and Cedar Point
      { id: 'sh-05', lat: 41.0435, lng: -72.2659, corridorNM: 0.4 },  // Off Cedar Point, into Gardiners Bay
    ],
  },
  {
    id: 'br-gardiners-bay',
    name: 'Gardiners Bay',
    from: 'pg-02',
    waypoints: [
      { id: 'gb-01', lat: 41.0750, lng: -72.2300, corridorNM: 1.5 },  // Mid Gardiners Bay
    ],
  },
  // Round Block Island's north end. New Harbor is entered from the north-west,
  // and a straight line from there toward Point Judith runs over Sandy Point;
  // without this the way round was six miles back west to sp-17.
  {
    id: 'br-block-island',
    name: 'North of Block Island',
    from: 'sp-17',
    to: 'sp-18',
    waypoints: [
      { id: 'bi-01', lat: 41.250, lng: -71.585, corridorNM: 1.5 },  // Off Sandy Point, Block Island's north end
    ],
  },
  // Montauk Harbor faces Block Island Sound, and the water west of it leads
  // north of Gardiners Island into Gardiners Bay — so this branch joins the two,
  // and a Montauk-to-Sag-Harbor trip runs inside rather than back up the Sound.
  {
    id: 'br-montauk',
    name: 'Montauk and Gardiners Bay',
    from: 'sp-17',
    to: 'gb-01',
    waypoints: [
      { id: 'mt-01', lat: 41.170, lng: -71.850, corridorNM: 6 },    // Block Island Sound, off Montauk Point
      { id: 'mt-02', lat: 41.105, lng: -71.955, corridorNM: 2 },    // Off the Lake Montauk inlet
      { id: 'mt-03', lat: 41.120, lng: -72.060, corridorNM: 2 },    // NE of Gardiners Island
      { id: 'mt-04', lat: 41.135, lng: -72.140, corridorNM: 1.5 },  // N of Gardiners Island
    ],
  },
  // Narragansett Bay splits around Conanicut Island: the East Passage past
  // Newport carries the ship traffic, the West Passage past Dutch Island serves
  // Wickford and Greenwich Bay. They meet again above the island's north end,
  // between it and Prudence, where br-conanicut-north joins them; below that
  // the way across is round Beavertail.
  // Both passages used to run over land for miles at a stretch: the West
  // Passage across Quonset Point and Potowomut Neck, the East Passage across
  // Castle Hill and the Portsmouth shore. These follow the water, checked
  // against the shoreline in coastline.js.
  {
    id: 'br-narragansett-east',
    name: 'Narragansett Bay East Passage',
    from: 'sp-19',
    waypoints: [
      { id: 'nb-e-01', lat: 41.4527, lng: -71.3708, corridorNM: 0.8 },  // East Passage entrance, off Castle Hill
      { id: 'nb-e-02', lat: 41.4638, lng: -71.3676, corridorNM: 0.5 },
      { id: 'nb-e-03', lat: 41.4800, lng: -71.3517, corridorNM: 0.5 },  // Off Fort Adams, Newport Harbor entrance
      { id: 'nb-e-04', lat: 41.4940, lng: -71.3472, corridorNM: 0.8 },  // E of Rose Island
      { id: 'nb-e-05', lat: 41.5367, lng: -71.3288, corridorNM: 0.8 },  // Off Gould Island
      { id: 'nb-e-06', lat: 41.5997, lng: -71.2942, corridorNM: 0.8 },  // Between Prudence Island and Portsmouth
      { id: 'nb-e-07', lat: 41.6453, lng: -71.2917, corridorNM: 0.5 },  // W of Hog Island
      { id: 'nb-e-08', lat: 41.6567, lng: -71.2838, corridorNM: 0.4 },  // Bristol Harbor
    ],
  },
  {
    id: 'br-narragansett-west',
    name: 'Narragansett Bay West Passage',
    from: 'sp-19',
    waypoints: [
      { id: 'nb-w-01', lat: 41.4250, lng: -71.4100, corridorNM: 1.5 },  // S of Beavertail Point
      { id: 'nb-w-02', lat: 41.5003, lng: -71.4133, corridorNM: 0.6 },  // West Passage, W of Dutch Island
      { id: 'nb-w-03', lat: 41.5670, lng: -71.4014, corridorNM: 0.8 },  // Off Wickford
      { id: 'nb-w-04', lat: 41.6000, lng: -71.3867, corridorNM: 0.8 },  // E of Quonset Point
      { id: 'nb-w-05', lat: 41.6567, lng: -71.3938, corridorNM: 0.6 },  // Off Potowomut Neck, into Greenwich Bay
      { id: 'nb-w-06', lat: 41.6775, lng: -71.4152, corridorNM: 0.5 },  // Greenwich Bay
    ],
  },
  // The water north of Conanicut Point, where the two passages meet. This used
  // to be modelled as no way through, which sent Newport to East Greenwich out
  // round Beavertail and back up the West Passage: twice the distance.
  {
    id: 'br-conanicut-north',
    name: 'North of Conanicut',
    from: 'nb-w-04',
    to: 'nb-e-05',
    waypoints: [
      { id: 'cn-01', lat: 41.5863, lng: -71.3564, corridorNM: 1.0 },  // Between Conanicut Point and Prudence Island
    ],
  },
  // A boat coming from Point Judith reaches the West Passage without going out to
  // the Brenton Reef sea buoy first, so the passage gets a second way in. It
  // rounds Point Judith with the offing its circle asks for, rather than across
  // the point itself.
  {
    id: 'br-west-passage-approach',
    name: 'West Passage approach',
    from: 'sp-18',
    to: 'nb-w-01',
    waypoints: [
      { id: 'nb-w-00', lat: 41.3450, lng: -71.4600, corridorNM: 1.0 },  // SE of Point Judith
      { id: 'nb-w-0a', lat: 41.3950, lng: -71.4500, corridorNM: 1.5 },  // S of Narragansett Pier and Whale Rock
    ],
  },
  // Not modelled, and worth knowing: the Sakonnet River (Mount Hope Bay south to
  // Sakonnet Point) and the Cape Cod Canal. Trips that would use either — Bristol
  // to New Bedford, Marion to Hyannis — are routed the long way round, out of the
  // bay and back up, which is the honest answer for a planner that has no bridge
  // clearances or canal traffic rules in it.
  // Buzzards Bay opens onto Rhode Island Sound between Cuttyhunk and Gooseberry
  // Neck, ten miles of it — so the bay hangs off the Rhode Island Sound spine,
  // not off the Vineyard Sound entrance. A boat coming up from Newport turns
  // into the bay without ever going near Sow and Pigs Reef.
  {
    id: 'br-buzzards-bay',
    name: 'Buzzards Bay',
    from: 'sp-20',
    waypoints: [
      { id: 'bz-01', lat: 41.420, lng: -71.010, corridorNM: 2.5 },  // Bay entrance, NW of Cuttyhunk
      { id: 'bz-02', lat: 41.480, lng: -70.960, corridorNM: 3.0 },  // Mid bay, NW of Penikese Island
      { id: 'bz-03', lat: 41.540, lng: -70.905, corridorNM: 3.0 },  // Mid bay, off Padanaram
      // The upper bay runs south-east of West Island. These two used to sit on
      // the tip of a neck and ashore at Mattapoisett.
      { id: 'bz-04', lat: 41.578, lng: -70.8164, corridorNM: 2.0 },  // Mid bay, SE of West Island
      { id: 'bz-05', lat: 41.628, lng: -70.7464, corridorNM: 2.0 },  // Upper bay, off Mattapoisett
    ],
  },
  // Round Cuttyhunk's west end, past Sow and Pigs, between the Vineyard Sound
  // entrance and Buzzards Bay — the outside route when Quicks Hole isn't wanted.
  {
    id: 'br-sow-and-pigs',
    name: 'West of Sow and Pigs Reef',
    from: 'sp-21',
    to: 'bz-01',
    waypoints: [
      { id: 'sp-pigs', lat: 41.398, lng: -70.990, corridorNM: 0.8 },
    ],
  },
  // Cuttyhunk is entered from the Buzzards Bay side, so it gets its own waypoint
  // north of the island rather than a leg reaching over it from mid-bay.
  {
    id: 'br-cuttyhunk',
    name: 'Cuttyhunk',
    from: 'bz-01',
    waypoints: [
      { id: 'cut-01', lat: 41.448, lng: -70.945, corridorNM: 1.0 },  // N of Cuttyhunk, off the harbor
    ],
  },
  // The two holes through the Elizabeth Islands. Both are short, deep and swept
  // by current — the corridor is a few hundred yards because there is nowhere
  // else to be.
  // Both used to be placed a quarter mile off: Quicks Hole's waypoints on the
  // end of Nashawena, Woods Hole's with its leg into Buzzards Bay across
  // Nonamesset. Woods Hole in particular is narrower than anything else in the
  // graph, hence four waypoints to get through it.
  {
    id: 'br-quicks-hole',
    name: 'Quicks Hole',
    from: 'bz-02',
    to: 'sp-22',
    waypoints: [
      { id: 'qh-01', lat: 41.4523, lng: -70.8499, corridorNM: 0.5 },  // N entrance, Buzzards Bay side
      { id: 'qh-02', lat: 41.4273, lng: -70.8461, corridorNM: 0.4 },  // S entrance, into Vineyard Sound
    ],
  },
  {
    id: 'br-woods-hole',
    name: 'Woods Hole',
    from: 'sp-24',
    to: 'bz-04',
    waypoints: [
      { id: 'wh-01', lat: 41.5126, lng: -70.6759, corridorNM: 0.2 },  // The passage, Vineyard Sound end
      { id: 'wh-02', lat: 41.5218, lng: -70.6838, corridorNM: 0.1 },  // The passage
      { id: 'wh-03', lat: 41.5192, lng: -70.6863, corridorNM: 0.1 },  // The passage, Buzzards Bay end
      { id: 'wh-04', lat: 41.5463, lng: -70.7263, corridorNM: 1.2 },  // Buzzards Bay side, off Hadley Harbor
    ],
  },
  // Straight up the east side of the bay, from off Hadley Harbor to the upper
  // bay. Without this a boat running from Marion to Woods Hole, twelve miles
  // down the bay, gets sent out to the mid-bay channel and back.
  {
    id: 'br-buzzards-east',
    name: 'Buzzards Bay (east side)',
    from: 'wh-04',
    to: 'bz-05',
    waypoints: [],
  },
  {
    id: 'br-hyannis',
    name: 'Nantucket Sound north',
    from: 'sp-27',
    waypoints: [
      { id: 'hy-01', lat: 41.490, lng: -70.235, corridorNM: 2.0 },  // E of Horseshoe Shoal
      { id: 'hy-02', lat: 41.585, lng: -70.278, corridorNM: 1.2 },  // W of Bishop and Clerks, S of Hyannis
    ],
  },
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
    id: 'sag-harbor-village',
    name: 'Sag Harbor Village',
    lat: 40.9990,
    lng: -72.2960,
    description: 'Charming former whaling village with boutiques and fine dining.',
  },
  {
    id: 'gardiners-island',
    name: 'Gardiners Island',
    lat: 41.0850,
    lng: -72.1100,
    description: 'Privately held island in Gardiners Bay — no landing, but a beautiful lee to anchor under.',
  },
  {
    id: 'montauk-point',
    name: 'Montauk Point',
    lat: 41.0710,
    lng: -71.8570,
    description: "New York's easternmost light, standing over a rip that runs for a mile offshore.",
  },
  {
    id: 'mohegan-bluffs',
    name: 'Mohegan Bluffs, Block Island',
    lat: 41.1520,
    lng: -71.5680,
    description: 'Two-hundred-foot clay cliffs on the island\'s south shore, under the Southeast Light.',
  },
  {
    id: 'newport-ocean-drive',
    name: 'Newport Mansions & Ocean Drive',
    lat: 41.4700,
    lng: -71.3500,
    description: 'The Gilded Age waterfront — sail past the Breakers and Castle Hill on the way in.',
  },
  {
    id: 'prudence-island',
    name: 'Prudence Island',
    lat: 41.6200,
    lng: -71.3300,
    description: 'Undeveloped island up the East Passage, with Potters Cove at its north end.',
  },
  {
    id: 'cuttyhunk-island',
    name: 'Cuttyhunk Island',
    lat: 41.4230,
    lng: -70.9330,
    description: 'Last of the Elizabeth Islands — a raw-bar skiff, a hill to climb, and not much else.',
  },
  {
    id: 'woods-hole-village',
    name: 'Woods Hole',
    lat: 41.5240,
    lng: -70.6720,
    description: 'Oceanographic village at the Vineyard Sound end of Buzzards Bay, in a passage that runs like a river.',
  },
  {
    id: 'gay-head-cliffs',
    name: 'Gay Head Cliffs (Aquinnah)',
    lat: 41.3490,
    lng: -70.8340,
    description: 'Striped clay cliffs at the west end of Martha\'s Vineyard, above Devils Bridge.',
  },
  {
    id: 'edgartown-chappaquiddick',
    name: 'Edgartown & Chappaquiddick',
    lat: 41.3900,
    lng: -70.5060,
    description: 'Whaling captains\' houses, a hard-running harbor, and Cape Poge beyond it.',
  },
  {
    id: 'nantucket-town',
    name: 'Nantucket Town',
    lat: 41.2860,
    lng: -70.0990,
    description: 'Cobblestones, Brant Point, and thirty miles of open water between you and the mainland.',
  },
]

// Known shoals, reefs, and rocks with charted minimum depths (feet at MLW). The
// router detours around any area shallower than the boat's draft plus a safety
// clearance. Radii approximate the hazard extent — these are planning circles
// drawn around a named danger, not its charted outline.
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
  { id: 'sh-latimer', name: 'Latimer Reef', lat: 41.3040, lng: -71.9330, radiusNM: 0.3, minDepthFt: 3 },

  // Rhode Island Sound and Narragansett Bay
  { id: 'sh-brenton', name: 'Brenton Reef (off Newport)', lat: 41.4270, lng: -71.3620, radiusNM: 0.5, minDepthFt: 14 },

  // Buzzards Bay and the western entrance to Vineyard Sound
  { id: 'sh-sow-and-pigs', name: 'Sow and Pigs Reef (off Cuttyhunk)', lat: 41.4180, lng: -70.9600, radiusNM: 0.5, minDepthFt: 3 },
  { id: 'sh-dumpling-rocks', name: 'Dumpling Rocks', lat: 41.5380, lng: -70.9200, radiusNM: 0.4, minDepthFt: 3 },
  { id: 'sh-devils-bridge', name: 'Devils Bridge (off Gay Head)', lat: 41.3560, lng: -70.8480, radiusNM: 0.5, minDepthFt: 3 },

  // Vineyard Sound and Nantucket Sound. The Middle Ground splits Vineyard Sound
  // in two for most of its length; the spine runs up the Elizabeth Islands side
  // of it, and this circle marks the shoal water a deep-draft boat should not
  // wander into. Nantucket Sound's shoals are sand and they move — Horseshoe,
  // Cross Rip and Tuckernuck are the big ones a planned course has to respect.
  { id: 'sh-vineyard-middle-ground', name: 'Middle Ground (Vineyard Sound)', lat: 41.4150, lng: -70.7600, radiusNM: 1.4, minDepthFt: 6 },
  { id: 'sh-hedge-fence', name: 'Hedge Fence Shoal', lat: 41.4780, lng: -70.5200, radiusNM: 0.9, minDepthFt: 8 },
  { id: 'sh-horseshoe-shoal', name: 'Horseshoe Shoal', lat: 41.5150, lng: -70.4200, radiusNM: 2.2, minDepthFt: 6 },
  { id: 'sh-cross-rip', name: 'Cross Rip Shoal', lat: 41.4520, lng: -70.3000, radiusNM: 0.8, minDepthFt: 8 },
  { id: 'sh-tuckernuck', name: 'Tuckernuck Shoal', lat: 41.3300, lng: -70.2650, radiusNM: 1.5, minDepthFt: 6 },
  { id: 'sh-bishop-and-clerks', name: 'Bishop and Clerks', lat: 41.5730, lng: -70.2480, radiusNM: 0.4, minDepthFt: 2 },
]

// Land that sits between two harbors whose approaches are otherwise close
// together. Detection is a circular keep-out zone like shoalAreas, but
// unconditional on draft — this is land, not a depth hazard.
//
// It does two jobs. A direct approach-to-approach line that crosses one of these
// is rejected outright, so the route falls back to the channel graph and works
// its way around (the East Passage, Plum Gut, Quicks Hole). And on the legs
// between a harbor and the channel, applyLandAvoidance routes through the
// entry's curated `bypass` point — unlike a shoal, which has open water on every
// side, a headland only has water on one side, so there is nothing to compute:
// the bypass is a known-safe point beyond the tip, the way a marina's `approach`
// is a known-safe point outside its entrance.
//
// Circles are drawn to cover the land without reaching into the channel either
// side of it, which is why they are small and there are several of them along
// the Elizabeth Islands. Coordinates are approximate — enough to catch the
// crossing, not surveyed. Add more here as bad-looking routes turn up.
export const headlands = [
  // Eatons Neck and Lloyd Neck had circles here until the shoreline in
  // coastline.js took over. Each circle reached well into Huntington Bay, and
  // the Eatons Neck one sent any leg inside Northport Bay round the far side of
  // the neck to its bypass: the right answer from the Sound, the wrong one from
  // Sand City to Northport.
  // Orient Point had a circle, with its bypass in Plum Gut. With the shoreline
  // in coastline.js holding the North Fork, all it still did was send a route
  // leaving Orient for the west into the Gut and back out across the point.
  // Shelter Island's circle went with the shoreline too: its bypass point was
  // ashore on the island, and the channels round it are in the graph now.
  // Conanicut Island had a circle mid-island, with its bypass off Beavertail.
  // The West Passage runs within a mile of that circle past Dutch Island, so a
  // run down the passage was sent to Beavertail and back up it, across Dutch
  // Island. The shoreline holds the whole island, and the two passages and the
  // way round its north end are in the graph.
  // Sakonnet Point and Point Judith both stick a mile into open water between
  // harbors either side of them.
  { id: 'hl-sakonnet-point', name: 'Sakonnet Point', lat: 41.4520, lng: -71.1980, radiusNM: 0.7, bypass: { lat: 41.4200, lng: -71.1960 } },
  { id: 'hl-point-judith', name: 'Point Judith', lat: 41.3600, lng: -71.4820, radiusNM: 0.6, bypass: { lat: 41.3280, lng: -71.4870 } },
  // The Elizabeth Islands wall Buzzards Bay off from Vineyard Sound for fifteen
  // miles, and the only ways through are the holes between the islands. One
  // circle per island, with Quicks Hole left clear between Nashawena and Pasque.
  // Cuttyhunk had a small circle, with its bypass out past Sow and Pigs Reef.
  // With the shoreline holding the island and the reef a shoal of its own, all
  // it still did was take a route already round the west end back out to the
  // bypass and across the reef to the harbor, three miles for nothing.
  { id: 'hl-nashawena', name: 'Nashawena Island', lat: 41.4320, lng: -70.8950, radiusNM: 0.7, bypass: { lat: 41.4523, lng: -70.8499 } },
  // Pasque and Naushon had circles too, with bypass points that turned out to be
  // ashore on the islands themselves: every route west from Hadley Harbor was
  // sent four miles across Naushon to reach one. The shoreline covers both now.
]

// No-wake zones near marinas and harbors. Each zone has a center point and a
// radius (in NM) where speed is restricted, plus the enforced speed limit in
// knots. Harbor speed limits vary by town and are posted at the entrance —
// these are the 5 kt / no-wake rule of thumb, not a citation-proof survey.
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
  { id: 'nwz-mount-sinai', name: 'Mount Sinai Harbor', lat: 40.9650, lng: -73.0350, radiusNM: 0.25, speedLimit: 5, marinaId: 'mount-sinai' },
  { id: 'nwz-stony-brook', name: 'Stony Brook Harbor', lat: 40.9070, lng: -73.1740, radiusNM: 0.25, speedLimit: 5, marinaId: 'stony-brook' },
  { id: 'nwz-oyster-bay', name: 'Oyster Bay', lat: 40.8730, lng: -73.5300, radiusNM: 0.3, speedLimit: 5, marinaId: 'oyster-bay-marina' },
  { id: 'nwz-northport', name: 'Northport Harbor', lat: 40.9010, lng: -73.3430, radiusNM: 0.25, speedLimit: 5, marinaId: 'northport' },
  { id: 'nwz-huntington', name: 'Huntington Harbor', lat: 40.8990, lng: -73.4200, radiusNM: 0.3, speedLimit: 5, marinaId: 'huntington' },
  { id: 'nwz-cold-spring', name: 'Cold Spring Harbor', lat: 40.8710, lng: -73.4560, radiusNM: 0.25, speedLimit: 5, marinaId: 'cold-spring' },
  { id: 'nwz-manhasset', name: 'Manhasset Bay', lat: 40.8310, lng: -73.7130, radiusNM: 0.3, speedLimit: 5, marinaId: 'manhasset' },
  { id: 'nwz-mamaroneck', name: 'Mamaroneck Harbor', lat: 40.9420, lng: -73.7370, radiusNM: 0.25, speedLimit: 5, marinaId: 'mamaroneck' },
  { id: 'nwz-city-island', name: 'City Island', lat: 40.8470, lng: -73.7870, radiusNM: 0.2, speedLimit: 5, marinaId: 'city-island' },
  { id: 'nwz-old-saybrook', name: 'Connecticut River Mouth', lat: 41.2700, lng: -72.3430, radiusNM: 0.5, speedLimit: 5, marinaId: 'old-saybrook' },
  { id: 'nwz-thimble', name: 'Thimble Islands', lat: 41.2420, lng: -72.7740, radiusNM: 0.3, speedLimit: 5 },
  { id: 'nwz-fishers-island', name: 'West Harbor, Fishers Island', lat: 41.3030, lng: -72.0130, radiusNM: 0.2, speedLimit: 5, marinaId: 'fishers-island' },

  // Peconic and Gardiners Bay
  { id: 'nwz-greenport', name: 'Greenport Harbor', lat: 41.1030, lng: -72.3590, radiusNM: 0.2, speedLimit: 5, marinaId: 'greenport' },
  { id: 'nwz-dering-harbor', name: 'Dering Harbor', lat: 41.0900, lng: -72.3430, radiusNM: 0.2, speedLimit: 5, marinaId: 'dering-harbor' },
  { id: 'nwz-sag-harbor', name: 'Sag Harbor', lat: 40.9980, lng: -72.2930, radiusNM: 0.3, speedLimit: 5, marinaId: 'sag-harbor' },
  { id: 'nwz-three-mile-harbor', name: 'Three Mile Harbor', lat: 41.0300, lng: -72.1940, radiusNM: 0.3, speedLimit: 5, marinaId: 'three-mile-harbor' },

  // Block Island and Rhode Island Sound
  { id: 'nwz-montauk', name: 'Lake Montauk', lat: 41.0720, lng: -71.9350, radiusNM: 0.3, speedLimit: 5, marinaId: 'montauk' },
  { id: 'nwz-block-island-new', name: 'Great Salt Pond', lat: 41.1830, lng: -71.5800, radiusNM: 0.35, speedLimit: 5, marinaId: 'block-island-new' },
  { id: 'nwz-block-island-old', name: 'Old Harbor, Block Island', lat: 41.1720, lng: -71.5570, radiusNM: 0.2, speedLimit: 5, marinaId: 'block-island-old' },
  { id: 'nwz-point-judith', name: 'Point Judith Harbor of Refuge', lat: 41.3760, lng: -71.5090, radiusNM: 0.3, speedLimit: 5, marinaId: 'point-judith' },

  // Narragansett Bay
  { id: 'nwz-newport', name: 'Newport Harbor', lat: 41.4870, lng: -71.3260, radiusNM: 0.4, speedLimit: 5, marinaId: 'newport' },
  { id: 'nwz-jamestown', name: 'Jamestown Harbor', lat: 41.5030, lng: -71.3670, radiusNM: 0.25, speedLimit: 5, marinaId: 'jamestown' },
  { id: 'nwz-bristol', name: 'Bristol Harbor', lat: 41.6720, lng: -71.2830, radiusNM: 0.3, speedLimit: 5, marinaId: 'bristol' },
  { id: 'nwz-wickford', name: 'Wickford Harbor', lat: 41.5710, lng: -71.4450, radiusNM: 0.3, speedLimit: 5, marinaId: 'wickford' },
  { id: 'nwz-east-greenwich', name: 'East Greenwich Cove', lat: 41.6570, lng: -71.4460, radiusNM: 0.25, speedLimit: 5, marinaId: 'east-greenwich' },
  { id: 'nwz-sakonnet', name: 'Sakonnet Harbor', lat: 41.4620, lng: -71.1960, radiusNM: 0.2, speedLimit: 5, marinaId: 'sakonnet' },

  // Buzzards Bay
  { id: 'nwz-cuttyhunk', name: 'Cuttyhunk Pond', lat: 41.4200, lng: -70.9280, radiusNM: 0.25, speedLimit: 5, marinaId: 'cuttyhunk' },
  { id: 'nwz-padanaram', name: 'Padanaram Harbor', lat: 41.5780, lng: -70.9400, radiusNM: 0.3, speedLimit: 5, marinaId: 'padanaram' },
  { id: 'nwz-new-bedford', name: 'New Bedford Harbor', lat: 41.6350, lng: -70.9130, radiusNM: 0.4, speedLimit: 5, marinaId: 'new-bedford' },
  { id: 'nwz-marion', name: 'Sippican Harbor', lat: 41.7050, lng: -70.7640, radiusNM: 0.3, speedLimit: 5, marinaId: 'marion' },

  // Vineyard and Nantucket Sound. Woods Hole is not a harbor but the channel
  // through it is posted and full of ferries, so it earns a zone of its own.
  { id: 'nwz-woods-hole', name: 'Woods Hole passage', lat: 41.5240, lng: -70.6820, radiusNM: 0.3, speedLimit: 5, marinaId: 'woods-hole' },
  { id: 'nwz-falmouth', name: 'Falmouth Inner Harbor', lat: 41.5450, lng: -70.6070, radiusNM: 0.25, speedLimit: 5, marinaId: 'falmouth' },
  { id: 'nwz-menemsha', name: 'Menemsha Basin', lat: 41.3550, lng: -70.7690, radiusNM: 0.2, speedLimit: 5, marinaId: 'menemsha' },
  { id: 'nwz-vineyard-haven', name: 'Vineyard Haven Harbor', lat: 41.4550, lng: -70.6000, radiusNM: 0.3, speedLimit: 5, marinaId: 'vineyard-haven' },
  { id: 'nwz-oak-bluffs', name: 'Oak Bluffs Harbor', lat: 41.4600, lng: -70.5550, radiusNM: 0.2, speedLimit: 5, marinaId: 'oak-bluffs' },
  { id: 'nwz-edgartown', name: 'Edgartown Harbor', lat: 41.3900, lng: -70.5130, radiusNM: 0.35, speedLimit: 5, marinaId: 'edgartown' },
  { id: 'nwz-hyannis', name: 'Hyannis Inner Harbor', lat: 41.6480, lng: -70.2800, radiusNM: 0.35, speedLimit: 5, marinaId: 'hyannis' },
  { id: 'nwz-nantucket', name: 'Nantucket Harbor', lat: 41.2870, lng: -70.0980, radiusNM: 0.4, speedLimit: 5, marinaId: 'nantucket' },
]

// Bounding box used to trim NOAA's nationwide tide-station list down to stations
// that could plausibly serve a trip planned here. It reaches from the western
// Sound to east of Nantucket, because the destination list does.
//
// Known limitation: this box also takes in the Hudson, the East River, the south
// shore of Long Island and Cape Cod Bay, and pickNearestStation measures
// straight-line distance with no regard for land in between. No dropdown entry
// misresolves (`npm run tides:probe` checks that), but a GPS fix on the wrong
// side of a spit can pick up a station that is close by and not connected.
export const TIDE_STATION_BBOX = { minLat: 40.4, maxLat: 42.1, minLng: -74.2, maxLng: -69.8 }

// Outbound reference links to UConn LISICOS's own buoy panels — the app no
// longer reads these itself (Sea State is computed from wind and tide), so
// this is purely "go look at the instruments yourself" for a skipper who
// wants the raw plots. Only URLs that have been confirmed to exist are
// listed — the per-station URL pattern looks predictable, but a dead link is
// worse than a missing one.
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
