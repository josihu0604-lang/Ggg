import { NextRequest, NextResponse } from 'next/server';
import { getNearbyPOIs } from '../../../../lib/actions/map';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/pois
 * Returns nearby POIs as GeoJSON for Mapbox
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  
  const lat = parseFloat(searchParams.get('lat') || '37.5447');
  const lng = parseFloat(searchParams.get('lng') || '127.0557');
  const radius = parseInt(searchParams.get('radius') || '2000', 10) / 1000; // Convert meters to km

  // Validate parameters
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'Invalid latitude or longitude' },
      { status: 400 }
    );
  }

  try {
    // Fetch POIs from server action
    const pois = await getNearbyPOIs(lat, lng, radius, 100);

    // Convert to GeoJSON format for Mapbox
    const features = pois.map((poi) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [poi.lng, poi.lat],
      },
      properties: {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        visitCount: poi.visitCount,
        hasActiveCampaign: poi.hasActiveCampaign,
        reward: poi.hasActiveCampaign ? 100 : 50, // Base reward
        distance: Math.round(
          getDistanceMeters(lat, lng, poi.lat, poi.lng)
        ),
      },
    }));

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    console.error('[API] Error fetching POIs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POIs' },
      { status: 500 }
    );
  }
}

/**
 * Calculate distance between two coordinates in meters
 */
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
