# Geofence Push Notification - Technical Design Document

**Version**: 1.0  
**Date**: 2025-10-28  
**Status**: 🟡 HIGH PRIORITY - MVP Feature (RICE: 13,500)  
**Timeline**: 2 weeks implementation

---

## Problem Statement

### Current Discovery Funnel Issues

**Passive Discovery Model**: Users must actively open app to find offers
```
Current Flow:
User opens app
  ↓
Browses map manually
  ↓
Finds nearby offers
  ↓
Decides to visit (maybe)
  ↓
Check-in (low conversion)

Problem: Low engagement frequency
- Users open app ~2-3 times/week
- Miss opportunities when physically near POI
- No proactive discovery
```

**Impact on DOCV**:
- Current DOCV: 15-25% (discovery → check-in)
- Users walk past saved offers without knowing
- Missed revenue for merchants
- Lower user retention

---

## Solution Overview

### Geofence-Based Proactive Notifications

**Context-Aware Push Strategy**:
```
User saves offer ("heart" icon)
  ↓
System creates geofence (200m radius around POI)
  ↓
User enters geofence area (detected by OS)
  ↓
Push notification sent
  ↓
User taps notification → Opens app → Sees offer → Check-in ✅
```

**Expected Impact**:
- DOCV improvement: 25% → 40% (+15% absolute)
- 3x more check-ins per user
- Higher user satisfaction (timely reminders)

---

## Geofence Technology Overview

### Platform-Specific Implementations

#### iOS: CoreLocation Regions
```swift
// iOS native API
let region = CLCircularRegion(
  center: CLLocationCoordinate2D(latitude: 37.5665, longitude: 126.9780),
  radius: 200, // meters
  identifier: "poi_abc123"
)
region.notifyOnEntry = true
region.notifyOnExit = false

locationManager.startMonitoring(for: region)
```

**iOS Limits**:
- Max 20 geofences per app (strict limit)
- Battery-efficient (uses cell tower triangulation)
- Works even when app is terminated

---

#### Android: Geofencing API
```kotlin
// Android native API
val geofence = Geofence.Builder()
  .setRequestId("poi_abc123")
  .setCircularRegion(37.5665, 126.9780, 200f) // meters
  .setExpirationDuration(Geofence.NEVER_EXPIRE)
  .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
  .build()

geofencingClient.addGeofences(geofenceRequest, geofencePendingIntent)
```

**Android Limits**:
- Max 100 geofences per app (generous)
- Battery-efficient (uses cell + WiFi)
- Works even when app is killed

---

## Geofence Strategy

### Challenge: iOS 20-Geofence Limit

**Problem**: User can save >20 offers, but iOS only allows 20 geofences

**Solution**: Dynamic Geofence Management
```
Prioritization Algorithm:
1. User's current location (get nearest POIs)
2. User's favorite POIs (most visited)
3. User's recent saves (last 7 days)
4. Campaign priority (merchant paid for promotion)

Select Top 20 → Create geofences
User moves >500m → Re-calculate Top 20 → Update geofences
```

---

### Geofence Management Service

