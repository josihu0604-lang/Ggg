import { Counter, Histogram, Gauge } from 'prom-client';

// ===== CHECK-IN METRICS =====

export const checkinsTotal = new Counter({
  name: 'zzik_checkins_total',
  help: 'Total check-ins',
  labelNames: ['status', 'tier', 'method'], // status: success/failed, tier: FREE/PREMIUM, method: GPS/QR_CODE
});

export const checkinDuration = new Histogram({
  name: 'zzik_checkin_duration_seconds',
  help: 'Check-in latency',
  buckets: [0.1, 0.3, 0.5, 1, 2],
  labelNames: ['method'],
});

export const fraudDetections = new Counter({
  name: 'zzik_fraud_detections_total',
  help: 'Total fraud detections',
  labelNames: ['type'], // type: gps_spoofing, teleportation, etc.
});

export const fraudScore = new Histogram({
  name: 'zzik_fraud_score',
  help: 'Fraud detection score distribution',
  buckets: [0.1, 0.3, 0.5, 0.7, 0.9, 1.0],
});

// ===== TOKEN METRICS =====

export const tokensEarned = new Counter({
  name: 'zzik_tokens_earned_total',
  help: 'Total tokens earned by users',
  labelNames: ['tier'],
});

export const tokensRedeemed = new Counter({
  name: 'zzik_tokens_redeemed_total',
  help: 'Total tokens redeemed',
});

export const tokenRedemptionValue = new Counter({
  name: 'zzik_token_redemption_value_krw',
  help: 'Total redemption value in KRW',
});

export const tokenBalance = new Gauge({
  name: 'zzik_token_balance_current',
  help: 'Current token balance across all users',
});

// ===== SUBSCRIPTION METRICS =====

export const subscriptionsActive = new Gauge({
  name: 'zzik_subscriptions_active',
  help: 'Active subscriptions by tier',
  labelNames: ['tier'], // FREE, PREMIUM
});

export const subscriptionRevenue = new Counter({
  name: 'zzik_subscription_revenue_krw',
  help: 'Subscription revenue in KRW',
  labelNames: ['tier'],
});

export const subscriptionChurns = new Counter({
  name: 'zzik_subscription_churns_total',
  help: 'Total subscription cancellations',
  labelNames: ['tier', 'reason'],
});

// ===== QR CODE METRICS =====

export const qrScans = new Counter({
  name: 'zzik_qr_scans_total',
  help: 'Total QR code scans',
  labelNames: ['status'], // valid, invalid, expired, already_used
});

export const qrReuseAttempts = new Counter({
  name: 'zzik_qr_reuse_attempts_total',
  help: 'QR code reuse attempts (security)',
});

// ===== STREAK METRICS =====

export const streakMilestones = new Counter({
  name: 'zzik_streak_milestones_total',
  help: 'Streak milestones achieved',
  labelNames: ['milestone'], // 3d, 7d, 14d, 30d, 60d, 100d, 365d
});

export const streaksBroken = new Counter({
  name: 'zzik_streaks_broken_total',
  help: 'Total streaks broken',
});

export const currentStreaks = new Histogram({
  name: 'zzik_current_streaks',
  help: 'Distribution of current streak lengths',
  buckets: [1, 3, 7, 14, 30, 60, 100, 365],
});

// ===== RATE LIMITING METRICS =====

export const rateLimitExceeded = new Counter({
  name: 'zzik_rate_limit_exceeded_total',
  help: 'Rate limit exceeded events',
  labelNames: ['action'], // checkin, token_redeem, api_call
});

// ===== ANOMALY DETECTION METRICS =====

export const anomaliesDetected = new Counter({
  name: 'zzik_anomalies_detected_total',
  help: 'Anomalies detected',
  labelNames: ['type'], // impossible_travel, rapid_checkins, etc.
});

export const autoBlocksExecuted = new Counter({
  name: 'zzik_auto_blocks_total',
  help: 'Auto-blocks executed due to anomalies',
});

// ===== API METRICS =====

export const apiRequests = new Counter({
  name: 'zzik_api_requests_total',
  help: 'Total API requests',
  labelNames: ['method', 'endpoint', 'status'],
});

export const apiDuration = new Histogram({
  name: 'zzik_api_duration_seconds',
  help: 'API request duration',
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  labelNames: ['method', 'endpoint'],
});
