'use client';

interface SpeedPanelProps {
  currentSpeed: number; // km/h
  maxSpeed: number;
  avgSpeed: number;
  gpsAccuracy: number | null;
}

export default function SpeedPanel({
  currentSpeed,
  maxSpeed,
  avgSpeed,
  gpsAccuracy,
}: SpeedPanelProps) {
  return (
    <div
      className="bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 pt-4 shrink-0"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      {/* Current speed — big display */}
      <div className="text-center mb-4">
        <span className="text-6xl font-bold text-[#c8f55a] tabular-nums">
          {currentSpeed.toFixed(1)}
        </span>
        <span className="text-xl text-gray-400 ml-1.5">km/h</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '最高速度', value: `${maxSpeed.toFixed(1)}`, unit: 'km/h' },
          { label: '平均速度', value: `${avgSpeed.toFixed(1)}`, unit: 'km/h' },
          {
            label: 'GPS精度',
            value: gpsAccuracy != null ? `${Math.round(gpsAccuracy)}` : '--',
            unit: gpsAccuracy != null ? 'm' : '',
          },
        ].map(({ label, value, unit }) => (
          <div
            key={label}
            className="bg-[#2a2a2a] rounded-xl py-2.5 px-2 text-center"
          >
            <p className="text-gray-500 text-xs mb-1">{label}</p>
            <p className="text-white font-semibold text-base tabular-nums leading-none">
              {value}
              <span className="text-gray-500 text-xs ml-0.5">{unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
