import type { MonthlyPoint } from "@/lib/sellerStats";
import styles from "./GrowthBarChart.module.css";

interface GrowthBarChartProps {
  title: string;
  description?: string;
  series: MonthlyPoint[];
  formatValue?: (value: number) => string;
  color?: string;
}

export default function GrowthBarChart({
  title,
  description,
  series,
  formatValue,
  color = "var(--brass)",
}: GrowthBarChartProps) {
  const max = Math.max(1, ...series.map((p) => p.value));

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}

      <div className={styles.chart}>
        {series.map((point, i) => {
          const heightPct = max > 0 ? (point.value / max) * 100 : 0;
          return (
            <div key={i} className={styles.barCol}>
              <span className={styles.barValue}>
                {formatValue ? formatValue(point.value) : point.value}
              </span>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ height: `${heightPct}%`, background: color }}
                />
              </div>
              <span className={styles.barLabel}>{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
