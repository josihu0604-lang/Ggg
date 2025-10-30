'use client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, assertMapboxToken } from '../../lib/mapbox';

// Validate token on module load
const hasToken = assertMapboxToken();
if (hasToken) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

interface POI {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  visitCount: number;
  hasActiveCampaign: boolean;
}

interface InteractiveMapProps {
  onPOIClick?: (poi: POI) => void;
}

export default function InteractiveMap({ onPOIClick }: InteractiveMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken) {
      setError('Mapbox access token not configured');
      return;
    }
    
    if (!ref.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: ref.current,
      style: MAP_STYLE,
      center: [127.0557, 37.5447], // Seongsu, Seoul
      zoom: 14,
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    mapRef.current = map;

    map.on('load', async () => {
      // Fetch nearby POIs
      const res = await fetch(
        `/api/v1/pois?lat=37.5447&lng=127.0557&radius=2000`
      );
      const data = await res.json();

      if (!data.features) {
        console.error('No features returned from API');
        setLoaded(true);
        return;
      }

      // Add GeoJSON source with clustering
      map.addSource('offers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: data.features },
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 14,
      });

      // Cluster circles
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'offers',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#2C2C30',
            10,
            '#3A3A40',
            25,
            '#4A4A52',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            10,
            24,
            25,
            32,
          ],
          'circle-stroke-width': 0.5,
          'circle-stroke-color': 'rgba(0, 0, 0, 0.5)',
        },
      });

      // Cluster count labels
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'offers',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#FFFFFF' },
      });

      // Individual POI markers
      map.addLayer({
        id: 'unclustered',
        type: 'symbol',
        source: 'offers',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'marker-15',
          'icon-size': 1.0,
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-offset': [0, 1.2],
          'text-size': 11,
        },
        paint: {
          'text-color': '#EDEDF0',
          'text-halo-color': '#000',
          'text-halo-width': 0.6,
        },
      });

      // Click to zoom clusters
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource('offers') as mapboxgl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;

          map.easeTo({
            center: (features[0].geometry as any).coordinates,
            zoom,
            duration: 250,
          });
        });
      });

      // Click to show POI popup
      map.on('click', 'unclustered', (e) => {
        if (!e.features?.length) return;

        const f = e.features[0] as any;
        new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `
            <div class="liquid-glass-offer p-3 rounded-xl">
              <div class="text-sm font-medium">${f.properties.name}</div>
              <div class="text-xs opacity-80">+₩${f.properties.reward} / ${Math.round(f.properties.distance)}m</div>
              <div class="mt-2">
                <button class="icon-btn">체크인</button>
              </div>
            </div>
          `
          )
          .addTo(map);
      });

      // Change cursor on hover
      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered', () => {
        map.getCanvas().style.cursor = '';
      });

      setLoaded(true);
    });

    return () => {
      map.remove();
    };
  }, []);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-900 p-8">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold mb-2">지도를 불러올 수 없습니다</h2>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <p className="text-xs text-gray-500">
            관리자에게 문의하거나 Mapbox 토큰을 설정해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={ref}
        role="region"
        aria-label="체크인 위치를 보여주는 인터랙티브 지도"
        aria-busy={!loaded}
        aria-describedby="map-help"
        tabIndex={0}
        className="h-full w-full"
      />
      <p id="map-help" className="sr-only">
        화살표 키로 지도를 이동하고, 플러스/마이너스 키로 확대/축소할 수 있습니다. 
        마커를 선택하면 상세 정보를 볼 수 있습니다.
      </p>
    </>
  );
}