```typescript
// packages/shared/src/services/geofence.service.ts

import { prisma } from '@zzik/database/src/client';
import { distanceMeters } from '../utils/distance.util';

const GEOFENCE_RADIUS = 200; // meters
const MAX_GEOFENCES_IOS = 20;
const MAX_GEOFENCES_ANDROID = 100;

export const GeofenceService = {
  /**
   * Calculate which geofences to monitor based on user location
   * Returns prioritized list of POIs
   */
  async calculatePriorityGeofences(params: {
    userId: string;
    currentLocation: { lat: number; lng: number };
    platform: 'ios' | 'android';
  }): Promise<GeofencePOI[]> {
    const maxGeofences = params.platform === 'ios' ? MAX_GEOFENCES_IOS : MAX_GEOFENCES_ANDROID;

    // 1. Get user's saved POIs
    const savedPOIs = await prisma.savedPOI.findMany({
      where: { userId: params.userId },
      include: {
        poi: {
          select: {
            id: true,
            name: true,
            lat: true,
            lng: true,
            category: true,
          },
        },
      },
    });

    if (savedPOIs.length === 0) {
      return []; // No saved POIs, no geofences
    }

    // 2. Calculate priority score for each POI
    const scoredPOIs = await Promise.all(
      savedPOIs.map(async (saved) => {
        let score = 0;

        // Factor 1: Distance (closer = higher priority)
        const distance = distanceMeters(params.currentLocation, {
          lat: saved.poi.lat,
          lng: saved.poi.lng,
        });

        if (distance < 1000) {
          score += 50; // Within 1km = high priority
        } else if (distance < 5000) {
          score += 30; // Within 5km = medium priority
        } else {
          score += 10; // >5km = low priority
        }

        // Factor 2: Recent visits (visited before = higher priority)
        const visitCount = await prisma.validatedCheckIn.count({
          where: {
            userId: params.userId,
            poiId: saved.poi.id,
          },
        });
        score += Math.min(visitCount * 10, 30); // Max +30 points

        // Factor 3: Recency of save (recent save = higher priority)
        const daysSinceSaved = (Date.now() - saved.savedAt.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceSaved < 7) {
          score += 20; // Saved in last 7 days
        }

        // Factor 4: Campaign priority (merchant paid for promotion)
        const activeCampaign = await prisma.campaign.findFirst({
          where: {
            poiId: saved.poi.id,
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
          select: { priority: true },
        });

        if (activeCampaign) {
          score += activeCampaign.priority * 5; // Higher tier = higher priority
        }

        return {
          ...saved.poi,
          distance,
          score,
        };
      })
    );

    // 3. Sort by score (descending) and take top N
    const prioritizedPOIs = scoredPOIs
      .sort((a, b) => b.score - a.score)
      .slice(0, maxGeofences);

    return prioritizedPOIs.map((poi) => ({
      poiId: poi.id,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      radius: GEOFENCE_RADIUS,
      category: poi.category,
      distance: Math.round(poi.distance),
      score: poi.score,
    }));
  },

  /**
   * Trigger notification when user enters geofence
   */
  async handleGeofenceEntry(params: {
    userId: string;
    poiId: string;
    entryTime: Date;
  }): Promise<{ shouldNotify: boolean; notification?: PushNotification }> {
    // 1. Check if user recently checked in (avoid spam)
    const recentCheckIn = await prisma.validatedCheckIn.findFirst({
      where: {
        userId: params.userId,
        poiId: params.poiId,
        checkedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
      },
    });

    if (recentCheckIn) {
      return { shouldNotify: false }; // Already checked in recently
    }

    // 2. Check notification frequency (max 5 per day)
    const todayNotifications = await prisma.pushNotification.count({
      where: {
        userId: params.userId,
        sentAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (todayNotifications >= 5) {
      return { shouldNotify: false }; // Too many notifications today
    }

    // 3. Get POI details
    const poi = await prisma.pOI.findUnique({
      where: { id: params.poiId },
      select: {
        id: true,
        name: true,
        category: true,
        campaigns: {
          where: {
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
          select: {
            name: true,
            tokensPerCheckIn: true,
          },
          take: 1,
        },
      },
    });

    if (!poi) {
      return { shouldNotify: false };
    }

    // 4. Create notification
    const campaign = poi.campaigns[0];
    const notification: PushNotification = {
      title: `🎁 You're near ${poi.name}!`,
      body: campaign
        ? `Check-in now and earn ${campaign.tokensPerCheckIn} tokens! (${campaign.name})`
        : `Check-in now to earn rewards!`,
      data: {
        type: 'geofence_entry',
        poiId: poi.id,
        poiName: poi.name,
        category: poi.category,
        tokensAvailable: campaign?.tokensPerCheckIn || 100,
      },
      actionUrl: `/checkin/${poi.id}`,
    };

    // 5. Log notification
    await prisma.pushNotification.create({
      data: {
        userId: params.userId,
        type: 'GEOFENCE_ENTRY',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sentAt: params.entryTime,
        delivered: false, // Will be updated by FCM callback
      },
    });

    return { shouldNotify: true, notification };
  },
};

