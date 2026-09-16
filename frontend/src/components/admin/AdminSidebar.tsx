"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AdminSidebar.module.css";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/requests", label: "Purchase requests" },
  { href: "/admin/kyc", label: "KYC review" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark} />
        <div>
          <div className={styles.brandName}>Meridian Estates</div>
          <div className={styles.brandSub}>Admin</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link href="/dashboard" className={styles.backLink}>
        ← Back to site
      </Link>
    </aside>
  );
}
