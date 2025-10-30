# QR Code Backup Check-in - Technical Design Document

**Version**: 1.0  
**Date**: 2025-10-28  
**Status**: 🟡 HIGH PRIORITY - MVP Feature (RICE: 23,750)  
**Timeline**: 1 week implementation

---

## Problem Statement

### GPS-Based Check-in Limitations

**Current System**: 100% dependent on GPS validation
- **Issue 1**: Urban canyons (tall buildings) cause GPS inaccuracy (>100m)
- **Issue 2**: Indoor locations (malls, underground) have no GPS signal
- **Issue 3**: User frustration when legitimate check-in fails

**Real-World Scenarios**:
```
Scenario A: Coffee Shop in Gangnam
├─ Location: 5th floor of high-rise building
├─ GPS Accuracy: 150m (too low)
├─ Result: Check-in rejected ❌
└─ User Experience: Frustrated, abandons app

Scenario B: Restaurant in Shopping Mall
├─ Location: Underground B2 level
├─ GPS Signal: None
├─ Result: Cannot check-in at all ❌
└─ User Experience: Switches to competitor app

Scenario C: Outdoor Café (Ideal)
├─ GPS Accuracy: 8m
├─ Result: Check-in successful ✅
└─ User Experience: Happy
```

**Impact**:
- 30-40% of indoor POIs have GPS issues
- 15% check-in failure rate due to GPS
- Direct impact on DOCV (Deal-to-Check-in Conversion)

---

## Solution Overview

### QR Code as Backup Check-in Method

**Fallback Strategy**:
1. **Primary**: GPS-based check-in (existing flow)
2. **Fallback**: QR code scan if GPS fails

**User Flow**:
```
User at POI location
  ↓
Try GPS check-in
  ↓
GPS Failed? (accuracy >50m or no signal)
  ↓
Show "Scan QR Code" option
  ↓
User scans merchant's QR code
  ↓
Validate QR code + basic fraud checks
  ↓
Check-in successful ✅
```

**Merchant Side**:
```
Merchant Dashboard
  ↓
Generate unique QR code for POI
  ↓
Print QR code poster (A4 size)
  ↓
Display at entrance/counter
  ↓
Users scan to check-in
```

---

## QR Code Design

### QR Code Content Structure

**Format**: JWT-based signed payload
```json
{
  "v": 1,                          // Version
  "type": "checkin",               // Type: checkin
  "poiId": "poi_abc123",           // POI identifier
  "merchantId": "merchant_xyz",    // Merchant identifier
  "iat": 1730102400,               // Issued at (Unix timestamp)
  "exp": 1767638400,               // Expires at (1 year validity)
  "sig": "sha256_signature"        // HMAC-SHA256 signature
}
```

**Encoded QR Code**:
```
https://zzik.app/qr/eyJ2IjoxLCJ0eXBlIjoiY2hlY2tpbiIsInBvaUlkIjoicG9pX2FiYzEyMyIsIm1lcmNoYW50SWQiOiJtZXJjaGFudF94eXoiLCJpYXQiOjE3MzAxMDI0MDAsImV4cCI6MTc2NzYzODQwMCwic2lnIjoic2hhMjU2X3NpZ25hdHVyZSJ9
```

**Security Features**:
- ✅ JWT signature prevents tampering
- ✅ Expiry date prevents old QR codes
- ✅ POI-specific (cannot reuse for different locations)
- ✅ Merchant verification (ensures authorized QR codes)

---

### QR Code Generation Service