interface GeofencePOI {
  poiId: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  category: string;
  distance: number;
  score: number;
}

interface PushNotification {
  title: string;
  body: string;
  data: Record<string, any>;
  actionUrl: string;
}
```

---

## Database Schema

### Add Geofence & Notification Tables

```prisma
// packages/database/prisma/schema.prisma

model SavedPOI {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  poi       POI      @relation(fields: [poiId], references: [id], onDelete: Cascade)
  poiId     String
  
  savedAt   DateTime @default(now())
  
  // Geofence metadata
  geofenceActive Boolean @default(true) // User can disable per-POI
  notifyOnEntry  Boolean @default(true)
  
  @@unique([userId, poiId])
  @@index([userId, geofenceActive])
}

model UserGeofence {
  id            String   @id @default(cuid())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        String
  poi           POI      @relation(fields: [poiId], references: [id], onDelete: Cascade)
  poiId         String
  
  // Geofence configuration
  platform      String   // 'ios' | 'android'
  lat           Float
  lng           Float
  radius        Int      @default(200) // meters
  
  // Status
  active        Boolean  @default(true)
  priority      Int      @default(0) // Higher = more important
  
  // Tracking
  createdAt     DateTime @default(now())
  lastTriggered DateTime?
  triggerCount  Int      @default(0)
  
  @@unique([userId, poiId, platform])
  @@index([userId, active])
  @@index([poiId, active])
}

model PushNotification {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  
  type      PushNotificationType
  title     String
  body      String
  data      Json?    // Additional payload
  
  // Delivery tracking
  sentAt    DateTime @default(now())
  delivered Boolean  @default(false)
  opened    Boolean  @default(false)
  openedAt  DateTime?
  
  // FCM tracking
  fcmMessageId String?
  fcmToken     String?
  
  @@index([userId, sentAt])
  @@index([type, sentAt])
}

enum PushNotificationType {
  GEOFENCE_ENTRY     // User entered geofence
  STREAK_REMINDER    // Remind to maintain streak
  TOKEN_MILESTONE    // Reached token threshold
  CAMPAIGN_NEW       // New campaign near user
  VOUCHER_EXPIRING   // Voucher about to expire
  SYSTEM             // System announcements
}

model User {
  // ... existing fields ...
  
  savedPOIs         SavedPOI[]
  geofences         UserGeofence[]
  notifications     PushNotification[]
  
  // Push notification settings
  fcmToken          String?  // Firebase Cloud Messaging token
  pushEnabled       Boolean  @default(true)
  geofenceEnabled   Boolean  @default(true)
  notificationQuota Int      @default(5) // Max per day
}
```

---

## API Design

### Register Geofences

#### POST /api/v1/geofences/register

**Purpose**: Client requests which geofences to monitor

**Request**:
```typescript
{
  userId: 'user_abc123',
  currentLocation: {
    lat: 37.5665,
    lng: 126.9780
  },
  platform: 'ios', // or 'android'
  deviceId: 'device_xyz'
}
```

**Response**:
```typescript
{
  geofences: [
    {
      id: 'geofence_123',
      poiId: 'poi_abc',
      name: 'Café Mocha',
      lat: 37.5665,
      lng: 126.9780,
      radius: 200,
      category: 'cafe',
      distance: 450, // meters from current location
      priority: 85
    },
    // ... up to 20 for iOS, 100 for Android
  ],
  totalSaved: 45, // User has 45 saved POIs
  monitoring: 20, // But only monitoring 20 (iOS limit)
  nextUpdate: '2025-10-28T15:00:00Z' // Recommend updating in 1 hour
}
```

**Business Logic**:
1. Get user's saved POIs
2. Calculate priority scores
3. Select top N based on platform
4. Create/update UserGeofence records
5. Return geofence list for client to register

---

### Report Geofence Entry

#### POST /api/v1/geofences/entry

**Purpose**: Client reports that user entered geofence (triggered by OS)

**Request**:
```typescript
{
  userId: 'user_abc123',
  poiId: 'poi_abc',
  entryTime: '2025-10-28T14:30:00Z',
  location: {
    lat: 37.5666,
    lng: 126.9781,
    accuracy: 25
  }
}
```

**Response**:
```typescript
{
  acknowledged: true,
  notification: {
    id: 'notif_xyz',
    title: '🎁 You\'re near Café Mocha!',
    body: 'Check-in now and earn 100 tokens!',
    deepLink: 'zzik://checkin/poi_abc'
  },
  triggerCount: 3, // This is 3rd time user entered this geofence
  lastCheckIn: '2025-10-20T10:00:00Z' // Last check-in was 8 days ago
}
```

**Business Logic**:
1. Validate geofence entry (check if active)
2. Check notification frequency limits
3. Check if user recently checked in
4. Generate push notification
5. Send via FCM/APNs
6. Log notification
7. Update geofence trigger count

---

### Update FCM Token

#### POST /api/v1/users/fcm-token

**Purpose**: Register/update user's FCM token for push notifications

**Request**:
```typescript
{
  userId: 'user_abc123',
  fcmToken: 'fCMToken_dGhpcyBpcyBhIHRva2Vu...',
  platform: 'ios', // or 'android'
  deviceInfo: {
    model: 'iPhone 14 Pro',
    osVersion: '17.0'
  }
}
```

**Response**:
```typescript
{
  success: true,
  registered: true,
  pushEnabled: true
}
```

---

## Push Notification Service

### Firebase Cloud Messaging Integration

```typescript
// packages/shared/src/services/push-notification.service.ts

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

