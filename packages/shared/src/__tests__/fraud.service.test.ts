// Fraud Detection Service Tests
import { describe, it, expect, beforeEach } from '@jest/globals';
import { detectFraud } from '../services/fraud.service';
import type { FraudCheckParams } from '../services/fraud.service';

describe('Fraud Detection Service', () => {
  describe('GPS Accuracy Layer', () => {
    it('should pass with good GPS accuracy (≤50m)', async () => {
      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 30
        },
        poiLocation: {
          lat: 37.5665,
          lng: 126.9780
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: null
      };

      const result = await detectFraud(params);
      expect(result.score).toBeLessThan(0.3);
    });

    it('should flag poor GPS accuracy (>100m)', async () => {
      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 150
        },
        poiLocation: {
          lat: 37.5665,
          lng: 126.9780
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: null
      };

      const result = await detectFraud(params);
      expect(result.flags).toContain('poor_gps_accuracy');
      expect(result.score).toBeGreaterThan(0.3);
    });
  });

  describe('H3 Proximity Layer', () => {
    it('should pass when user is in same H3 cell as POI', async () => {
      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 20
        },
        poiLocation: {
          lat: 37.5665,
          lng: 126.9780
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: null
      };

      const result = await detectFraud(params);
      expect(result.passed).toBe(true);
    });

    it('should flag when user is far from POI H3 cell', async () => {
      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 20
        },
        poiLocation: {
          lat: 37.6,
          lng: 127.0,
          accuracy: 20
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: null
      };

      const result = await detectFraud(params);
      expect(result.flags).toContain('h3_distance_suspicious');
    });
  });

  describe('Teleportation Detection', () => {
    it('should flag impossible fast travel', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 20
        },
        poiLocation: {
          lat: 37.5665,
          lng: 126.9780
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: {
          location: {
            lat: 37.4,
            lng: 127.1
          },
          timestamp: oneMinuteAgo
        }
      };

      const result = await detectFraud(params);
      expect(result.flags).toContain('teleportation_detected');
      expect(result.passed).toBe(false);
    });

    it('should pass with reasonable travel time', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 20
        },
        poiLocation: {
          lat: 37.5665,
          lng: 126.9780
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: {
          location: {
            lat: 37.5665,
            lng: 126.98
          },
          timestamp: oneHourAgo
        }
      };

      const result = await detectFraud(params);
      expect(result.flags).not.toContain('teleportation_detected');
    });
  });

  describe('Overall Fraud Score', () => {
    it('should return low score for legitimate check-in', async () => {
      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 15
        },
        poiLocation: {
          lat: 37.5665,
          lng: 126.9780
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: null
      };

      const result = await detectFraud(params);
      expect(result.score).toBeLessThan(0.5);
      expect(result.passed).toBe(true);
      expect(result.flags.length).toBe(0);
    });

    it('should return high score for suspicious check-in', async () => {
      const params: FraudCheckParams = {
        userId: 'test-user',
        currentLocation: {
          lat: 37.5665,
          lng: 126.9780,
          accuracy: 200
        },
        poiLocation: {
          lat: 37.6,
          lng: 127.0
        },
        poiH3: '8a2a100d0a97fff',
        previousCheckIn: null
      };

      const result = await detectFraud(params);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.passed).toBe(false);
      expect(result.flags.length).toBeGreaterThan(0);
    });
  });
});
