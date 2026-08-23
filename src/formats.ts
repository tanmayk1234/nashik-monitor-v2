import type { FeatureCollection, Geometry, Position } from 'geojson';

// Export converters. All string-in/string-out and dependency-free: every format
// here is a text format, so a Blob and an <a download> is the whole pipeline.
// Shapefile, GeoPackage and xlsx are deliberately absent — they are binary
// containers (zip, SQLite, OOXML) and each needs a library to write. CSV opens
// in Excel and QGIS reads GeoJSON natively, so nothing here is a dead end.

export type ExportMeta = { label: string; color: string };

export type Format = {
  ext: string;
  label: string;
  hint: string;
  mime: string;
  convert: (fc: FeatureCollection, meta: ExportMeta) => string;
};

export const NAME_KEYS = ['name', 'Name', 'Ghat Name'];

export function featureName(props: Record<string, unknown> | null | undefined): string {
  const hit = NAME_KEYS.map((k) => props?.[k]).find((v) => v !== undefined && v !== null && v !== '');
  return hit === undefined ? '' : String(hit);
}

function entries(props: Record<string, unknown> | null | undefined): [string, string][] {
  return Object.entries(props ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)]);
}

/** Well-known text, used for the geometry column of the CSV. */
function wkt(g: Geometry): string {
  const pts = (ps: Position[]): string => ps.map((p) => `${p[0]!} ${p[1]!}`).join(', ');
  const rings = (rs: Position[][]): string => rs.map((r) => `(${pts(r)})`).join(', ');
  switch (g.type) {
    case 'Point': return `POINT (${g.coordinates[0]!} ${g.coordinates[1]!})`;
    case 'MultiPoint': return `MULTIPOINT (${pts(g.coordinates)})`;
    case 'LineString': return `LINESTRING (${pts(g.coordinates)})`;
    case 'MultiLineString': return `MULTILINESTRING (${rings(g.coordinates)})`;
    case 'Polygon': return `POLYGON (${rings(g.coordinates)})`;
    case 'MultiPolygon': return `MULTIPOLYGON (${g.coordinates.map((p) => `(${rings(p)})`).join(', ')})`;
    default: return ''; // GeometryCollection — none of the 25 datasets holds one
  }
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function xml(v: string): string {
  return v.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);
}

