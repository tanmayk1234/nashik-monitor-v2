export type LayerDef = {
  id: string;
  file: string;
  label: string;
  color: string;
  group: 'Kumbh' | 'Emergency' | 'Civic' | 'Stay' | 'Shops';
  on?: boolean;
};

// One entry per file in public/data. Colors are hand-picked for separation at a
// glance — 24 layers on one map, so nothing here is a gradient step.
export const LAYERS: LayerDef[] = [
  { id: 'ghats',               file: 'ghats.geojson',               label: 'Ghats',                 color: '#f59e0b', group: 'Kumbh', on: true },
  { id: 'parking-zones',       file: 'parking-zones.geojson',       label: 'Parking zones',         color: '#a78bfa', group: 'Kumbh', on: true },
  { id: 'ring-road',           file: 'ring-road.geojson',           label: 'Ring road',             color: '#64748b', group: 'Kumbh' },
  { id: 'cctv-cameras',        file: 'cctv-cameras.geojson',        label: 'CCTV cameras',          color: '#22d3ee', group: 'Kumbh' },
  { id: 'mandirs',             file: 'mandirs.geojson',             label: 'Mandirs',               color: '#fb923c', group: 'Kumbh' },

  { id: 'hospitals',           file: 'hospitals.geojson',           label: 'Hospitals',             color: '#ef4444', group: 'Emergency', on: true },
  { id: 'police-stations',     file: 'police-stations.geojson',     label: 'Police stations',       color: '#3b82f6', group: 'Emergency', on: true },
  { id: 'ambulances',          file: 'ambulances.geojson',          label: 'Ambulances',            color: '#f87171', group: 'Emergency' },
  { id: 'fire-stations',       file: 'fire-stations.geojson',       label: 'Fire stations',         color: '#dc2626', group: 'Emergency' },
  { id: 'blood-banks',         file: 'blood-banks.geojson',         label: 'Blood banks',           color: '#be123c', group: 'Emergency' },
  { id: 'diagnostic-labs',     file: 'diagnostic-labs.geojson',     label: 'Diagnostic labs',       color: '#e879f9', group: 'Emergency' },

  { id: 'public-toilets',      file: 'public-toilets.geojson',      label: 'Public toilets',        color: '#14b8a6', group: 'Civic' },
  { id: 'petrol-pumps',        file: 'petrol-pumps.geojson',        label: 'Petrol pumps',          color: '#eab308', group: 'Civic' },
  { id: 'car-service-centers', file: 'car-service-centers.geojson', label: 'Car service',           color: '#84cc16', group: 'Civic' },
  { id: 'two-wheeler-service', file: 'two-wheeler-service.geojson', label: 'Two-wheeler service',   color: '#4ade80', group: 'Civic' },

  { id: 'hotels',              file: 'hotels.geojson',              label: 'Hotels',                color: '#c084fc', group: 'Stay' },
  { id: 'guest-houses',        file: 'guest-houses.geojson',        label: 'Guest houses',          color: '#818cf8', group: 'Stay' },
  { id: 'boys-hostels',        file: 'boys-hostels.geojson',        label: 'Boys hostels',          color: '#60a5fa', group: 'Stay' },
  { id: 'girls-hostels',       file: 'girls-hostels.geojson',       label: 'Girls hostels',         color: '#f472b6', group: 'Stay' },

  { id: 'grocery-shops',       file: 'grocery-shops.geojson',       label: 'Grocery shops',         color: '#2dd4bf', group: 'Shops' },
  { id: 'vegetable-markets',   file: 'vegetable-markets.geojson',   label: 'Vegetable markets',     color: '#65a30d', group: 'Shops' },
  { id: 'cloud-kitchens',      file: 'cloud-kitchens.geojson',      label: 'Cloud kitchens',        color: '#fbbf24', group: 'Shops' },
  { id: 'malls',               file: 'malls.geojson',               label: 'Malls',                 color: '#d946ef', group: 'Shops' },
  { id: 'watch-stores',        file: 'watch-stores.geojson',        label: 'Watch & clock shops',   color: '#94a3b8', group: 'Shops' },
];

export const GROUPS = ['Kumbh', 'Emergency', 'Civic', 'Stay', 'Shops'] as const;
