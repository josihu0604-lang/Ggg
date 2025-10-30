import { test, expect } from '@playwright/test';

test.describe('Check-in API', () => {
  test('happy path - successful check-in', async ({ request }) => {
    const r = await request.post('/api/v1/checkin', {
      headers: { 'x-user-id': 'u1', 'Idempotency-Key': 'test-key-1' },
      data: {
        poiId: 'p1',
        location: { lat: 37.5447, lng: 127.0557, accuracy: 8 },
      },
    });

    expect(r.status()).toBe(201);
    const j = await r.json();
    expect(j.success).toBeTruthy();
    expect(j.check_in_id).toBeDefined();
  });

  test('idempotent requests return same result', async ({ request }) => {
    const idempotencyKey = `test-key-${Date.now()}`;

    const first = await request.post('/api/v1/checkin', {
      headers: { 'x-user-id': 'u1', 'Idempotency-Key': idempotencyKey },
      data: {
        poiId: 'p1',
        location: { lat: 37.5447, lng: 127.0557, accuracy: 8 },
      },
    });

    const second = await request.post('/api/v1/checkin', {
      headers: { 'x-user-id': 'u1', 'Idempotency-Key': idempotencyKey },
      data: {
        poiId: 'p1',
        location: { lat: 37.5447, lng: 127.0557, accuracy: 8 },
      },
    });

    const firstJson = await first.json();
    const secondJson = await second.json();

    expect(firstJson.check_in_id).toBe(secondJson.check_in_id);
  });

  test('invalid location rejected', async ({ request }) => {
    const r = await request.post('/api/v1/checkin', {
      headers: { 'x-user-id': 'u1' },
      data: {
        poiId: 'p1',
        location: { lat: 999, lng: 127.0557, accuracy: 8 }, // Invalid lat
      },
    });

    expect([400, 422]).toContain(r.status());
  });
});

test.describe('POI API', () => {
  test('returns nearby POIs', async ({ request }) => {
    const r = await request.get('/api/v1/pois?lat=37.5447&lng=127.0557&radius=2000');

    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.type).toBe('FeatureCollection');
    expect(Array.isArray(j.features)).toBeTruthy();
  });

  test('validates query parameters', async ({ request }) => {
    const r = await request.get('/api/v1/pois?lat=invalid&lng=127.0557');

    expect(r.status()).toBe(400);
  });
});
