import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyProgressPoint } from '@/lib/studentProgress';

interface ProgressLineChartProps {
  data: MonthlyProgressPoint[];
}

export function ProgressLineChart({ data }: ProgressLineChartProps) {
  const empty = data.every(
    (d) => d.speaking === 0 && d.reading === 0 && d.writing === 0 && d.listening === 0,
  );

  if (empty) {
    return (
      <div className="flex h-56 items-center justify-center px-4 text-sm text-ink-subtle">
        XP over time appears after reviews are completed.
      </div>
    );
  }

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e8e8e4" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6b6b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} width={36} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e8e8e4',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="speaking" name="Speaking" stroke="#2d6a4f" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="reading" name="Reading" stroke="#f5c518" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="writing" name="Writing" stroke="#c62828" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="listening" name="Listening" stroke="#1d3557" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
