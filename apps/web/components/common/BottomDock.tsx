'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/feed', label: '홈', icon: '🏠' },
  { href: '/map', label: '지도', icon: '🗺️' },
  { href: '/wallet', label: '지갑', icon: '💰' },
  { href: '/profile', label: '프로필', icon: '👤' },
];

export default function BottomDock() {
  const path = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="메인 내비게이션"
      className="fixed inset-x-0 bottom-0 z-50 pb-safe"
    >
      <div className="mx-auto max-w-screen-sm px-3">
        <div className="dock rounded-t-2xl px-4 py-2 animate-liquid-appear">
          <ul className="flex items-center justify-between gap-2">
            {items.map((it) => {
              const active = path === it.href || path.startsWith(it.href + '/');
              return (
                <li key={it.href} className="flex-1">
                  <Link
                    href={it.href}
                    className="icon-btn w-full flex flex-col items-center justify-center gap-1 h-auto py-2"
                    aria-current={active ? 'page' : undefined}
                    data-active={active}
                  >
                    <span aria-hidden="true" className="text-xl leading-none">
                      {it.icon}
                    </span>
                    <span className="text-[10px] font-medium leading-none">
                      {it.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
