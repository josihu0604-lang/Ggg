'use server';

import { prisma } from '@zzik/database';

export interface POIMarker {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  visitCount: number;
  hasActiveCampaign: boolean;
}

/**
 * Get POIs near a given location
 * Mock data for now - will connect to real DB when DATABASE_URL is configured
 */
export async function getNearbyPOIs(
  centerLat: number,
  centerLng: number,
  radiusKm = 5,
  limit = 50
): Promise<POIMarker[]> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[Map] DATABASE_URL not configured, returning mock data');
      return getMockPOIs(centerLat, centerLng, radiusKm, limit);
    }

    // Fetch real POIs from database
    // Simple bounding box query (for production, use H3 geospatial index)
    const latDelta = radiusKm / 111; // ~111km per degree latitude
    const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

    const pois = await prisma.pOI.findMany({
      where: {
        lat: {
          gte: centerLat - latDelta,
          lte: centerLat + latDelta,
        },
        lng: {
          gte: centerLng - lngDelta,
          lte: centerLng + lngDelta,
        },
        status: 'active',
      },
      take: limit,
      include: {
        campaigns: {
          where: {
            status: 'ACTIVE',
            endDate: {
              gte: new Date(),
            },
          },
          take: 1,
        },
      },
    });

    return pois.map((poi) => ({
      id: poi.id,
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lng: poi.lng,
      visitCount: poi.visitCount,
      hasActiveCampaign: poi.campaigns.length > 0,
    }));
  } catch (error) {
    console.error('[Map] Error fetching POIs:', error);
    return getMockPOIs(centerLat, centerLng, radiusKm, limit);
  }
}

/**
 * Mock POI data for development/testing
 */
function getMockPOIs(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  limit: number
): POIMarker[] {
  const pois: POIMarker[] = [
    // 강남 지역
    { id: 'poi-1', name: '스타벅스 강남역점', category: '카페', lat: 37.498095, lng: 127.027610, visitCount: 234, hasActiveCampaign: true },
    { id: 'poi-2', name: '던킨 강남점', category: '카페', lat: 37.497942, lng: 127.028451, visitCount: 156, hasActiveCampaign: false },
    { id: 'poi-3', name: '올리브영 강남역점', category: '편의점', lat: 37.498223, lng: 127.027890, visitCount: 189, hasActiveCampaign: true },
    
    // 광화문 지역
    { id: 'poi-4', name: '교보문고 광화문점', category: '서점', lat: 37.571607, lng: 126.988205, visitCount: 456, hasActiveCampaign: true },
    { id: 'poi-5', name: '투썸플레이스 광화문점', category: '카페', lat: 37.571234, lng: 126.987543, visitCount: 298, hasActiveCampaign: false },
    { id: 'poi-6', name: 'GS25 광화문점', category: '편의점', lat: 37.571890, lng: 126.988910, visitCount: 112, hasActiveCampaign: false },
    
    // 남산 지역
    { id: 'poi-7', name: '남산공원', category: '공원', lat: 37.551169, lng: 126.988227, visitCount: 678, hasActiveCampaign: true },
    { id: 'poi-8', name: 'N서울타워', category: '관광지', lat: 37.551169, lng: 126.988227, visitCount: 892, hasActiveCampaign: true },
    
    // 국립중앙박물관 지역
    { id: 'poi-9', name: '국립중앙박물관', category: '박물관', lat: 37.524086, lng: 126.980269, visitCount: 523, hasActiveCampaign: true },
    { id: 'poi-10', name: '용산가족공원', category: '공원', lat: 37.525234, lng: 126.979456, visitCount: 234, hasActiveCampaign: false },
    
    // 홍대 지역
    { id: 'poi-11', name: '이디야 홍대점', category: '카페', lat: 37.556221, lng: 126.922583, visitCount: 345, hasActiveCampaign: true },
    { id: 'poi-12', name: '메가커피 홍대점', category: '카페', lat: 37.556789, lng: 126.923456, visitCount: 267, hasActiveCampaign: false },
    { id: 'poi-13', name: '홍대공원', category: '공원', lat: 37.555890, lng: 126.922134, visitCount: 189, hasActiveCampaign: false },
    
    // 올림픽공원 지역
    { id: 'poi-14', name: '올림픽공원', category: '공원', lat: 37.521807, lng: 127.122528, visitCount: 445, hasActiveCampaign: true },
    
    // 신촌 지역
    { id: 'poi-15', name: '할리스 신촌점', category: '카페', lat: 37.555946, lng: 126.936893, visitCount: 234, hasActiveCampaign: false },
    { id: 'poi-16', name: '연세대학교', category: '학교', lat: 37.556389, lng: 126.935278, visitCount: 567, hasActiveCampaign: true },
    
    // 시청 지역
    { id: 'poi-17', name: '24시 헬스장', category: '헬스장', lat: 37.566826, lng: 126.978656, visitCount: 123, hasActiveCampaign: true },
    { id: 'poi-18', name: '덕수궁', category: '관광지', lat: 37.565853, lng: 126.975036, visitCount: 789, hasActiveCampaign: true },
  ];

  // Filter by distance
  const filtered = pois.filter((poi) => {
    const distance = getDistanceKm(centerLat, centerLng, poi.lat, poi.lng);
    return distance <= radiusKm;
  });

  return filtered.slice(0, limit);
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
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
