export type LayerDef = {
  id: string;
  file: string;
  label: string;
  color: string;
  group: 'Kumbh' | 'Emergency' | 'Civic' | 'Stay' | 'Shops';
  symbol: string;
  on?: boolean;
};

// One entry per file in public/data. Colors are mid-tone on purpose: the same
// value has to stay legible on the pale positron basemap and the dark one, so
// neither neons nor pastels work. Terracotta is reserved for UI chrome — a
// layer wearing the brand colour would read as "selected".
//
// symbol is the glyph point features render as on the map (sidebar keeps the
// plain colour dot). Kept to ASCII and the WGL4 symbol set — every character
// here renders through Noto Sans on OpenFreeMap's glyph server, so nothing
// falls back to a blank tofu box.
export const LAYERS: LayerDef[] = [
  { id: 'ghats',               file: 'ghats.geojson',               label: 'Ghats',               color: '#b45309', group: 'Kumbh', symbol: '~',  on: true },
  { id: 'parking-zones',       file: 'parking-zones.geojson',       label: 'Parking zones',       color: '#7c3aed', group: 'Kumbh', symbol: 'P',  on: true },
  { id: 'ring-road',           file: 'ring-road.geojson',           label: 'Ring road',           color: '#475569', group: 'Kumbh', symbol: '○', on: true },
  { id: 'congestion-points',   file: 'congestion-points.geojson',   label: 'Congestion points',   color: '#57534e', group: 'Kumbh', symbol: '!' },
  { id: 'cctv-cameras',        file: 'cctv-cameras.geojson',        label: 'CCTV cameras',        color: '#0891b2', group: 'Kumbh', symbol: '●' },
  { id: 'mandirs',             file: 'mandirs.geojson',             label: 'Mandirs',             color: '#ea580c', group: 'Kumbh', symbol: '▲' },

  { id: 'hospitals',           file: 'hospitals.geojson',           label: 'Hospitals',           color: '#dc2626', group: 'Emergency', symbol: '+',  on: true },
  { id: 'police-stations',     file: 'police-stations.geojson',     label: 'Police stations',     color: '#2563eb', group: 'Emergency', symbol: '★', on: true },
  { id: 'ambulances',          file: 'ambulances.geojson',          label: 'Ambulances',          color: '#e11d48', group: 'Emergency', symbol: 'A' },
  { id: 'fire-stations',       file: 'fire-stations.geojson',       label: 'Fire stations',       color: '#b91c1c', group: 'Emergency', symbol: '▼' },
  { id: 'blood-banks',         file: 'blood-banks.geojson',         label: 'Blood banks',         color: '#9f1239', group: 'Emergency', symbol: '♦' },
  { id: 'diagnostic-labs',     file: 'diagnostic-labs.geojson',     label: 'Diagnostic labs',     color: '#c026d3', group: 'Emergency', symbol: 'Rx' },

  { id: 'public-toilets',      file: 'public-toilets.geojson',      label: 'Public toilets',      color: '#0d9488', group: 'Civic', symbol: 'WC' },
  { id: 'petrol-pumps',        file: 'petrol-pumps.geojson',        label: 'Petrol pumps',        color: '#ca8a04', group: 'Civic', symbol: 'F' },
  { id: 'car-service-centers', file: 'car-service-centers.geojson', label: 'Car service',         color: '#4d7c0f', group: 'Civic', symbol: 'C' },
  { id: 'two-wheeler-service', file: 'two-wheeler-service.geojson', label: 'Two-wheeler service', color: '#16a34a', group: 'Civic', symbol: 'T' },

  { id: 'hotels',              file: 'hotels.geojson',              label: 'Hotels',              color: '#9333ea', group: 'Stay', symbol: 'H' },
  { id: 'guest-houses',        file: 'guest-houses.geojson',        label: 'Guest houses',        color: '#4f46e5', group: 'Stay', symbol: 'GH' },
  { id: 'boys-hostels',        file: 'boys-hostels.geojson',        label: 'Boys hostels',        color: '#0284c7', group: 'Stay', symbol: '♂' },
  { id: 'girls-hostels',       file: 'girls-hostels.geojson',       label: 'Girls hostels',       color: '#db2777', group: 'Stay', symbol: '♀' },

  { id: 'grocery-shops',       file: 'grocery-shops.geojson',       label: 'Grocery shops',       color: '#059669', group: 'Shops', symbol: 'G' },
  { id: 'vegetable-markets',   file: 'vegetable-markets.geojson',   label: 'Vegetable markets',   color: '#65a30d', group: 'Shops', symbol: 'V' },
  { id: 'cloud-kitchens',      file: 'cloud-kitchens.geojson',      label: 'Cloud kitchens',      color: '#d97706', group: 'Shops', symbol: 'K' },
  { id: 'malls',               file: 'malls.geojson',               label: 'Malls',               color: '#a21caf', group: 'Shops', symbol: 'M' },
  { id: 'watch-stores',        file: 'watch-stores.geojson',        label: 'Watch & clock shops', color: '#64748b', group: 'Shops', symbol: 'W' },
];

export const GROUPS = ['Kumbh', 'Emergency', 'Civic', 'Stay', 'Shops'] as const;
