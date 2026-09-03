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
// Every layer has its own colour. That was not true before: colour encoded only
// the GROUP, and layers inside a group were lightness steps of one hue, which
// left pairs like Emergency routes and Bus stops at ΔE 1.5 — the same colour to
// any eye — and 89 of the 630 pairs under ΔE 10.
//
// Hue still says which family a layer belongs to, so "is this emergency or
// shopping" reads at a glance. What changed is that separation inside a family
// is now bought with lightness and chroma instead of being given up. Each layer
// was pinned to a ±35° window around the hue it already wore and forbidden to
// drift nearer another group's hue than its own; within that, a search maximised
// the smallest distance across all 630 pairs.
//
// Result: worst pair ΔE 7.6, and 2 pairs under ΔE 10 rather than 89. Both
// remaining pairs are inside Shops, where five layers share the orange-brown
// corner of the gamut and there is genuinely no more room.
//
//   Kumbh violet · Mobility blue · Emergency red · Civic green
//   Stay magenta · Shops orange
//
// Colour-vision deficiency is a floor, not the objective: no pair collapses
// below ΔE 4 under protanopia, deuteranopia or tritanopia (Machado 2009), and
// the per-layer glyph stays the identifier that does not depend on colour at
// all. Optimising for CVD instead caps the whole palette at ΔE 4.9, which is
// worse for everyone — 36 hues that survive colour blindness do not exist.
//
// Hospitals and Ghats keep their exact previous colour: the first is what
// someone looks for in an emergency, the second is why the map exists, and
// freeing them only bought separation by washing hospitals out to a dusty pink.
// The five layers the map opens with are additionally held to a vivid chroma;
// the other 31 may use the muted end, which is where most of the separation is
// won. Lightness runs 0.455–0.755 OKLCH — every symbol is drawn with a halo,
// white on the light theme and near-black on the dark, so both ends stay legible
// on either basemap. Terracotta is reserved for UI chrome, and every layer sits
// at least ΔE 10 from it, so nothing reads as "selected".
//
// symbol is the glyph point features render as on the map (sidebar keeps the
// plain colour dot). Kept to ASCII and the WGL4 symbol set — every character
// here renders through Noto Sans on OpenFreeMap's glyph server, so nothing
// falls back to a blank tofu box.
export const LAYERS: LayerDef[] = [
  { id: 'ghats',               file: 'ghats.geojson',               label: 'Ghats',               color: '#7b3fba', group: 'Kumbh', symbol: '~',  on: true , labels: true },
  { id: 'parking-zones',       file: 'parking-zones.geojson',       label: 'Parking zones',       color: '#aa66dc', group: 'Kumbh', symbol: 'P',  on: true },
  { id: 'ring-road',           file: 'ring-road.geojson',           label: 'Ring road',           color: '#570bdc', group: 'Kumbh', symbol: '○', on: true },
  { id: 'congestion-points',   file: 'congestion-points.geojson',   label: 'Congestion points',   color: '#d18ceb', group: 'Kumbh', symbol: '!' },
  { id: 'cctv-cameras',        file: 'cctv-cameras.geojson',        label: 'CCTV cameras',        color: '#e44ff7', group: 'Kumbh', symbol: '●' },
  { id: 'mandirs',             file: 'mandirs.geojson',             label: 'Mandirs',             color: '#6b55ff', group: 'Kumbh', symbol: '▲' },

  // From the NTKMA "Mobility plan Nashik" KMZ, split along its own folders —
  // see scripts/build-mobility.mjs. All off by default: together they are ~490
  // KB, and the route layers are only legible zoomed into one corridor anyway.
  { id: 'staging-areas',       file: 'staging-areas.geojson',       label: 'Staging areas',       color: '#189ab7', group: 'Mobility', symbol: 'S' , labels: true },
  { id: 'holding-areas',       file: 'holding-areas.geojson',       label: 'Holding areas',       color: '#0154d5', group: 'Mobility', symbol: 'HA' , labels: true },
  // Label only — the id and the file keep the KMZ's own "Railway station"
  // wording, which is what sourceFolder on every feature refers back to.
  { id: 'railway-station',     file: 'railway-station.geojson',     label: 'Station access plans', color: '#474f93', group: 'Mobility', symbol: 'R' , labels: true },
  { id: 'vip-routes',          file: 'vip-routes.geojson',          label: 'VIP routes',          color: '#939ecd', group: 'Mobility', symbol: 'VIP' , labels: true },
  { id: 'emergency-routes',    file: 'emergency-routes.geojson',    label: 'Emergency routes',    color: '#6b74c3', group: 'Mobility', symbol: 'E' , labels: true },
  { id: 'movement-routes',     file: 'movement-routes.geojson',     label: 'Movement routes',     color: '#32b7ff', group: 'Mobility', symbol: 'MV' , labels: true },
  { id: 'bus-depots',          file: 'bus-depots.geojson',          label: 'Bus depots',          color: '#0c7598', group: 'Mobility', symbol: 'BD' , labels: true },
  { id: 'bus-stops',           file: 'bus-stops.geojson',           label: 'Bus stops',           color: '#148ffd', group: 'Mobility', symbol: 'B' },

  { id: 'hospitals',           file: 'hospitals.geojson',           label: 'Hospitals',           color: '#b81d2c', group: 'Emergency', symbol: '+',  on: true },
  { id: 'police-stations',     file: 'police-stations.geojson',     label: 'Police stations',     color: '#f3888b', group: 'Emergency', symbol: '★', on: true },
  { id: 'ambulances',          file: 'ambulances.geojson',          label: 'Ambulances',          color: '#854349', group: 'Emergency', symbol: 'A' },
  { id: 'fire-stations',       file: 'fire-stations.geojson',       label: 'Fire stations',       color: '#ff1f03', group: 'Emergency', symbol: '▼' },
  { id: 'blood-banks',         file: 'blood-banks.geojson',         label: 'Blood banks',         color: '#dc0365', group: 'Emergency', symbol: '♦' },
  { id: 'diagnostic-labs',     file: 'diagnostic-labs.geojson',     label: 'Diagnostic labs',     color: '#fc5085', group: 'Emergency', symbol: 'Rx' },

  { id: 'public-toilets',      file: 'public-toilets.geojson',      label: 'Public toilets',      color: '#16cf05', group: 'Civic', symbol: 'WC' },
  { id: 'petrol-pumps',        file: 'petrol-pumps.geojson',        label: 'Petrol pumps',        color: '#0b6557', group: 'Civic', symbol: 'F' },
  { id: 'car-service-centers', file: 'car-service-centers.geojson', label: 'Car service',         color: '#5f9a6f', group: 'Civic', symbol: 'C' },
  { id: 'two-wheeler-service', file: 'two-wheeler-service.geojson', label: 'Two-wheeler service', color: '#7fc15c', group: 'Civic', symbol: 'T' },

  // NMC waste collection, from the 30 Aug 2026 vehicle tracking RTI — see
  // scripts/build-waste-fleet.mjs. Off by default: 3.1 MB between them, and a
  // round only means anything zoomed into one neighbourhood.
  //
  // These three take the gaps in the Civic ramp rather than extending it. Four
  // steps already spanned the 0.50-0.66 OKLCH band the families are held to, so
  // continuing upward would have left the basemap at L 0.71 and above; 0.530,
  // 0.579 and 0.630 interleave instead and no existing layer changes colour.
  { id: 'waste-routes',        file: 'waste-routes.geojson',        label: 'Waste routes',        color: '#1b8347', group: 'Civic', symbol: 'WR' },
  { id: 'waste-zones',         file: 'waste-zones.geojson',         label: 'Waste zones',         color: '#6dbdb2', group: 'Civic', symbol: 'WZ' },
  { id: 'waste-checkpoints',   file: 'waste-checkpoints.geojson',   label: 'Waste checkpoints',   color: '#25a214', group: 'Civic', symbol: 'CP', labels: true },

  { id: 'hotels',              file: 'hotels.geojson',              label: 'Hotels',              color: '#930380', group: 'Stay', symbol: 'H' },
  { id: 'guest-houses',        file: 'guest-houses.geojson',        label: 'Guest houses',        color: '#c72db1', group: 'Stay', symbol: 'GH' },
  { id: 'boys-hostels',        file: 'boys-hostels.geojson',        label: 'Boys hostels',        color: '#9c548d', group: 'Stay', symbol: '♂' },
  { id: 'girls-hostels',       file: 'girls-hostels.geojson',       label: 'Girls hostels',       color: '#bc79a3', group: 'Stay', symbol: '♀' },

  { id: 'grocery-shops',       file: 'grocery-shops.geojson',       label: 'Grocery shops',       color: '#6c5307', group: 'Shops', symbol: 'G' },
  { id: 'vegetable-markets',   file: 'vegetable-markets.geojson',   label: 'Vegetable markets',   color: '#c57f4c', group: 'Shops', symbol: 'V' },
  { id: 'cloud-kitchens',      file: 'cloud-kitchens.geojson',      label: 'Cloud kitchens',      color: '#8d7718', group: 'Shops', symbol: 'K' },
  { id: 'malls',               file: 'malls.geojson',               label: 'Malls',               color: '#ee6f13', group: 'Shops', symbol: 'M' },
  { id: 'watch-stores',        file: 'watch-stores.geojson',        label: 'Watch & clock shops', color: '#aca267', group: 'Shops', symbol: 'W' },
];

export const GROUPS = ['Kumbh', 'Mobility', 'Emergency', 'Civic', 'Stay', 'Shops'] as const;
