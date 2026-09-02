export type LayerDef = {
  id: string;
  file: string;
  label: string;
  color: string;
  group: 'Kumbh' | 'Mobility' | 'Emergency' | 'Civic' | 'Stay' | 'Shops';
  symbol: string;
  on?: boolean;
  // Name the features on the map from zoom 13, the way Google Earth does. Set
  // on the layers imported from a styled KML, which carry per-feature colours.
  labels?: boolean;
};

// One entry per file in public/data.
//
// Colour encodes the GROUP, not the layer: 31 mutually distinguishable hues do
// not exist. Six is about the ceiling before colour-vision-deficient viewers
// stop being able to separate them, so the six groups get one hue family each
// and every layer is a lightness step within its family. The per-layer glyph,
// not the colour, is what says which layer a mark belongs to — colour only has
// to answer "is this emergency or shopping".
//
// The families were chosen by search rather than by eye and clear every gate on
// all pairs, in both themes, against both basemaps: worst CVD ΔE 8.3 (target 8)
// and worst normal-vision ΔE 15.0 (floor 15). Steps inside a family are
// deliberately close and do not clear those gates on their own; the glyph is the
// secondary encoding that makes that legal.
//
//   Kumbh #8e48bb violet · Mobility #1795fa blue · Emergency #c13425 red
//   Civic #56a76a green · Stay #c274a9 mauve · Shops #d37812 orange
//
// Lightness stays inside 0.50–0.66 OKLCH so every step holds up on the pale
// positron basemap and the dark one. Terracotta is reserved for UI chrome — a
// layer wearing the brand colour would read as "selected".
//
// symbol is the glyph point features render as on the map (sidebar keeps the
// plain colour dot). Kept to ASCII and the WGL4 symbol set — every character
// here renders through Noto Sans on OpenFreeMap's glyph server, so nothing
// falls back to a blank tofu box.
export const LAYERS: LayerDef[] = [
  { id: 'ghats',               file: 'ghats.geojson',               label: 'Ghats',               color: '#7b3fba', group: 'Kumbh', symbol: '~',  on: true , labels: true },
  { id: 'parking-zones',       file: 'parking-zones.geojson',       label: 'Parking zones',       color: '#8748bf', group: 'Kumbh', symbol: 'P',  on: true },
  { id: 'ring-road',           file: 'ring-road.geojson',           label: 'Ring road',           color: '#9351c4', group: 'Kumbh', symbol: '○', on: true },
  { id: 'congestion-points',   file: 'congestion-points.geojson',   label: 'Congestion points',   color: '#a05ac9', group: 'Kumbh', symbol: '!' },
  { id: 'cctv-cameras',        file: 'cctv-cameras.geojson',        label: 'CCTV cameras',        color: '#ac63ce', group: 'Kumbh', symbol: '●' },
  { id: 'mandirs',             file: 'mandirs.geojson',             label: 'Mandirs',             color: '#b86cd3', group: 'Kumbh', symbol: '▲' },

  // From the NTKMA "Mobility plan Nashik" KMZ, split along its own folders —
  // see scripts/build-mobility.mjs. All off by default: together they are ~490
  // KB, and the route layers are only legible zoomed into one corridor anyway.
  { id: 'staging-areas',       file: 'staging-areas.geojson',       label: 'Staging areas',       color: '#026aa4', group: 'Mobility', symbol: 'S' , labels: true },
  { id: 'holding-areas',       file: 'holding-areas.geojson',       label: 'Holding areas',       color: '#0072b7', group: 'Mobility', symbol: 'HA' , labels: true },
  { id: 'railway-station',     file: 'railway-station.geojson',     label: 'Railway station plans', color: '#0979ca', group: 'Mobility', symbol: 'R' , labels: true },
  { id: 'vip-routes',          file: 'vip-routes.geojson',          label: 'VIP routes',          color: '#0480e1', group: 'Mobility', symbol: 'VIP' , labels: true },
  { id: 'emergency-routes',    file: 'emergency-routes.geojson',    label: 'Emergency routes',    color: '#3088eb', group: 'Mobility', symbol: 'E' , labels: true },
  { id: 'movement-routes',     file: 'movement-routes.geojson',     label: 'Movement routes',     color: '#4890f3', group: 'Mobility', symbol: 'MV' , labels: true },
  { id: 'bus-depots',          file: 'bus-depots.geojson',          label: 'Bus depots',          color: '#046eae', group: 'Mobility', symbol: 'BD' , labels: true },
  { id: 'bus-stops',           file: 'bus-stops.geojson',           label: 'Bus stops',           color: '#1a86e6', group: 'Mobility', symbol: 'B' },

  { id: 'hospitals',           file: 'hospitals.geojson',           label: 'Hospitals',           color: '#b81d2c', group: 'Emergency', symbol: '+',  on: true },
  { id: 'police-stations',     file: 'police-stations.geojson',     label: 'Police stations',     color: '#c12e2f', group: 'Emergency', symbol: '★', on: true },
  { id: 'ambulances',          file: 'ambulances.geojson',          label: 'Ambulances',          color: '#ca3d32', group: 'Emergency', symbol: 'A' },
  { id: 'fire-stations',       file: 'fire-stations.geojson',       label: 'Fire stations',       color: '#d24b36', group: 'Emergency', symbol: '▼' },
  { id: 'blood-banks',         file: 'blood-banks.geojson',         label: 'Blood banks',         color: '#da583a', group: 'Emergency', symbol: '♦' },
  { id: 'diagnostic-labs',     file: 'diagnostic-labs.geojson',     label: 'Diagnostic labs',     color: '#e36540', group: 'Emergency', symbol: 'Rx' },

  { id: 'public-toilets',      file: 'public-toilets.geojson',      label: 'Public toilets',      color: '#317630', group: 'Civic', symbol: 'WC' },
  { id: 'petrol-pumps',        file: 'petrol-pumps.geojson',        label: 'Petrol pumps',        color: '#398648', group: 'Civic', symbol: 'F' },
  { id: 'car-service-centers', file: 'car-service-centers.geojson', label: 'Car service',         color: '#43955f', group: 'Civic', symbol: 'C' },
  { id: 'two-wheeler-service', file: 'two-wheeler-service.geojson', label: 'Two-wheeler service', color: '#4fa575', group: 'Civic', symbol: 'T' },

  // NMC waste collection, from the 30 Aug 2026 vehicle tracking RTI — see
  // scripts/build-waste-fleet.mjs. Off by default: 3.1 MB between them, and a
  // round only means anything zoomed into one neighbourhood.
  //
  // These three take the gaps in the Civic ramp rather than extending it. Four
  // steps already spanned the 0.50-0.66 OKLCH band the families are held to, so
  // continuing upward would have left the basemap at L 0.71 and above; 0.530,
  // 0.579 and 0.630 interleave instead and no existing layer changes colour.
  { id: 'waste-routes',        file: 'waste-routes.geojson',        label: 'Waste routes',        color: '#357e3c', group: 'Civic', symbol: 'WR' },
  { id: 'waste-zones',         file: 'waste-zones.geojson',         label: 'Waste zones',         color: '#3e8d53', group: 'Civic', symbol: 'WZ' },
  { id: 'waste-checkpoints',   file: 'waste-checkpoints.geojson',   label: 'Waste checkpoints',   color: '#499d6a', group: 'Civic', symbol: 'CP', labels: true },

  { id: 'hotels',              file: 'hotels.geojson',              label: 'Hotels',              color: '#8d4683', group: 'Stay', symbol: 'H' },
  { id: 'guest-houses',        file: 'guest-houses.geojson',        label: 'Guest houses',        color: '#9e558b', group: 'Stay', symbol: 'GH' },
  { id: 'boys-hostels',        file: 'boys-hostels.geojson',        label: 'Boys hostels',        color: '#b06594', group: 'Stay', symbol: '♂' },
  { id: 'girls-hostels',       file: 'girls-hostels.geojson',       label: 'Girls hostels',       color: '#c1749e', group: 'Stay', symbol: '♀' },

  { id: 'grocery-shops',       file: 'grocery-shops.geojson',       label: 'Grocery shops',       color: '#9a4c08', group: 'Shops', symbol: 'G' },
  { id: 'vegetable-markets',   file: 'vegetable-markets.geojson',   label: 'Vegetable markets',   color: '#a65809', group: 'Shops', symbol: 'V' },
  { id: 'cloud-kitchens',      file: 'cloud-kitchens.geojson',      label: 'Cloud kitchens',      color: '#b2640c', group: 'Shops', symbol: 'K' },
  { id: 'malls',               file: 'malls.geojson',               label: 'Malls',               color: '#bd7011', group: 'Shops', symbol: 'M' },
  { id: 'watch-stores',        file: 'watch-stores.geojson',        label: 'Watch & clock shops', color: '#c87d18', group: 'Shops', symbol: 'W' },
];

export const GROUPS = ['Kumbh', 'Mobility', 'Emergency', 'Civic', 'Stay', 'Shops'] as const;
