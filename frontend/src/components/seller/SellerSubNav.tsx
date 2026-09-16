"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SellerSubNav.module.css";

const TABS = [
  { href: "/seller/new", label: "List a property" },
  { href: "/seller/listings", label: "My listings & requests" },
  { href: "/seller/growth", label: "Growth stats" },
];

export default function SellerSubNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.subNav}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`${styles.tab} ${
            pathname === tab.href ? styles.tabActive : ""
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
