import { distanceMeters } from '../utils/geo.util';

describe('geo.util', () => {
  describe('distanceMeters', () => {
    test('calculates distance between two points', () => {
      // Seongsu Station to Gangnam Station (approximately 7.5 km)
      const seongsu = { lat: 37.5447, lng: 127.0557 };
      const gangnam = { lat: 37.4979, lng: 127.0276 };
      
      const distance = distanceMeters(seongsu, gangnam);
      
      // Should be around 7500 meters (allow 10% margin)
      expect(distance).toBeGreaterThan(6500);
      expect(distance).toBeLessThan(8500);
    });
    
    test('returns 0 for same location', () => {
      const location = { lat: 37.5447, lng: 127.0557 };
      
      const distance = distanceMeters(location, location);
      
      expect(distance).toBeLessThan(1); // Should be very close to 0
    });
    
    test('handles negative coordinates', () => {
      const pointA = { lat: -33.8688, lng: 151.2093 }; // Sydney
      const pointB = { lat: -37.8136, lng: 144.9631 }; // Melbourne
      
      const distance = distanceMeters(pointA, pointB);
      
      // Sydney to Melbourne is approximately 714 km
      expect(distance).toBeGreaterThan(700000);
      expect(distance).toBeLessThan(750000);
    });
    
    test('handles across-meridian distances', () => {
      const tokyo = { lat: 35.6762, lng: 139.6503 };
      const sanFrancisco = { lat: 37.7749, lng: -122.4194 };
      
      const distance = distanceMeters(tokyo, sanFrancisco);
      
      // Tokyo to SF is approximately 8,280 km
      expect(distance).toBeGreaterThan(8000000);
      expect(distance).toBeLessThan(9000000);
    });
  });
});
