// Anomaly detection service for behavioral patterns
// Detects sophisticated fraud attempts that pass individual checks

import { prisma } from '@zzik/database/src/client';
import { distanceMeters } from '../utils/distance.util';

export interface AnomalyCheckResult {
  suspicious: boolean;
  anomalies: string[];
  score: number; // 0.0 = normal, 1.0 = highly suspicious
  autoBlock: boolean; // Auto-block if true
}

/**
 * Detect anomalous check-in patterns
 * Catches sophisticated fraud that might pass individual validations
 */
export async function detectAnomalies(params: {
  userId: string;
  currentLocation: { lat: number; lng: number };
  poiId: string;
  timestamp: Date;
}): Promise<AnomalyCheckResult> {
  const anomalies: string[] = [];
  let score = 0;
  let autoBlock = false;

  // Get user's recent check-in history (last 24 hours)
  const recentCheckIns = await prisma.validatedCheckIn.findMany({
    where: {
      userId: params.userId,
      checkedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { checkedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      userLat: true,
      userLng: true,
      checkedAt: true,
      poiId: true,
      fraudScore: true
    }
  });

  if (recentCheckIns.length > 0) {
    const lastCheckIn = recentCheckIns[0];
    const timeDiffMs = params.timestamp.getTime() - lastCheckIn.checkedAt.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    // Calculate distance from last location
    const distanceKm = distanceMeters(
      { lat: lastCheckIn.userLat, lng: lastCheckIn.userLng },
      { lat: params.currentLocation.lat, lng: params.currentLocation.lng }
    ) / 1000;

    // ANOMALY 1: Impossible travel speed (>100 km/h sustained)
    if (timeDiffHours > 0 && timeDiffHours < 1) {
      const speedKmh = distanceKm / timeDiffHours;
      
      if (speedKmh > 100) {
        anomalies.push('impossible_travel_speed');
        score += 0.4;
        
        console.warn('[Anomaly] Impossible travel speed detected', {
          userId: params.userId,
          speedKmh: Math.round(speedKmh),
          distanceKm: Math.round(distanceKm),
          timeDiffHours: timeDiffHours.toFixed(2),
          lastCheckIn: lastCheckIn.checkedAt,
          currentCheckIn: params.timestamp
        });

        // Auto-block if speed > 200 km/h (clearly spoofed)
        if (speedKmh > 200) {
          autoBlock = true;
        }
      }
    }

    // ANOMALY 2: Rapid sequential check-ins (<5 minutes apart)
    if (timeDiffMs < 5 * 60 * 1000 && distanceKm > 1) {
      anomalies.push('rapid_sequential_checkins');
      score += 0.3;
      
      console.warn('[Anomaly] Rapid check-ins detected', {
        userId: params.userId,
        timeDiffMinutes: Math.round(timeDiffMs / (1000 * 60)),
        distanceKm: Math.round(distanceKm)
      });
    }

    // ANOMALY 3: Same POI check-in (<1 hour)
    if (lastCheckIn.poiId === params.poiId && timeDiffHours < 1) {
      anomalies.push('duplicate_poi_too_soon');
      score += 0.2;
      
      console.warn('[Anomaly] Duplicate POI check-in too soon', {
        userId: params.userId,
        poiId: params.poiId,
        timeDiffMinutes: Math.round(timeDiffMs / (1000 * 60))
      });
    }
  }

  // ANOMALY 4: High check-in frequency (>10 in last hour)
  const lastHourCheckIns = recentCheckIns.filter(
    c => params.timestamp.getTime() - c.checkedAt.getTime() < 60 * 60 * 1000
  );

  if (lastHourCheckIns.length >= 10) {
    anomalies.push('excessive_hourly_checkins');
    score += 0.4;
    autoBlock = true;
    
    console.warn('[Anomaly] Excessive check-ins detected', {
      userId: params.userId,
      checkInsLastHour: lastHourCheckIns.length,
      timestamp: params.timestamp
    });
  }

  // ANOMALY 5: Suspicious pattern - many high fraud scores
  const highFraudScoreCount = recentCheckIns.filter(
    c => c.fraudScore !== null && c.fraudScore > 0.7
  ).length;

  if (highFraudScoreCount >= 3) {
    anomalies.push('repeated_high_fraud_scores');
    score += 0.3;
    
    console.warn('[Anomaly] Repeated high fraud scores', {
      userId: params.userId,
      highFraudScoreCount,
      recentCheckIns: recentCheckIns.length
    });
  }

  // ANOMALY 6: Geographic clustering anomaly (all check-ins in small area)
  if (recentCheckIns.length >= 5) {
    const locations = recentCheckIns.map(c => ({ lat: c.userLat, lng: c.userLng }));
    const avgLat = locations.reduce((sum, l) => sum + l.lat, 0) / locations.length;
    const avgLng = locations.reduce((sum, l) => sum + l.lng, 0) / locations.length;
    
    const maxDistanceFromCenter = Math.max(
      ...locations.map(l =>
        distanceMeters({ lat: l.lat, lng: l.lng }, { lat: avgLat, lng: avgLng })
      )
    );

    // All check-ins within 100m radius (suspicious for normal user)
    if (maxDistanceFromCenter < 100 && recentCheckIns.length >= 10) {
      anomalies.push('geographic_clustering_anomaly');
      score += 0.25;
      
      console.warn('[Anomaly] Geographic clustering detected', {
        userId: params.userId,
        maxDistanceFromCenter: Math.round(maxDistanceFromCenter),
        checkInCount: recentCheckIns.length
      });
    }
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  // Determine if suspicious (threshold: 0.6)
  const suspicious = score >= 0.6;

  if (suspicious || autoBlock) {
    console.warn('[Anomaly] Suspicious activity detected', {
      userId: params.userId,
      score: score.toFixed(2),
      anomalies,
      autoBlock,
      timestamp: params.timestamp
    });

    // TODO: Log to database for review (fraud model not implemented)
    /*
    try {
      await prisma.fraudReport.create({
        data: {
          userId: params.userId,
          reason: autoBlock ? 'anomaly_auto_block' : 'anomaly_suspicious',
          metadata: {
            anomalies,
            score,
            autoBlock,
            recentCheckInsCount: recentCheckIns.length,
            timestamp: params.timestamp
          }
        }
      });
    } catch (err) {
      console.error('[Anomaly] Failed to log fraud report:', err);
    }
    */
  }

  return {
    suspicious,
    anomalies,
    score,
    autoBlock
  };
}

/**
 * Get anomaly statistics for monitoring dashboard
 */
export async function getAnomalyStats(params: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  totalAnomalies: number;
  autoBlocks: number;
  topAnomalyTypes: { type: string; count: number }[];
  affectedUsers: number;
}> {
  // TODO: Implement fraud report model
  const fraudReports: any[] = [];

  const autoBlocks = 0;
  const affectedUsers = 0;

  // Count anomaly types
  const anomalyTypeCounts: Record<string, number> = {};
  fraudReports.forEach(report => {
    const metadata = report.metadata as any;
    if (metadata?.anomalies && Array.isArray(metadata.anomalies)) {
      metadata.anomalies.forEach((type: string) => {
        anomalyTypeCounts[type] = (anomalyTypeCounts[type] || 0) + 1;
      });
    }
  });

  const topAnomalyTypes = Object.entries(anomalyTypeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalAnomalies: fraudReports.length,
    autoBlocks,
    topAnomalyTypes,
    affectedUsers
  };
}

/**
 * Auto-block user if anomaly score is consistently high
 */
export async function checkAutoBlock(userId: string): Promise<boolean> {
  // TODO: Implement fraud report model
  const recentFraudReports: any[] = [];
  
  // Auto-block if 3+ auto-block events in 24 hours
  const autoBlockCount = 0;

  if (autoBlockCount >= 3) {
    console.error('[Anomaly] Auto-blocking user', {
      userId,
      autoBlockCount,
      recentReports: recentFraudReports.length
    });

    // TODO: Implement user account suspension
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { status: 'SUSPENDED', suspensionReason: 'Anomaly detection' }
    // });

    return true;
  }

  return false;
}
