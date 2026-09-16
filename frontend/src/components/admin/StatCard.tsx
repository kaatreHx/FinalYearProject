import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
}

export default function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
    </div>
  );
}
