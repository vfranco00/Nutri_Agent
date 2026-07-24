import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartCardProps {
  title: string;
  /** Um único elemento de gráfico recharts (LineChart, BarChart, PieChart...). */
  children: ReactNode;
  className?: string;
  height?: number;
}

/**
 * Wrapper padrão dos gráficos do painel: card escuro + título + ResponsiveContainer,
 * pra não repetir esse boilerplate em toda seção.
 */
export function ChartCard({ title, children, className = "", height = 256 }: ChartCardProps) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
