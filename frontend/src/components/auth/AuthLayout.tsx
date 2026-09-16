import { ReactNode } from "react";
import styles from "./AuthLayout.module.css";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.app}>
      <div className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <div className={styles.brandMark} />
          <div className={styles.brandName}>Meridian Estates</div>
        </div>

        <div className={styles.blueprintStage}>
          <svg className={styles.planSvg} viewBox="0 0 420 320" fill="none">
            <path
              className={`${styles.planLine} ${styles.delay1}`}
              d="M40 60 L40 260 L340 260 L340 60 L220 60 L220 30 L120 30 L120 60 Z"
            />
            <path
              className={`${styles.planLine} ${styles.delay2}`}
              d="M180 60 L180 160 M180 160 L340 160 M260 160 L260 260 M40 190 L150 190 M150 190 L150 260"
            />
            <path
              className={`${styles.planLine} ${styles.delay3}`}
              d="M180 130 A 40 40 0 0 0 220 160 M260 220 A 30 30 0 0 1 230 250 M95 190 A 25 25 0 0 1 120 215"
            />
            <circle className={styles.planDot} cx="205" cy="120" r="4" />
            <text className={styles.planLabel} x="215" y="124">
              UNIT 205 · LOT 14
            </text>
            <text className={styles.planLabel} x="44" y="52">
              86 M²
            </text>
            <text className={styles.planLabel} x="264" y="180">
              BATH
            </text>
            <text className={styles.planLabel} x="44" y="182">
              LIVING
            </text>
          </svg>
        </div>

        <div className={styles.brandQuote}>
          Every listing starts as a set of lines on paper — before it&apos;s a
          place someone calls home.
          <span>Meridian — Since 2014</span>
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formWrap}>
          {children}
          <div className={styles.plotRef}>REF// MERIDIAN-AUTH-01</div>
        </div>
      </div>
    </div>
  );
}