```typescript
// packages/shared/src/services/qrcode.service.ts

import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

const QR_SECRET = process.env.QR_CODE_SECRET!; // Keep secret!
const QR_EXPIRY = 365 * 24 * 60 * 60; // 1 year

export interface QRCodePayload {
  v: number;
  type: 'checkin';
  poiId: string;
  merchantId: string;
  iat: number;
  exp: number;
}

export const QRCodeService = {
  /**
   * Generate QR code for POI
   * Returns both token and QR code image (base64)
   */
  async generateQRCode(params: {
    poiId: string;
    merchantId: string;
  }): Promise<{
    token: string;
    qrCodeUrl: string; // https://zzik.app/qr/{token}
    qrCodeImage: string; // base64 PNG
    expiresAt: Date;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const payload: QRCodePayload = {
      v: 1,
      type: 'checkin',
      poiId: params.poiId,
      merchantId: params.merchantId,
      iat: now,
      exp: now + QR_EXPIRY,
    };

    // Sign with HMAC-SHA256
    const token = jwt.sign(payload, QR_SECRET, {
      algorithm: 'HS256',
      noTimestamp: true, // We include iat manually
    });

    // Generate QR code URL
    const qrCodeUrl = `https://zzik.app/qr/${token}`;

    // Generate QR code image (PNG, 512x512)
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
      errorCorrectionLevel: 'H', // High error correction
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return {
      token,
      qrCodeUrl,
      qrCodeImage, // data:image/png;base64,...
      expiresAt: new Date((now + QR_EXPIRY) * 1000),
    };
  },

  /**
   * Verify QR code token
   * Returns decoded payload if valid
   */
  async verifyQRCode(token: string): Promise<{
    valid: boolean;
    payload?: QRCodePayload;
    reason?: string;
  }> {
    try {
      const payload = jwt.verify(token, QR_SECRET, {
        algorithms: ['HS256'],
      }) as QRCodePayload;

      // Additional validation
      if (payload.v !== 1) {
        return { valid: false, reason: 'invalid_version' };
      }

      if (payload.type !== 'checkin') {
        return { valid: false, reason: 'invalid_type' };
      }

      // Check expiry (JWT already checks this, but double-check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return { valid: false, reason: 'expired' };
      }

      return { valid: true, payload };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, reason: 'expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, reason: 'invalid_signature' };
      }
      return { valid: false, reason: 'unknown_error' };
    }
  },

  /**
   * Generate printable QR code poster (A4 PDF)
   * Includes branding, instructions, and QR code
   */
  async generatePrintablePoster(params: {
    poiId: string;
    poiName: string;
    merchantName: string;
    qrCodeImage: string; // base64
  }): Promise<Buffer> {
    // Use puppeteer or similar to generate PDF
    // For now, return placeholder
    // TODO: Implement PDF generation with branding
    return Buffer.from('PDF content here');
  },
};
```

---

## Database Schema Changes

### Add QR Code Table

```prisma
// packages/database/prisma/schema.prisma

model QRCode {
  id          String   @id @default(cuid())
  poi         POI      @relation(fields: [poiId], references: [id], onDelete: Cascade)
  poiId       String   @unique // One QR code per POI
  merchant    Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  merchantId  String
  
  // QR code data
  token       String   @unique // JWT token
  qrCodeUrl   String   // https://zzik.app/qr/{token}
  qrCodeImage String   @db.Text // base64 PNG (large)
  
  // Metadata
  version     Int      @default(1)
  status      QRCodeStatus @default(ACTIVE)
  
  // Usage tracking
  scansTotal  Int      @default(0)
  scansToday  Int      @default(0)
  lastScannedAt DateTime?
  
  // Validity
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  
  checkIns    ValidatedCheckIn[]
  
  @@index([poiId, status])
  @@index([token])
}

enum QRCodeStatus {
  ACTIVE
  EXPIRED
  REVOKED // Merchant can revoke QR code
}

model ValidatedCheckIn {
  // ... existing fields ...
  
  // Add QR code reference
  qrCode      QRCode?  @relation(fields: [qrCodeId], references: [id])
  qrCodeId    String?
  
  // Check-in method
  method      CheckInMethod @default(GPS)
}

