import { TrendingUp, TrendingDown, Info } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; positive: boolean };
  trendLabel?: string;
}

export function KpiCard({ label, value, trend, trendLabel = "vs last month" }: KpiCardProps) {
  return (
    <div
      className="bg-white rounded-xl p-6 border relative overflow-hidden transition-all duration-200 hover:shadow-lg group"
      style={{
        borderColor: '#E5EDFF',
        boxShadow: '0px 2px 12px rgba(11, 61, 145, 0.10)',
      }}
    >
      {/* Left accent border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: 'linear-gradient(180deg, #0B3D91, #1D4ED8, #3B82F6)' }}
      />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] tracking-[0.5px] uppercase" style={{ color: '#9CA3AF', fontWeight: 500 }}>
          {label}
        </span>
        <Info className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#9CA3AF' }} />
      </div>
      <div
        className="text-[36px] mb-2"
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #0B3D91, #3B82F6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {value}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5">
          {trend.positive ? (
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#1D4ED8' }} />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
          )}
          <span className="text-[12px]" style={{ color: trend.positive ? '#1D4ED8' : '#DC2626', fontWeight: 500 }}>
            {trend.value}%
          </span>
          <span className="text-[12px]" style={{ color: '#9CA3AF' }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
