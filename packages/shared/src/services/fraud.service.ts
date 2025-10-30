// Enhanced fraud detection service with real H3 implementation
// 4-layer fraud detection system for check-in validation

import { distanceMeters } from '../utils/distance.util';
import { toH3Cell, h3Distance } from '../utils/h3.util';

/**
 * Fraud detection parameters
 */
export interface FraudCheckParams {
  currentLocation: {
    lat: number;
    lng: number;
    accuracy: number; // GPS accuracy in meters
    timestamp: number; // Unix timestamp in ms
  };
  poiLocation: {
    lat: number;
    lng: number;
    h3Cell?: string; // Pre-computed H3 cell (optional)
  };
  previousLocation?: {
    lat: number;
    lng: number;
    timestamp: number;
    h3Cell?: string;
  } | null;
}

export interface FraudFlag {
  type: 'GPS_ACCURACY' | 'H3_DISTANCE' | 'TELEPORTATION' | 'CELL_JUMP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  value: number;
}

export interface FraudResult {
  passed: boolean;
  score: number; // 0-1 (0 = no fraud, 1 = definite fraud)
  flags: FraudFlag[];
  details: {
    gpsAccuracy: number;
    h3Distance: number;
    distanceMeters: number;
    velocity?: number; // m/s
    timeSinceLastCheckIn?: number; // seconds
  };
}

/**
 * Enhanced 4-layer fraud detection system
 */
export async function fraudScoreCheck(
  past: { lat: number; lng: number; ts: number } | null,
  now: { lat: number; lng: number; acc: number },
  poi: { lat: number; lng: number }
): Promise<{ fraud: number; passed: boolean }> {
  const result = await detectFraud({
    currentLocation: {
      lat: now.lat,
      lng: now.lng,
      accuracy: now.acc,
      timestamp: Date.now()
    },
    poiLocation: {
      lat: poi.lat,
      lng: poi.lng
    },
    previousLocation: past ? {
      lat: past.lat,
      lng: past.lng,
      timestamp: past.ts
    } : null
  });

  return {
    fraud: result.score,
    passed: result.passed
  };
}

/**
 * Main fraud detection function with detailed analysis
 */
export async function detectFraud(params: FraudCheckParams): Promise<FraudResult> {
  const flags: FraudFlag[] = [];
  let totalScore = 0;

  // ========================================
  // LAYER 1: GPS Accuracy Check
  // ========================================
  // High-quality GPS should be ≤20m accuracy
  // Indoor/weak signal can be 50-100m
  // Spoofed GPS often shows perfect accuracy (0-5m) or very poor (>200m)
  
  const accuracyScore = calculateAccuracyScore(params.currentLocation.accuracy);
  totalScore += accuracyScore;

  if (params.currentLocation.accuracy > 100) {
    flags.push({
      type: 'GPS_ACCURACY',
      severity: 'HIGH',
      message: `GPS accuracy too low: ${params.currentLocation.accuracy}m (expected ≤100m)`,
      value: params.currentLocation.accuracy
    });
  } else if (params.currentLocation.accuracy > 50) {
    flags.push({
      type: 'GPS_ACCURACY',
      severity: 'MEDIUM',
      message: `GPS accuracy moderate: ${params.currentLocation.accuracy}m (expected ≤50m)`,
      value: params.currentLocation.accuracy
    });
  }

  // ========================================
  // LAYER 2: H3 Proximity Check
  // ========================================
  // User and POI should be in same or adjacent H3 cells (resolution 10 = ~66m cells)
  // Distance > 1 cell = suspicious
  
  const userH3 = toH3Cell(params.currentLocation.lat, params.currentLocation.lng, 10);
  const poiH3 = 
    toH3Cell(params.poiLocation.lat, params.poiLocation.lng, 10);
  
  const gridDist = h3Distance(userH3, poiH3);
  const h3Score = calculateH3Score(gridDist);
  totalScore += h3Score;

  if (gridDist > 2) {
    flags.push({
      type: 'H3_DISTANCE',
      severity: 'CRITICAL',
      message: `User is ${gridDist} H3 cells away from POI (expected ≤1 cell)`,
      value: gridDist
    });
  } else if (gridDist > 1) {
    flags.push({
      type: 'H3_DISTANCE',
      severity: 'HIGH',
      message: `User is ${gridDist} H3 cells away from POI (expected same cell)`,
      value: gridDist
    });
  }

  // ========================================
  // LAYER 3: Physical Distance Check
  // ========================================
  // Calculate actual distance in meters
  const actualDistance = distanceMeters(
    { lat: params.currentLocation.lat, lng: params.currentLocation.lng },
    { lat: params.poiLocation.lat, lng: params.poiLocation.lng }
  );

  // ========================================
  // LAYER 4: Teleportation Detection
  // ========================================
  // Check if user moved impossibly fast since last check-in
  // Max human speed: ~15 m/s (54 km/h, running/cycling)
  // Car: ~30 m/s (108 km/h)
  // Airplane: ~250 m/s (900 km/h)
  
  let velocity: number | undefined;
  let timeSinceLastCheckIn: number | undefined;

  if (params.previousLocation) {
    timeSinceLastCheckIn = (params.currentLocation.timestamp - params.previousLocation.timestamp) / 1000; // seconds
    const prevDistance = distanceMeters(
      { lat: params.previousLocation.lat, lng: params.previousLocation.lng },
      { lat: params.currentLocation.lat, lng: params.currentLocation.lng }
    );
    
    velocity = timeSinceLastCheckIn > 0 ? prevDistance / timeSinceLastCheckIn : 0;
    const teleportScore = calculateTeleportScore(velocity, timeSinceLastCheckIn);
    totalScore += teleportScore;

    if (velocity > 50) {
      flags.push({
        type: 'TELEPORTATION',
        severity: 'CRITICAL',
        message: `Impossible velocity: ${velocity.toFixed(1)} m/s (expected <30 m/s for car)`,
        value: velocity
      });
    } else if (velocity > 30) {
      flags.push({
        type: 'TELEPORTATION',
        severity: 'HIGH',
        message: `High velocity: ${velocity.toFixed(1)} m/s (expected <15 m/s for normal movement)`,
        value: velocity
      });
    } else if (velocity > 15) {
      flags.push({
        type: 'TELEPORTATION',
        severity: 'MEDIUM',
        message: `Fast movement: ${velocity.toFixed(1)} m/s (running/cycling speed)`,
        value: velocity
      });
    }

    // ========================================
    // LAYER 5: Cell Jump Detection
    // ========================================
    // Rapid H3 cell changes indicate GPS spoofing
    const prevH3 = params.previousLocation.h3Cell || 
      toH3Cell(params.previousLocation.lat, params.previousLocation.lng, 10);
    const cellJump = h3Distance(prevH3, userH3);
    
    if (timeSinceLastCheckIn < 60 && cellJump > 5) {
      // Jumped >5 cells in <60 seconds = suspicious
      flags.push({
        type: 'CELL_JUMP',
        severity: 'HIGH',
        message: `Rapid cell jump: ${cellJump} cells in ${timeSinceLastCheckIn.toFixed(0)}s`,
        value: cellJump
      });
      totalScore += 0.3;
    }
  }

  // ========================================
  // Calculate Final Score
  // ========================================
  // Average all layer scores (0-1 scale)
  const layerCount = params.previousLocation ? 4 : 2; // With or without teleport check
  const finalScore = totalScore / layerCount;

  // Fraud threshold: 0.5 (50%)
  // < 0.3 = Safe
  // 0.3 - 0.5 = Suspicious but allowed
  // 0.5 - 0.7 = High risk, blocked
  // > 0.7 = Definite fraud, blocked
  const passed = finalScore < 0.5;

  return {
    passed,
    score: finalScore,
    flags,
    details: {
      gpsAccuracy: params.currentLocation.accuracy,
      h3Distance: gridDist,
      distanceMeters: actualDistance,
      velocity,
      timeSinceLastCheckIn
    }
  };
}

