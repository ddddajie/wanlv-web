const DEFAULT_OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_ATTRIBUTION = '© OpenStreetMap contributors'
const DEFAULT_FONT_STACK = ['Microsoft YaHei Regular', 'Noto Sans CJK SC Regular', 'Arial Unicode MS Regular']

function buildNameExpression() {
  return ['coalesce', ['get', 'name:zh'], ['get', 'name:zh-Hans'], ['get', 'name'], ['get', 'name_en']]
}

function createVectorStyle(sourceUrl) {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'vector',
        url: sourceUrl,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#f8fafc',
        },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'wood',
            '#c7e9c0',
            'grass',
            '#dcfce7',
            'farmland',
            '#fef3c7',
            '#e2e8f0',
          ],
          'fill-opacity': 0.8,
        },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'park',
            '#bbf7d0',
            'residential',
            '#f1f5f9',
            'industrial',
            '#e5e7eb',
            '#eef2f7',
          ],
          'fill-opacity': 0.7,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        paint: {
          'fill-color': '#93c5fd',
        },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'basemap',
        'source-layer': 'waterway',
        paint: {
          'line-color': '#60a5fa',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 1.2, 14, 2.2],
        },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'park',
        paint: {
          'fill-color': '#bbf7d0',
          'fill-opacity': 0.75,
        },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundary',
        paint: {
          'line-color': '#94a3b8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 8, 1, 12, 1.5],
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'transportation',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        paint: {
          'line-color': [
            'match',
            ['get', 'class'],
            'motorway',
            '#f97316',
            'trunk',
            '#fb923c',
            'primary',
            '#f59e0b',
            'secondary',
            '#fcd34d',
            'rail',
            '#64748b',
            '#cbd5e1',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.3, 12, 2.6, 14, 4],
        },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'building',
        minzoom: 12,
        paint: {
          'fill-color': '#d6d3d1',
          'fill-opacity': 0.85,
        },
      },
      {
        id: 'water-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'water_name',
        minzoom: 4,
        layout: {
          'text-field': buildNameExpression(),
          'text-font': DEFAULT_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 12, 12, 14],
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': '#2563eb',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
      },
      {
        id: 'road-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'transportation_name',
        minzoom: 8,
        layout: {
          'text-field': buildNameExpression(),
          'text-font': DEFAULT_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 14, 13],
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': '#475569',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.25,
        },
      },
      {
        id: 'poi-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'poi',
        minzoom: 11,
        layout: {
          'text-field': buildNameExpression(),
          'text-font': DEFAULT_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 14, 12],
          'text-offset': [0, 0.8],
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.25,
        },
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'place',
        minzoom: 3,
        layout: {
          'text-field': buildNameExpression(),
          'text-font': DEFAULT_FONT_STACK,
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            11,
            6,
            13,
            9,
            15,
            12,
            17,
          ],
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
    ],
  }
}

function createRasterStyle(tileUrl, attribution) {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ],
  }
}

export function getBaseMapStyle() {
  const styleUrl = import.meta.env.VITE_MAP_STYLE_URL?.trim()
  if (styleUrl) {
    return styleUrl
  }

  const vectorSourceUrl = import.meta.env.VITE_MAP_VECTOR_SOURCE_URL?.trim()
  if (vectorSourceUrl) {
    return createVectorStyle(vectorSourceUrl)
  }

  const rasterTileUrl = import.meta.env.VITE_MAP_RASTER_TILE_URL?.trim() || DEFAULT_OSM_TILE_URL
  const attribution = import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_ATTRIBUTION

  return createRasterStyle(rasterTileUrl, attribution)
}

export function getBaseMapConfigSummary() {
  return {
    styleUrl: import.meta.env.VITE_MAP_STYLE_URL?.trim() || '',
    vectorSourceUrl: import.meta.env.VITE_MAP_VECTOR_SOURCE_URL?.trim() || '',
    rasterTileUrl: import.meta.env.VITE_MAP_RASTER_TILE_URL?.trim() || '',
    attribution: import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || '',
  }
}