export const PushNotificationService = {
  /**
   * Send push notification via FCM
   */
  async sendPushNotification(params: {
    userId: string;
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    };
  }): Promise<{ success: boolean; messageId?: string }> {
    // 1. Get user's FCM token
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { fcmToken: true, pushEnabled: true },
    });

    if (!user || !user.fcmToken || !user.pushEnabled) {
      return { success: false };
    }

    // 2. Construct FCM message
    const message: admin.messaging.Message = {
      token: user.fcmToken,
      notification: {
        title: params.notification.title,
        body: params.notification.body,
      },
      data: params.notification.data || {},
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'geofence_channel',
        },
      },
    };

    // 3. Send via FCM
    try {
      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('FCM send failed:', error);

      // Handle invalid token (user uninstalled app)
      if (error.code === 'messaging/invalid-registration-token') {
        await prisma.user.update({
          where: { id: params.userId },
          data: { fcmToken: null },
        });
      }

      return { success: false };
    }
  },

  /**
   * Send batch notifications (for campaigns, announcements)
   */
  async sendBatchNotifications(params: {
    userIds: string[];
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    };
  }): Promise<{ successCount: number; failureCount: number }> {
    const results = await Promise.allSettled(
      params.userIds.map((userId) =>
        this.sendPushNotification({
          userId,
          notification: params.notification,
        })
      )
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failureCount = results.length - successCount;

    return { successCount, failureCount };
  },
};
```

---

## Mobile App Implementation

### iOS: Native Geofence Setup

```swift
// apps/mobile-ios/GeofenceManager.swift

import CoreLocation

