import InteractiveMap from '../../../components/map/InteractiveMap';

export default function MapPage() {
  return (
    <div className="h-[100dvh] w-full relative">
      <InteractiveMap />
      
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10">
        <div className="glass-card rounded-2xl p-4 max-w-md mx-auto animate-liquid-appear">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div className="flex-1">
              <h1 className="font-bold">근처 오퍼</h1>
              <p className="text-xs text-gray-400">지도에서 확인하세요</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