/**
 * Calculate fraud score from GPS accuracy
 * Returns 0-1 score (higher = more fraudulent)
 */
function calculateAccuracyScore(accuracy: number): number {
  if (accuracy <= 20) return 0; // Perfect GPS
  if (accuracy <= 50) return 0.1; // Good GPS
  if (accuracy <= 100) return 0.3; // Acceptable GPS
  if (accuracy <= 200) return 0.6; // Poor GPS
  return 1; // Very poor GPS (likely spoofed)
}

/**
 * Calculate fraud score from H3 grid distance
 * Returns 0-1 score (higher = more fraudulent)
 */
function calculateH3Score(gridDistance: number): number {
  if (gridDistance === 0) return 0; // Same cell = perfect
  if (gridDistance === 1) return 0.1; // Adjacent cell = acceptable
  if (gridDistance === 2) return 0.4; // 2 cells away = suspicious
  if (gridDistance <= 5) return 0.7; // 3-5 cells = very suspicious
  return 1; // >5 cells = definite fraud
}

/**
 * Calculate fraud score from velocity
 * Returns 0-1 score (higher = more fraudulent)
 */
function calculateTeleportScore(velocity: number, timeDelta: number): number {
  // If very recent check-in (<10s), be more lenient (might be GPS drift)
  if (timeDelta < 10) {
    return velocity > 30 ? 0.3 : 0;
  }

  if (velocity <= 5) return 0; // Walking speed
  if (velocity <= 15) return 0.1; // Running/cycling speed
  if (velocity <= 30) return 0.3; // Car speed (highway)
  if (velocity <= 50) return 0.6; // Fast car (suspicious)
  return 1; // >50 m/s = airplane/teleport (fraud)
}

/**
 * Get human-readable fraud assessment
 */
export function getFraudAssessment(score: number): {
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  action: 'ALLOW' | 'WARN' | 'BLOCK';
} {
  if (score < 0.3) {
    return {
      risk: 'LOW',
      message: 'Check-in appears legitimate',
      action: 'ALLOW'
    };
  } else if (score < 0.5) {
    return {
      risk: 'MEDIUM',
      message: 'Some suspicious indicators detected, but within acceptable range',
      action: 'ALLOW'
    };
  } else if (score < 0.7) {
    return {
      risk: 'HIGH',
      message: 'Multiple fraud indicators detected',
      action: 'BLOCK'
    };
  } else {
    return {
      risk: 'CRITICAL',
      message: 'Definite fraud detected (GPS spoofing likely)',
      action: 'BLOCK'
    };
  }
}