class GeofenceManager: NSObject, CLLocationManagerDelegate {
    let locationManager = CLLocationManager()
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.allowsBackgroundLocationUpdates = true
    }
    
    func registerGeofences(geofences: [Geofence]) {
        // Clear existing geofences
        locationManager.monitoredRegions.forEach { region in
            locationManager.stopMonitoring(for: region)
        }
        
        // Register new geofences (max 20)
        for geofence in geofences.prefix(20) {
            let region = CLCircularRegion(
                center: CLLocationCoordinate2D(
                    latitude: geofence.lat,
                    longitude: geofence.lng
                ),
                radius: CLLocationDistance(geofence.radius),
                identifier: geofence.poiId
            )
            region.notifyOnEntry = true
            region.notifyOnExit = false
            
            locationManager.startMonitoring(for: region)
        }
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circularRegion = region as? CLCircularRegion else { return }
        
        // Report to backend
        APIClient.shared.reportGeofenceEntry(
            poiId: circularRegion.identifier,
            entryTime: Date()
        ) { result in
            switch result {
            case .success(let notification):
                self.showLocalNotification(notification)
            case .failure(let error):
                print("Failed to report geofence entry: \(error)")
            }
        }
    }
    
    func showLocalNotification(_ notification: PushNotification) {
        let content = UNMutableNotificationContent()
        content.title = notification.title
        content.body = notification.body
        content.sound = .default
        content.userInfo = notification.data
        
        let request = UNNotificationRequest(
            identifier: notification.id,
            content: content,
            trigger: nil // Immediate
        )
        
        UNUserNotificationCenter.current().add(request)
    }
}
```

---

### Android: Geofencing Client

```kotlin
// apps/mobile-android/GeofenceManager.kt

class GeofenceManager(private val context: Context) {
    private val geofencingClient = LocationServices.getGeofencingClient(context)
    
    fun registerGeofences(geofences: List<Geofence>) {
        val geofenceList = geofences.map { geofence ->
            com.google.android.gms.location.Geofence.Builder()
                .setRequestId(geofence.poiId)
                .setCircularRegion(geofence.lat, geofence.lng, geofence.radius.toFloat())
                .setExpirationDuration(com.google.android.gms.location.Geofence.NEVER_EXPIRE)
                .setTransitionTypes(com.google.android.gms.location.Geofence.GEOFENCE_TRANSITION_ENTER)
                .build()
        }
        
        val geofenceRequest = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofenceList)
            .build()
        
        val geofencePendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, GeofenceBroadcastReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        
        geofencingClient.addGeofences(geofenceRequest, geofencePendingIntent)
            .addOnSuccessListener {
                Log.d("Geofence", "Registered ${geofenceList.size} geofences")
            }
            .addOnFailureListener { e ->
                Log.e("Geofence", "Failed to register geofences", e)
            }
    }
}

class GeofenceBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        
        if (geofencingEvent?.geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) {
            geofencingEvent.triggeringGeofences?.forEach { geofence ->
                // Report to backend
                APIClient.reportGeofenceEntry(
                    poiId = geofence.requestId,
                    entryTime = System.currentTimeMillis()
                )
            }
        }
    }
}
```

---

### React Native: Expo Geofencing

```typescript
// apps/mobile/services/geofencing.ts

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const GEOFENCE_TASK = 'geofence-background-task';

export const GeofencingService = {
  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  },

  async registerGeofences(geofences: Geofence[]): Promise<void> {
    // Define background task
    TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
      if (error) {
        console.error('Geofence task error:', error);
        return;
      }

      if (data.eventType === Location.GeofencingEventType.Enter) {
        const { region } = data as any;
        this.handleGeofenceEntry(region.identifier);
      }
    });

    // Register geofences
    const regions = geofences.map((g) => ({
      identifier: g.poiId,
      latitude: g.lat,
      longitude: g.lng,
      radius: g.radius,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  },

  async handleGeofenceEntry(poiId: string): Promise<void> {
    // Report to backend
    const response = await fetch('/api/v1/geofences/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: await AsyncStorage.getItem('userId'),
        poiId,
        entryTime: new Date().toISOString(),
      }),
    });

    const data = await response.json();

    // Show local notification
    if (data.notification) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: data.notification.title,
          body: data.notification.body,
          data: { poiId },
        },
        trigger: null, // Immediate
      });
    }
  },
};
```

---

## Notification Templates

### Geofence Entry Notifications

```typescript
// packages/shared/src/templates/notification-templates.ts