enum CheckInMethod {
  GPS       // GPS-based check-in
  QR_CODE   // QR code scan
  HYBRID    // Both GPS + QR (future: highest confidence)
}
```

---

## API Design

### Generate QR Code (Merchant Dashboard)

#### POST /api/v1/merchant/qrcode/generate

**Purpose**: Generate new QR code for POI

**Request**:
```typescript
{
  poiId: 'poi_abc123',
  regenerate?: boolean // Force regenerate if already exists
}
```

**Response**:
```typescript
{
  qrCode: {
    id: 'qr_xyz789',
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
    qrCodeUrl: 'https://zzik.app/qr/eyJ0eXAi...',
    qrCodeImage: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
    expiresAt: '2026-10-28T00:00:00Z',
    status: 'ACTIVE'
  },
  downloadLinks: {
    png: '/api/v1/merchant/qrcode/download/png/qr_xyz789',
    pdf: '/api/v1/merchant/qrcode/download/pdf/qr_xyz789',
    svg: '/api/v1/merchant/qrcode/download/svg/qr_xyz789'
  }
}
```

**Business Logic**:
1. Verify merchant owns the POI
2. Check if QR code already exists
3. If exists and not expired, return existing
4. If regenerate=true or expired, create new
5. Generate JWT token
6. Generate QR code image
7. Save to database
8. Return QR code data + download links

---

### Check-in via QR Code (User App)

#### POST /api/v1/checkin/qr

**Purpose**: Check-in using QR code scan

**Request**:
```typescript
{
  token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  location?: {
    lat: 37.5665,
    lng: 126.9780,
    accuracy: 150 // Optional: include if GPS available
  },
  deviceInfo?: {
    platform: 'ios',
    model: 'iPhone 14 Pro',
    osVersion: '17.0'
  }
}
```

**Response**:
```typescript
{
  valid: true,
  checkinId: 'checkin_abc123',
  method: 'QR_CODE',
  tokensEarned: 100,
  poi: {
    id: 'poi_abc123',
    name: 'Café Mocha',
    address: '...'
  },
  message: 'Check-in successful! You earned 100 tokens.',
  warnings?: [
    {
      type: 'GPS_UNAVAILABLE',
      message: 'GPS not available. Check-in via QR code only.'
    }
  ]
}
```

**Business Logic**:
1. Verify QR code token (signature + expiry)
2. Check QR code status (ACTIVE)
3. Validate user subscription (tier limits)
4. Check duplicate check-in (same POI within 1 hour)
5. Optional: Soft GPS validation (if location provided)
   - If GPS available but >200m away, flag as suspicious
6. Create ValidatedCheckIn with method=QR_CODE
7. Award tokens (if PREMIUM user)
8. Update QR code scan statistics
9. Return success response

---

### QR Code Fraud Detection

```typescript
// packages/shared/src/services/qrcode-fraud.service.ts

