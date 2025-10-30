// Real H3 implementation using h3-js library
// Replaces fake implementation for production-grade geospatial indexing

import { latLngToCell, gridDistance, cellToBoundary, cellToLatLng } from 'h3-js';

/**
 * Convert latitude/longitude to H3 cell index
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @param res H3 resolution (0-15, default 10 for ~1km cells)
 * @returns H3 cell index string
 */
export function toH3Cell(lat: number, lng: number, res: number = 10): string {
  if (lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`);
  }
  if (res < 0 || res > 15) {
    throw new Error(`Invalid resolution: ${res}. Must be between 0 and 15.`);
  }

  return latLngToCell(lat, lng, res);
}

/**
 * Calculate grid distance between two H3 cells
 * @param cellA First H3 cell index
 * @param cellB Second H3 cell index
 * @returns Number of cells between A and B (0 if same cell)
 */
export function h3Distance(cellA: string, cellB: string): number {
  try {
    return gridDistance(cellA, cellB);
  } catch (error) {
    // If cells are too far apart or invalid, return max safe integer
    console.error('H3 distance calculation failed:', error);
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * Get cell boundary as array of [lat, lng] coordinates
 * Useful for visualization on maps
 */
export function getH3Boundary(cell: string): Array<[number, number]> {
  return cellToBoundary(cell, true); // forGeoJson = true
}

/**
 * Get center point of H3 cell
 */
export function getH3Center(cell: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/**
 * H3 Resolution Reference:
 * 
 * Resolution | Avg Edge Length | Avg Cell Area | Use Case
 * -----------|-----------------|---------------|----------------------------------
 * 0          | 1,107 km        | 4,250,546 km² | Continental/global aggregation
 * 1          | 418 km          | 607,220 km²   | Large regions
 * 2          | 158 km          | 86,745 km²    | Metropolitan areas
 * 3          | 59 km           | 12,392 km²    | Cities
 * 4          | 22 km           | 1,770 km²     | Districts
 * 5          | 8.5 km          | 252 km²       | Neighborhoods
 * 6          | 3.2 km          | 36 km²        | Small neighborhoods
 * 7          | 1.2 km          | 5.2 km²       | Blocks
 * 8          | 461 m           | 737,327 m²    | Large buildings
 * 9          | 174 m           | 105,332 m²    | Buildings
 * 10         | 66 m            | 15,047 m²     | ✅ POI proximity (recommended)
 * 11         | 25 m            | 2,149 m²      | Precise location
 * 12         | 9.4 m           | 307 m²        | GPS accuracy check
 * 13         | 3.5 m           | 43.9 m²       | Very precise
 * 14         | 1.3 m           | 6.3 m²        | Sub-meter precision
 * 15         | 0.5 m           | 0.9 m²        | Maximum precision
 * 
 * For fraud detection:
 * - Resolution 10 (66m avg): Good for POI proximity check (within 1-2 cells)
 * - Resolution 12 (9.4m avg): Very strict proximity (within same cell)
 */

// Backwards compatibility (deprecated, use toH3Cell instead)
export const fakeH3 = toH3Cell;
export const fakeH3Distance = h3Distance;