export const NotificationTemplates = {
  geofenceEntry: {
    default: {
      title: (poiName: string) => `🎁 You're near ${poiName}!`,
      body: (tokens: number) => `Check-in now and earn ${tokens} tokens!`,
    },
    
    withCampaign: {
      title: (poiName: string) => `🔥 Special offer at ${poiName}!`,
      body: (campaignName: string, tokens: number) => 
        `${campaignName} - Earn ${tokens} tokens! Limited time.`,
    },
    
    firstVisit: {
      title: (poiName: string) => `✨ Discover ${poiName}!`,
      body: (category: string) => `Your first visit to this ${category}. Check-in to earn bonus tokens!`,
    },
    
    streakReminder: {
      title: (poiName: string) => `🔥 Keep your streak going at ${poiName}!`,
      body: (streak: number) => `You're on a ${streak}-day streak. Don't break it!`,
    },
  },

  tokenMilestone: {
    title: (tokens: number) => `🎉 You've earned ${tokens} tokens!`,
    body: (remaining: number) => `Only ${remaining} more tokens until you can redeem a voucher!`,
  },

  voucherExpiring: {
    title: '⏰ Your voucher is expiring soon!',
    body: (days: number) => `Use your ₩5,000 voucher within ${days} days.`,
  },
};
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/shared/tests/unit/geofence.service.test.ts

describe('GeofenceService', () => {
  it('should prioritize nearby POIs', async () => {
    const geofences = await GeofenceService.calculatePriorityGeofences({
      userId: 'user_test',
      currentLocation: { lat: 37.5665, lng: 126.9780 },
      platform: 'ios',
    });

    expect(geofences).toHaveLength(20); // iOS limit
    expect(geofences[0].distance).toBeLessThan(geofences[19].distance);
  });

  it('should respect notification frequency limits', async () => {
    // Create 5 notifications in last 24h
    for (let i = 0; i < 5; i++) {
      await prisma.pushNotification.create({
        data: {
          userId: 'user_test',
          type: 'GEOFENCE_ENTRY',
          title: 'Test',
          body: 'Test',
          sentAt: new Date(),
        },
      });
    }

    const result = await GeofenceService.handleGeofenceEntry({
      userId: 'user_test',
      poiId: 'poi_test',
      entryTime: new Date(),
    });

    expect(result.shouldNotify).toBe(false); // Quota exceeded
  });
});
```

---

## Monitoring & Analytics

### Key Metrics

```typescript
const geofenceMetrics = {
  geofenceTriggersTotal: new Counter({
    name: 'zzik_geofence_triggers_total',
    help: 'Total geofence entry events',
    labelNames: ['poi_id', 'platform'],
  }),

  notificationsSentTotal: new Counter({
    name: 'zzik_geofence_notifications_sent',
    help: 'Geofence notifications sent',
    labelNames: ['type'],
  }),

  notificationOpenRate: new Histogram({
    name: 'zzik_notification_open_rate',
    help: 'Notification open rate',
    buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  }),

  geofenceToCheckInConversion: new Histogram({
    name: 'zzik_geofence_to_checkin_conversion',
    help: 'Conversion from geofence notification to check-in',
    buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  }),
};
```

---

## Success Metrics (30 Days Post-Launch)

```
Geofence Adoption:
├─ % Users with geofences enabled: Target 70%
├─ Avg geofences per user: Target 15
└─ Geofence trigger rate: Target 2-3/day per active user

Notification Performance:
├─ Notification open rate: Target 40%+
├─ Notification → Check-in conversion: Target 60%+
└─ Opt-out rate: Target <10%

DOCV Impact:
├─ Before (manual discovery): 25%
├─ After (geofence + manual): 40% ✅ (+15% absolute)
└─ Geofence-driven check-ins: 45% of total

User Engagement:
├─ DAU increase: +30%
├─ Check-ins per user: +3x
└─ User satisfaction: +25% (NPS)
```

---

## Conclusion

Geofence push notifications solve the passive discovery problem:

**Before**:
- Users must actively open app
- Miss opportunities when near POIs
- DOCV: 25%

**After**:
- Proactive notifications when near saved POIs
- Context-aware timing
- DOCV: 40% (+15% improvement)

**Implementation**: 2 weeks (iOS + Android + backend)

---

**Next Steps**:
1. Implement geofence management API
2. Integrate Firebase Cloud Messaging
3. Build mobile geofencing clients
4. Test with pilot users
5. Launch to all users

