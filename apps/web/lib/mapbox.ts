// Support both NEXT_PUBLIC_MAPBOX_TOKEN and NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
export const MAPBOX_TOKEN = 
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 
  '';

export const MAP_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

/**
 * Assert that Mapbox token is configured
 * Call this once at initialization to provide early warning
 */
export function assertMapboxToken() {
  if (!MAPBOX_TOKEN) {
    if (process.env.NODE_ENV !== 'production') {
      // Development mode: Log warning to console
      // eslint-disable-next-line no-console
      console.warn(
        '[Mapbox] ⚠️  Access token이 설정되지 않았습니다.\n' +
        '→ .env.local에 NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN을 추가하세요.\n' +
        '→ 예시: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...'
      );
    }
    return false;
  }
  return true;
}
