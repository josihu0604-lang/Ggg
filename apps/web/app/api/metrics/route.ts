import { NextResponse } from 'next/server';
import { register } from 'prom-client';

// Import all metrics to ensure they're registered
import '../../../lib/metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return new NextResponse(await register.metrics(), {
    headers: { 'Content-Type': register.contentType },
  });
}
