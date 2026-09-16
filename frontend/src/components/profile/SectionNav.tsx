"use client";

import styles from "./SectionNav.module.css";

export type ProfileSection = "personal" | "security" | "kyc";

interface SectionNavProps {
  active: ProfileSection;
  onChange: (section: ProfileSection) => void;
  kycBadge?: "pending" | "verified" | "rejected" | null;
  onLogout?: () => void;
}

const SECTIONS: { id: ProfileSection; label: string; hint: string }[] = [
  {
    id: "personal",
    label: "Personal details",
    hint: "Name, email, phone",
  },
  {
    id: "security",
    label: "Password & security",
    hint: "Login credentials",
  },
  {
    id: "kyc",
    label: "KYC verification",
    hint: "Identity documents",
  },
];

export default function SectionNav({ active, onChange, kycBadge, onLogout }: SectionNavProps) {
  return (
    <nav className={styles.nav}>
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`${styles.item} ${active === section.id ? styles.itemActive : ""}`}
          onClick={() => onChange(section.id)}
        >
          <span className={styles.itemLabel}>
            {section.label}
            {section.id === "kyc" && kycBadge && (
              <span className={`${styles.badge} ${styles[`badge_${kycBadge}`]}`}>
                {kycBadge}
              </span>
            )}
          </span>
          <span className={styles.itemHint}>{section.hint}</span>
        </button>
      ))}

      {onLogout && (
        <button type="button" className={styles.logoutBtn} onClick={onLogout}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log out
        </button>
      )}
    </nav>
  );
}
