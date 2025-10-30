// QR Code service for backup check-in method
// Generates and validates QR codes for POIs

import { prisma } from '@zzik/database/src/client';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

const QR_SECRET = process.env.QR_CODE_SECRET || 'zzik-qr-secret-change-in-production';
const QR_EXPIRY = 365 * 24 * 60 * 60; // 1 year in seconds
const QR_VERSION = 1;

export const QRCodeService = {
  /**
   * Generate QR code for POI
   */
  async generateQRCode(params: {
    poiId: string;
    merchantId: string;
  }): Promise<{
    qrCode: any;
    token: string;
    qrCodeUrl: string;
    qrCodeImage: string;
  }> {
    // Check if QR code already exists
    const existing = await prisma.qRCode.findUnique({
      where: { poiId: params.poiId }
    });

    if (existing && existing.status === 'ACTIVE' && existing.expiresAt > new Date()) {
      // Return existing QR code
      return {
        qrCode: existing,
        token: existing.token,
        qrCodeUrl: existing.qrCodeUrl,
        qrCodeImage: existing.qrCodeImage
      };
    }

    // Generate JWT token
    const payload = {
      v: QR_VERSION,
      type: 'checkin',
      poiId: params.poiId,
      merchantId: params.merchantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + QR_EXPIRY
    };

    const token = jwt.sign(payload, QR_SECRET, { algorithm: 'HS256' });

    // Generate QR code URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zzik.app';
    const qrCodeUrl = `${baseUrl}/qr/${token}`;

    // Generate QR code image (Base64 data URL)
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
      errorCorrectionLevel: 'H', // High error correction for reliability
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Create or update QR code record
    const qrCode = await prisma.qRCode.upsert({
      where: { poiId: params.poiId },
      create: {
        poiId: params.poiId,
        merchantId: params.merchantId,
        token,
        qrCodeUrl,
        qrCodeImage,
        version: QR_VERSION,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + QR_EXPIRY * 1000)
      },
      update: {
        token,
        qrCodeUrl,
        qrCodeImage,
        version: QR_VERSION,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + QR_EXPIRY * 1000),
        scansTotal: 0,
        scansToday: 0
      }
    });

    return {
      qrCode,
      token,
      qrCodeUrl,
      qrCodeImage
    };
  },

  /**
   * Validate QR code token (with single-use enforcement)
   */
  async validateQRCode(token: string, userId?: string): Promise<{
    valid: boolean;
    payload?: any;
    error?: string;
  }> {
    try {
      // Verify JWT token
      const payload = jwt.verify(token, QR_SECRET, {
        algorithms: ['HS256']
      }) as any;

      // Check version
      if (payload.v !== QR_VERSION) {
        return {
          valid: false,
          error: 'QR code version mismatch. Please request a new QR code.'
        };
      }

      // Check type
      if (payload.type !== 'checkin') {
        return {
          valid: false,
          error: 'Invalid QR code type'
        };
      }

      // Check if QR code exists in database
      const qrCode = await prisma.qRCode.findUnique({
        where: { token },
        select: {
          id: true,
          poiId: true,
          merchantId: true,
          status: true,
          expiresAt: true,
          used: true,
          usedAt: true,
          usedByUserId: true
        }
      });

      if (!qrCode) {
        return {
          valid: false,
          error: 'QR code not found in database'
        };
      }

      // CRITICAL: Check if already used (single-use enforcement)
      if (qrCode.used) {
        console.warn('[QR Code] SECURITY: Attempted reuse detected', {
          token: token.substring(0, 20) + '...',
          previousUser: qrCode.usedByUserId,
          usedAt: qrCode.usedAt,
          attemptedBy: userId,
          timestamp: new Date().toISOString()
        });

        // TODO: Log potential replay attack to fraud report (fraud model not implemented)
        
        return {
          valid: false,
          error: 'QR code already used. Each QR code can only be used once.'
        };
      }

      // Check status
      if (qrCode.status !== 'ACTIVE') {
        return {
          valid: false,
          error: `QR code is ${qrCode.status.toLowerCase()}`
        };
      }

      // Check expiry
      if (new Date() > qrCode.expiresAt) {
        // Auto-expire
        await prisma.qRCode.update({
          where: { token },
          data: { status: 'EXPIRED' }
        });

        return {
          valid: false,
          error: 'QR code expired. Please request a new one.'
        };
      }

      return {
        valid: true,
        payload: {
          poiId: payload.poiId,
          merchantId: payload.merchantId,
          token
        }
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'QR code expired'
        };
      } else if (error.name === 'JsonWebTokenError') {
        return {
          valid: false,
          error: 'Invalid QR code'
        };
      }

      console.error('QR code validation error:', error);
      return {
        valid: false,
        error: 'QR code validation failed'
      };
    }
  },

  /**
   * Mark QR code as used (called after successful check-in)
   */
  async markQRCodeUsed(token: string, userId: string): Promise<void> {
    await prisma.qRCode.update({
      where: { token },
      data: {
        used: true,
        usedAt: new Date(),
        usedByUserId: userId,
        scansTotal: { increment: 1 },
        scansToday: { increment: 1 },
        lastScannedAt: new Date()
      }
    });

    console.log('[QR Code] Marked as used', {
      token: token.substring(0, 20) + '...',
      userId,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Get QR code for POI
   */
  async getQRCode(poiId: string): Promise<any> {
    return await prisma.qRCode.findUnique({
      where: { poiId },
      select: {
        id: true,
        token: true,
        qrCodeUrl: true,
        qrCodeImage: true,
        status: true,
        scansTotal: true,
        scansToday: true,
        lastScannedAt: true,
        expiresAt: true,
        createdAt: true
      }
    });
  },

  /**
   * Revoke QR code (security breach, lost device, etc.)
   */
  async revokeQRCode(poiId: string): Promise<void> {
    await prisma.qRCode.update({
      where: { poiId },
      data: { status: 'REVOKED' }
    });
  },

  /**
   * Get QR code statistics (for merchant dashboard)
   */
  async getQRCodeStats(merchantId: string): Promise<any> {
    const qrCodes = await prisma.qRCode.findMany({
      where: { merchantId },
      select: {
        id: true,
        poiId: true,
        scansTotal: true,
        scansToday: true,
        lastScannedAt: true,
        status: true,
        poi: {
          select: {
            name: true,
            category: true
          }
        }
      }
    });

    const totalScans = qrCodes.reduce((sum, qr) => sum + qr.scansTotal, 0);
    const activeQRCodes = qrCodes.filter(qr => qr.status === 'ACTIVE').length;

    return {
      qrCodes: qrCodes.map(qr => ({
        poiId: qr.poiId,
        poiName: qr.poi.name,
        scansTotal: qr.scansTotal,
        scansToday: qr.scansToday,
        lastScannedAt: qr.lastScannedAt,
        status: qr.status
      })),
      summary: {
        totalQRCodes: qrCodes.length,
        activeQRCodes,
        totalScans,
        avgScansPerQR: qrCodes.length > 0 ? Math.round(totalScans / qrCodes.length) : 0
      }
    };
  },

  /**
   * Reset daily scan counters (cron job - run daily at midnight)
   */
  async resetDailyScanCounters(): Promise<void> {
    await prisma.qRCode.updateMany({
      where: {},
      data: { scansToday: 0 }
    });
  }
};
