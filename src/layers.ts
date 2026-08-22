export type LayerDef = {
  id: string;
  file: string;
  label: string;
  color: string;
  group: 'Kumbh' | 'Emergency' | 'Civic' | 'Stay' | 'Shops';
  on?: boolean;
};

// One entry per file in public/data. Colors are mid-tone on purpose: the same
// value has to stay legible on the pale positron basemap and the dark one, so
// neither neons nor pastels work. Terracotta is reserved for UI chrome — a
// layer wearing the brand colour would read as "selected".
export const LAYERS: LayerDef[] = [
  { id: 'ghats',               file: 'ghats.geojson',               label: 'Ghats',               color: '#b45309', group: 'Kumbh', on: true },
  { id: 'parking-zones',       file: 'parking-zones.geojson',       label: 'Parking zones',       color: '#7c3aed', group: 'Kumbh', on: true },
  { id: 'ring-road',           file: 'ring-road.geojson',           label: 'Ring road',           color: '#475569', group: 'Kumbh', on: true },
  { id: 'congestion-points',   file: 'congestion-points.geojson',   label: 'Congestion points',   color: '#57534e', group: 'Kumbh' },
  { id: 'cctv-cameras',        file: 'cctv-cameras.geojson',        label: 'CCTV cameras',        color: '#0891b2', group: 'Kumbh' },
  { id: 'mandirs',             file: 'mandirs.geojson',             label: 'Mandirs',             color: '#ea580c', group: 'Kumbh' },

  { id: 'hospitals',           file: 'hospitals.geojson',           label: 'Hospitals',           color: '#dc2626', group: 'Emergency', on: true },
  { id: 'police-stations',     file: 'police-stations.geojson',     label: 'Police stations',     color: '#2563eb', group: 'Emergency', on: true },
  { id: 'ambulances',          file: 'ambulances.geojson',          label: 'Ambulances',          color: '#e11d48', group: 'Emergency' },
  { id: 'fire-stations',       file: 'fire-stations.geojson',       label: 'Fire stations',       color: '#b91c1c', group: 'Emergency' },
  { id: 'blood-banks',         file: 'blood-banks.geojson',         label: 'Blood banks',         color: '#9f1239', group: 'Emergency' },
  { id: 'diagnostic-labs',     file: 'diagnostic-labs.geojson',     label: 'Diagnostic labs',     color: '#c026d3', group: 'Emergency' },

  { id: 'public-toilets',      file: 'public-toilets.geojson',      label: 'Public toilets',      color: '#0d9488', group: 'Civic' },
  { id: 'petrol-pumps',        file: 'petrol-pumps.geojson',        label: 'Petrol pumps',        color: '#ca8a04', group: 'Civic' },
  { id: 'car-service-centers', file: 'car-service-centers.geojson', label: 'Car service',         color: '#4d7c0f', group: 'Civic' },
  { id: 'two-wheeler-service', file: 'two-wheeler-service.geojson', label: 'Two-wheeler service', color: '#16a34a', group: 'Civic' },

  { id: 'hotels',              file: 'hotels.geojson',              label: 'Hotels',              color: '#9333ea', group: 'Stay' },
  { id: 'guest-houses',        file: 'guest-houses.geojson',        label: 'Guest houses',        color: '#4f46e5', group: 'Stay' },
  { id: 'boys-hostels',        file: 'boys-hostels.geojson',        label: 'Boys hostels',        color: '#0284c7', group: 'Stay' },
  { id: 'girls-hostels',       file: 'girls-hostels.geojson',       label: 'Girls hostels',       color: '#db2777', group: 'Stay' },

  { id: 'grocery-shops',       file: 'grocery-shops.geojson',       label: 'Grocery shops',       color: '#059669', group: 'Shops' },
  { id: 'vegetable-markets',   file: 'vegetable-markets.geojson',   label: 'Vegetable markets',   color: '#65a30d', group: 'Shops' },
  { id: 'cloud-kitchens',      file: 'cloud-kitchens.geojson',      label: 'Cloud kitchens',      color: '#d97706', group: 'Shops' },
  { id: 'malls',               file: 'malls.geojson',               label: 'Malls',               color: '#a21caf', group: 'Shops' },
  { id: 'watch-stores',        file: 'watch-stores.geojson',        label: 'Watch & clock shops', color: '#64748b', group: 'Shops' },
];

export const GROUPS = ['Kumbh', 'Emergency', 'Civic', 'Stay', 'Shops'] as const;