export const QRCodeFraudService = {
  /**
   * Detect suspicious QR code usage patterns
   */
  async detectQRFraud(params: {
    userId: string;
    qrCodeId: string;
    location?: { lat: number; lng: number };
  }): Promise<{
    suspicious: boolean;
    flags: QRFraudFlag[];
    score: number;
  }> {
    const flags: QRFraudFlag[] = [];

    // Flag 1: Rapid scans (same user, same QR code)
    const recentScans = await prisma.validatedCheckIn.count({
      where: {
        userId: params.userId,
        qrCodeId: params.qrCodeId,
        checkedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentScans > 0) {
      flags.push({
        type: 'DUPLICATE_SCAN',
        severity: 'HIGH',
        message: `User already scanned this QR code ${recentScans} time(s) in the last hour`,
        value: recentScans,
      });
    }

    // Flag 2: GPS mismatch (if location provided)
    if (params.location) {
      const qrCode = await prisma.qRCode.findUnique({
        where: { id: params.qrCodeId },
        include: { poi: { select: { lat: true, lng: true } } },
      });

      if (qrCode) {
        const distance = haversineDistance(params.location, {
          lat: qrCode.poi.lat,
          lng: qrCode.poi.lng,
        });

        if (distance > 500) {
          // >500m away
          flags.push({
            type: 'GPS_MISMATCH',
            severity: 'CRITICAL',
            message: `User is ${Math.round(distance)}m away from POI location`,
            value: distance,
            threshold: 500,
          });
        }
      }
    }

    // Flag 3: Unusual scan volume (QR code shared on social media)
    const qrCodeScans = await prisma.validatedCheckIn.count({
      where: {
        qrCodeId: params.qrCodeId,
        checkedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
      },
    });

    if (qrCodeScans > 100) {
      // >100 scans/day is suspicious
      flags.push({
        type: 'HIGH_VOLUME',
        severity: 'MEDIUM',
        message: `QR code scanned ${qrCodeScans} times in 24h (possible leak)`,
        value: qrCodeScans,
        threshold: 100,
      });
    }

    const score = flags.reduce((sum, f) => {
      return sum + (f.severity === 'CRITICAL' ? 1 : f.severity === 'HIGH' ? 0.6 : 0.3);
    }, 0) / Math.max(flags.length, 1);

    return {
      suspicious: flags.some((f) => f.severity === 'CRITICAL') || score > 0.5,
      flags,
      score: Math.min(score, 1),
    };
  },

  /**
   * Revoke compromised QR code
   */
  async revokeQRCode(qrCodeId: string, reason: string): Promise<void> {
    await prisma.qRCode.update({
      where: { id: qrCodeId },
      data: {
        status: 'REVOKED',
        // Log reason in audit table (implement separately)
      },
    });

    // Notify merchant to regenerate QR code
    // TODO: Send email/push notification
  },
};

interface QRFraudFlag {
  type: 'DUPLICATE_SCAN' | 'GPS_MISMATCH' | 'HIGH_VOLUME';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  value: number;
  threshold?: number;
}
```

---

## Frontend Implementation

### User App: QR Scanner Component

```typescript
// apps/web/components/checkin/QRScanner.tsx

'use client';

import { useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QRScanner({ onScanSuccess }: { onScanSuccess: (token: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScanning = async () => {
    setScanning(true);
    setError(null);

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Extract token from URL
          const url = new URL(decodedText);
          const token = url.pathname.split('/').pop();

          if (token) {
            html5QrCode.stop();
            onScanSuccess(token);
          }
        },
        (errorMessage) => {
          // Ignore scan errors (happens frequently)
        }
      );
    } catch (err) {
      setError('Failed to access camera. Please grant camera permission.');
      setScanning(false);
    }
  };

  return (
    <div className="qr-scanner">
      {!scanning ? (
        <button onClick={startScanning} className="btn-primary">
          Scan QR Code
        </button>
      ) : (
        <>
          <div id="qr-reader" style={{ width: '100%' }} />
          <p className="text-center mt-4">Point camera at QR code</p>
        </>
      )}

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
```

### User Flow: GPS Failed → QR Fallback

```typescript
// apps/web/app/checkin/[poiId]/page.tsx

'use client';

export default function CheckInPage({ params }: { params: { poiId: string } }) {
  const [checkInMethod, setCheckInMethod] = useState<'gps' | 'qr'>('gps');
  const [gpsError, setGpsError] = useState<string | null>(null);

  const attemptGPSCheckIn = async () => {
    try {
      const location = await getCurrentPosition();
      const response = await fetch('/api/v1/checkin', {
        method: 'POST',
        body: JSON.stringify({ poiId: params.poiId, location }),
      });

      const data = await response.json();

      if (!data.valid && data.reason === 'too_far') {
        setGpsError('GPS accuracy too low. Try QR code instead.');
        setCheckInMethod('qr'); // Auto-switch to QR
      } else if (data.valid) {
        // Success!
        router.push(`/checkin/success/${data.checkinId}`);
      }
    } catch (error) {
      setGpsError('GPS not available');
      setCheckInMethod('qr');
    }
  };

  const handleQRScan = async (token: string) => {
    const response = await fetch('/api/v1/checkin/qr', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    const data = await response.json();
    if (data.valid) {
      router.push(`/checkin/success/${data.checkinId}`);
    }
  };

  return (
    <div>
      {checkInMethod === 'gps' ? (
        <>
          <button onClick={attemptGPSCheckIn}>Check In with GPS</button>
          {gpsError && (
            <div className="alert alert-warning">
              <p>{gpsError}</p>
              <button onClick={() => setCheckInMethod('qr')}>Use QR Code Instead</button>
            </div>
          )}
        </>
      ) : (
        <QRScanner onScanSuccess={handleQRScan} />
      )}
    </div>
  );
}
```

---

### Merchant Dashboard: QR Code Management

```typescript
// apps/web/app/merchant/dashboard/qrcodes/page.tsx

export default function QRCodeManagementPage() {
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);

  const generateQRCode = async (poiId: string) => {
    const response = await fetch('/api/v1/merchant/qrcode/generate', {
      method: 'POST',
      body: JSON.stringify({ poiId }),
    });

    const data = await response.json();
    setQRCodes([...qrCodes, data.qrCode]);
  };

  const downloadQRCode = (qrCodeId: string, format: 'png' | 'pdf') => {
    window.open(`/api/v1/merchant/qrcode/download/${format}/${qrCodeId}`, '_blank');
  };

  return (
    <div className="qr-code-management">
      <h1>QR Code Management</h1>

      {qrCodes.map((qr) => (
        <div key={qr.id} className="qr-card">
          <img src={qr.qrCodeImage} alt="QR Code" width={200} />
          <div>
            <h3>{qr.poi.name}</h3>
            <p>Scans Today: {qr.scansToday}</p>
            <p>Total Scans: {qr.scansTotal}</p>
            <p>Expires: {new Date(qr.expiresAt).toLocaleDateString()}</p>

            <div className="actions">
              <button onClick={() => downloadQRCode(qr.id, 'png')}>Download PNG</button>
              <button onClick={() => downloadQRCode(qr.id, 'pdf')}>Download PDF</button>
              <button onClick={() => regenerateQRCode(qr.id)}>Regenerate</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Printable QR Code Poster Design

### A4 Poster Template

```
┌─────────────────────────────────────────┐
│                                         │
│           🎯 ZZIK Check-in              │
│                                         │
│      Scan to Earn Rewards!              │
│                                         │
│         ┌───────────────┐               │
│         │               │               │
│         │   [QR CODE]   │               │
│         │               │               │
│         │               │               │
│         └───────────────┘               │
│                                         │
│   How to Check-in:                      │
│   1. Open ZZIK app                      │
│   2. Tap "Scan QR Code"                 │
│   3. Point camera at QR code            │
│   4. Earn 100 tokens instantly!         │
│                                         │
│   📍 Café Mocha - Gangnam Branch        │
│   🎁 Earn ₩5,000 voucher (5,000 tokens) │
│                                         │
│   ────────────────────────────          │
│   Powered by ZZIK                       │
│   zzik.app                              │
└─────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/shared/tests/unit/qrcode.service.test.ts

describe('QRCodeService', () => {
  it('should generate valid QR code', async () => {
    const result = await QRCodeService.generateQRCode({
      poiId: 'poi_test123',
      merchantId: 'merchant_test456',
    });

    expect(result.token).toBeDefined();
    expect(result.qrCodeUrl).toContain('https://zzik.app/qr/');
    expect(result.qrCodeImage).toContain('data:image/png;base64,');
  });

  it('should verify valid QR code', async () => {
    const generated = await QRCodeService.generateQRCode({
      poiId: 'poi_test123',
      merchantId: 'merchant_test456',
    });

    const verified = await QRCodeService.verifyQRCode(generated.token);

    expect(verified.valid).toBe(true);
    expect(verified.payload?.poiId).toBe('poi_test123');
  });

  it('should reject expired QR code', async () => {
    // Create QR code with past expiry
    const expiredToken = jwt.sign(
      {
        v: 1,
        type: 'checkin',
        poiId: 'poi_test',
        merchantId: 'merchant_test',
        iat: 1000000000,
        exp: 1000000001, // Already expired
      },
      QR_SECRET
    );

    const verified = await QRCodeService.verifyQRCode(expiredToken);

    expect(verified.valid).toBe(false);
    expect(verified.reason).toBe('expired');
  });
});
```

### E2E Tests

```typescript
// tests/e2e/qr-checkin.spec.ts

import { test, expect } from '@playwright/test';

test('QR code check-in flow', async ({ page }) => {
  // 1. Merchant generates QR code
  await page.goto('/merchant/dashboard/qrcodes');
  await page.click('button:has-text("Generate QR Code")');
  await page.selectOption('select[name="poiId"]', 'poi_test123');
  await page.click('button:has-text("Generate")');

  // Wait for QR code to appear
  await expect(page.locator('img[alt="QR Code"]')).toBeVisible();

  // 2. Extract QR code URL
  const qrCodeUrl = await page.locator('.qr-code-url').textContent();

  // 3. User scans QR code (simulate)
  await page.goto('/checkin');
  await page.click('button:has-text("Scan QR Code")');

  // Simulate QR scan (in real test, use camera mock)
  await page.evaluate((url) => {
    window.handleQRScan(url);
  }, qrCodeUrl);

  // 4. Check-in successful
  await expect(page.locator('text=Check-in successful')).toBeVisible();
  await expect(page.locator('text=You earned 100 tokens')).toBeVisible();
});

test('GPS fallback to QR code', async ({ page, context }) => {
  // Mock GPS to return poor accuracy
  await context.setGeolocation({ latitude: 37.5665, longitude: 126.9780, accuracy: 200 });

  await page.goto('/checkin/poi_test123');
  await page.click('button:has-text("Check In with GPS")');

  // Should show GPS error
  await expect(page.locator('text=GPS accuracy too low')).toBeVisible();

  // Should auto-show QR scanner option
  await expect(page.locator('button:has-text("Use QR Code Instead")')).toBeVisible();
});
```

---

## Security Considerations

### Threat Model

**Threat 1: QR Code Screenshot Sharing**
- **Attack**: User screenshots QR code and shares online
- **Mitigation**: 
  - Monitor scan volume (>100/day = suspicious)
  - Track unique devices per QR code
  - Automatic revocation if abuse detected

**Threat 2: Fake QR Codes**
- **Attack**: Attacker creates fake QR code for wrong POI
- **Mitigation**:
  - JWT signature verification (cannot forge)
  - POI-specific tokens (cannot reuse)

**Threat 3: QR Code Printed and Moved**
- **Attack**: User prints QR code and brings it home
- **Mitigation**:
  - Optional GPS soft-check (flag if >500m away)
  - Merchant can monitor suspicious patterns
  - Rate limiting (1 scan per user per hour)

---

## Metrics & Monitoring

### Key Metrics

```typescript
const qrCodeMetrics = {
  // Usage metrics
  qrScansTotal: new Counter({
    name: 'zzik_qr_scans_total',
    help: 'Total QR code scans',
    labelNames: ['poi_id', 'merchant_id'],
  }),

  qrScanSuccess: new Counter({
    name: 'zzik_qr_scan_success_total',
    help: 'Successful QR code check-ins',
  }),

  qrScanFailed: new Counter({
    name: 'zzik_qr_scan_failed_total',
    help: 'Failed QR code scans',
    labelNames: ['reason'], // expired, revoked, fraud
  }),

  // GPS fallback rate
  gpsToQrFallback: new Counter({
    name: 'zzik_gps_to_qr_fallback_total',
    help: 'GPS failed, fallback to QR',
  }),

  // Fraud detection
  qrFraudDetected: new Counter({
    name: 'zzik_qr_fraud_detected_total',
    help: 'QR code fraud detected',
    labelNames: ['flag_type'],
  }),
};
```

---

## Rollout Plan

### Week 1: Development
- Day 1-2: QR code generation service + API
- Day 3-4: QR scanner frontend component
- Day 5: Merchant dashboard integration
- Day 6-7: Testing + bug fixes

### Week 2: Pilot
- Enable for 10 indoor POIs (malls, high-rises)
- Measure GPS→QR fallback rate
- Collect user feedback
- Monitor fraud patterns

### Week 3: Full Launch
- Enable for all POIs
- Generate QR codes for all merchants
- Send printable posters to merchants
- Monitor adoption rate

---

## Success Metrics

### Target KPIs (30 Days Post-Launch)

```
GPS Failure Rate:
├─ Before: 15% check-ins fail due to GPS
└─ After: <5% check-ins fail (QR fallback) ✅

Check-in Success Rate:
├─ Before: 85%
└─ After: 95% ✅

QR Code Usage:
├─ % of check-ins via QR: 20-30% (indoor locations)
└─ GPS→QR fallback: 10% of all check-ins

Fraud Rate (QR):
├─ Duplicate scans: <2%
├─ GPS mismatch flags: <5%
└─ Overall QR fraud: <3% (acceptable)

DOCV Impact:
├─ Before: 25% (with GPS failures)
└─ After: 35% (+10% due to QR fallback) ✅
```

---

## Conclusion

QR Code backup check-in solves the critical GPS reliability issue:

**Before**:
- 15% check-in failure rate (GPS issues)
- Indoor locations unusable
- User frustration

**After**:
- <5% check-in failure rate
- Universal coverage (indoor + outdoor)
- Improved user experience
- +10% DOCV improvement

**Implementation**: 1 week (highest RICE score: 23,750)

---

**Next Steps**:
1. Review design document
2. Implement QR generation service
3. Build QR scanner component
4. Test with pilot POIs
5. Launch to all merchants

