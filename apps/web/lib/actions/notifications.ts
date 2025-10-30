'use server';

export interface Notification {
  id: string;
  type: 'check-in' | 'token' | 'offer' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  icon: string;
}

/**
 * Get user notifications
 * Mock data for now
 */
export async function getNotifications(limit = 20): Promise<Notification[]> {
  // Mock notifications
  const now = new Date();
  
  return [
    {
      id: '1',
      type: 'check-in',
      title: '체크인 완료',
      message: '스타벅스 강남역점에서 100 토큰을 획득했어요!',
      timestamp: new Date(now.getTime() - 3600000),
      read: false,
      icon: '📍',
    },
    {
      id: '2',
      type: 'offer',
      title: '새로운 오퍼',
      message: '근처에 보너스 토큰 +50 오퍼가 있어요',
      timestamp: new Date(now.getTime() - 7200000),
      read: false,
      icon: '🎁',
    },
    {
      id: '3',
      type: 'token',
      title: '토큰 획득',
      message: '7일 연속 체크인 보너스 200 토큰!',
      timestamp: new Date(now.getTime() - 86400000),
      read: true,
      icon: '✨',
    },
  ];
}
