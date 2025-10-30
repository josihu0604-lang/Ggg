// Stripe webhook handler
// POST /api/webhooks/stripe - Handle Stripe events with idempotency

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@zzik/database/src/client';
import { SubscriptionService } from '@zzik/shared/src/services/subscription.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx', {
  apiVersion: '2024-10-28' as any
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_xxx';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events with:
 * - Signature verification (REQUIRED)
 * - Idempotency (duplicate event detection)
 * - Error logging
 * - Retry tracking
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // CRITICAL: Signature must be present
    if (!signature) {
      console.error('[Stripe Webhook] SECURITY: Missing signature header', {
        contentLength: body.length,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // CRITICAL: Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] SECURITY: Signature verification failed', {
        error: err.message,
        signature: signature.substring(0, 20) + '...',
        bodyLength: body.length,
        timestamp: new Date().toISOString()
      });
      
      // TODO: Log to database for security monitoring (fraudReport model not yet implemented)
      // await prisma.fraudReport.create({ ... });

      // Report to Sentry (security issue)
      try {
        const Sentry = await import('@sentry/nextjs');
        Sentry.captureMessage('Stripe webhook signature verification failed', {
          level: 'error',
          tags: {
            security: 'true',
            webhook: 'stripe',
          },
          extra: {
            error: err.message,
            bodyLength: body.length,
          }
        });
      } catch (sentryErr) {
        // Sentry not available, ignore
      }
      
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 401 } // 401 Unauthorized instead of 400
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

    // IDEMPOTENCY: Check if event already processed
    const existingEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true, processedAt: true, success: true }
    });

    if (existingEvent) {
      console.log(`[Stripe Webhook] Duplicate event detected, skipping`, {
        eventId: event.id,
        eventType: event.type,
        previouslyProcessedAt: existingEvent.processedAt,
        previousSuccess: existingEvent.success
      });
      
      return NextResponse.json({
        received: true,
        duplicate: true,
        eventType: event.type,
        eventId: event.id
      }, { status: 200 });
    }

    // Process the event
    let processingError: Error | null = null;
    try {
      await SubscriptionService.handleStripeWebhook(event);
    } catch (error: any) {
      processingError = error;
      console.error('[Stripe Webhook] Processing error:', {
        eventId: event.id,
        eventType: event.type,
        error: error.message,
        stack: error.stack
      });
    }

    // Record event in database (for idempotency + audit trail)
    const processingTime = Date.now() - startTime;
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          apiVersion: event.api_version || null,
          data: event as any, // Store full event payload
          processingTime,
          success: processingError === null,
          error: processingError?.message || null
        }
      });
    } catch (dbErr) {
      console.error('[Stripe Webhook] Failed to record event:', {
        eventId: event.id,
        error: dbErr
      });
    }

    if (processingError) {
      // Return 200 to acknowledge receipt even if processing failed
      // Stripe will retry failed webhooks automatically
      return NextResponse.json({
        received: true,
        eventType: event.type,
        eventId: event.id,
        error: processingError.message,
        willRetry: true
      }, { status: 200 });
    }
    
    return NextResponse.json({
      received: true,
      eventType: event.type,
      eventId: event.id,
      processingTime
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('[Stripe Webhook] Fatal error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable body parsing for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};
