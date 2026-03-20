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
  { id: 'oyster-bay-marina', name: 'Oyster Bay Marine Center, NY', lat: 40.8730, lng: -73.5300, approachDepthFt: 7, approach: { lat: 40.900, lng: -73.525 } },
  { id: 'northport', name: 'Northport Harbor, NY', lat: 40.9010, lng: -73.3430, approachDepthFt: 8, approach: { lat: 40.925, lng: -73.340 } },
  { id: 'cold-spring', name: 'Cold Spring Harbor, NY', lat: 40.8710, lng: -73.4560, approachDepthFt: 5, approach: { lat: 40.905, lng: -73.455 } },
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
    lat: 41.0010,
    lng: -73.6300,
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
