import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

/**
 * Card de KPI do painel admin (dark-only). Extraído do antigo AdminDashboard
 * pra ser reutilizado nas 5 seções.
 */
export function StatCard({ icon: Icon, label, value, sub, color = "text-zinc-400" }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <Icon className="h-5 w-5" />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}
