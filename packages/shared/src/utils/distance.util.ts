export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