/** KML wants aabbggrr, not #rrggbb. */
function kmlColor(hex: string): string {
  return `ff${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;
}

function kmlGeometry(g: Geometry): string {
  const coords = (ps: Position[]): string => ps.map((p) => `${p[0]!},${p[1]!}`).join(' ');
  const point = (p: Position): string => `<Point><coordinates>${p[0]!},${p[1]!}</coordinates></Point>`;
  const line = (ps: Position[]): string => `<LineString><coordinates>${coords(ps)}</coordinates></LineString>`;
  const ring = (r: Position[]): string => `<LinearRing><coordinates>${coords(r)}</coordinates></LinearRing>`;
  const poly = (rs: Position[][]): string =>
    `<Polygon><outerBoundaryIs>${ring(rs[0] ?? [])}</outerBoundaryIs>` +
    rs.slice(1).map((r) => `<innerBoundaryIs>${ring(r)}</innerBoundaryIs>`).join('') +
    '</Polygon>';
  const many = (parts: string[]): string => `<MultiGeometry>${parts.join('')}</MultiGeometry>`;
  switch (g.type) {
    case 'Point': return point(g.coordinates);
    case 'MultiPoint': return many(g.coordinates.map(point));
    case 'LineString': return line(g.coordinates);
    case 'MultiLineString': return many(g.coordinates.map(line));
    case 'Polygon': return poly(g.coordinates);
    case 'MultiPolygon': return many(g.coordinates.map(poly));
    default: return '';
  }
}

/** Every vertex of a non-point geometry, as GPX track segments. */
function gpxSegments(g: Geometry): Position[][] {
  switch (g.type) {
    case 'LineString': return [g.coordinates];
    case 'MultiLineString': return g.coordinates;
    case 'Polygon': return g.coordinates;
    case 'MultiPolygon': return g.coordinates.flat();
    default: return [];
  }
}

export const FORMATS: Format[] = [
  {
    ext: 'geojson',
    label: 'GeoJSON',
    hint: 'QGIS, Leaflet, the raw file',
    mime: 'application/geo+json',
    convert: (fc) => JSON.stringify(fc),
  },
  {
    ext: 'csv',
    label: 'CSV',
    hint: 'Excel, Google Sheets, pandas',
    mime: 'text/csv',
    convert: (fc) => {
      const keys: string[] = [];
      let anyShape = false;
      for (const f of fc.features) {
        for (const k of Object.keys(f.properties ?? {})) if (!keys.includes(k)) keys.push(k);
        if (f.geometry && f.geometry.type !== 'Point') anyShape = true;
      }
      // longitude/latitude stay empty for polygons and lines rather than quietly
      // reporting one vertex as "the" location; the shape goes in wkt instead.
      const header = [...keys, 'longitude', 'latitude', ...(anyShape ? ['wkt'] : [])];
      const rows = fc.features.map((f) => {
        const g = f.geometry;
        const p = g?.type === 'Point' ? g.coordinates : null;
        return [
          ...keys.map((k) => f.properties?.[k]),
          p ? p[0]! : '',
          p ? p[1]! : '',
          ...(anyShape ? [g ? wkt(g) : ''] : []),
        ]
          .map((v) => csvCell(v === null || v === undefined ? '' : String(v)))
          .join(',');
      });
      // BOM, or Excel reads the Marathi and Devanagari names as mojibake.
      return `\uFEFF${[header.join(','), ...rows].join('\r\n')}\r\n`;
    },
  },
  {
    ext: 'kml',
    label: 'KML',
    hint: 'Google Earth, Google My Maps',
    mime: 'application/vnd.google-earth.kml+xml',
    convert: (fc, meta) => {
      const placemarks = fc.features.map((f) => {
        const desc = entries(f.properties).map(([k, v]) => `${k}: ${v}`).join('\n');
        return (
          '<Placemark>' +
          `<name>${xml(featureName(f.properties) || meta.label)}</name>` +
          (desc ? `<description>${xml(desc)}</description>` : '') +
          '<styleUrl>#nm</styleUrl>' +
          (f.geometry ? kmlGeometry(f.geometry) : '') +
          '</Placemark>'
        );
      });
      const color = kmlColor(meta.color);
      return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
        `<name>${xml(meta.label)} — Nashik Monitor</name>` +
        `<Style id="nm"><IconStyle><color>${color}</color></IconStyle>` +
        `<LineStyle><color>${color}</color><width>2</width></LineStyle>` +
        `<PolyStyle><color>60${color.slice(2)}</color></PolyStyle></Style>` +
        `${placemarks.join('')}</Document></kml>\n`
      );
    },
  },
  {
    ext: 'gpx',
    label: 'GPX',
    hint: 'GPS units, OsmAnd, Garmin',
    mime: 'application/gpx+xml',
    convert: (fc, meta) => {
      const body = fc.features.map((f) => {
        const name = xml(featureName(f.properties) || meta.label);
        const desc = entries(f.properties).map(([k, v]) => `${k}: ${v}`).join('; ');
        const tail = `<name>${name}</name>${desc ? `<desc>${xml(desc)}</desc>` : ''}`;
        const g = f.geometry;
        if (!g) return '';
        if (g.type === 'Point') return `<wpt lat="${g.coordinates[1]!}" lon="${g.coordinates[0]!}">${tail}</wpt>`;
        if (g.type === 'MultiPoint') {
          return g.coordinates.map((p) => `<wpt lat="${p[1]!}" lon="${p[0]!}">${tail}</wpt>`).join('');
        }
        const segs = gpxSegments(g)
          .map((s) => `<trkseg>${s.map((p) => `<trkpt lat="${p[1]!}" lon="${p[0]!}"/>`).join('')}</trkseg>`)
          .join('');
        return segs ? `<trk>${tail}${segs}</trk>` : '';
      });
      return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<gpx version="1.1" creator="Nashik Monitor" xmlns="http://www.topografix.com/GPX/1/1">' +
        `<metadata><name>${xml(meta.label)} — Nashik Monitor</name></metadata>` +
        `${body.join('')}</gpx>\n`
      );
    },
  },
  {
    ext: 'geojsonl',
    label: 'GeoJSON Lines',
    hint: 'one feature per line, for streaming',
    mime: 'application/geo+json-seq',
    convert: (fc) => `${fc.features.map((f) => JSON.stringify(f)).join('\n')}\n`,
  },
];
