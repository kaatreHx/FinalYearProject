"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import styles from "./DashboardNav.module.css";

interface DashboardNavProps {
  query?: string;
  onQueryChange?: (query: string) => void;
  userName?: string;
  hideCart?: boolean;
}

export default function DashboardNav({
  query = "",
  onQueryChange,
  userName = "Asha Gurung",
  hideCart = false,
}: DashboardNavProps) {
  const { cartIds } = useCart();
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    try {
      let data: string | null | undefined = localStorage.getItem("user");

      if (data) {
        const parsed = JSON.parse(data);
        setIsAgent(!!parsed?.isAgent);
      }
    } catch {
      setIsAgent(false);
    }
  }, []);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={styles.nav}>
      <Link href="/dashboard" className={styles.brand}>
        <span className={styles.brandMark} />
        <span className={styles.brandName}>Meridian Estates</span>
      </Link>

      {onQueryChange && (
        <div className={styles.searchWrap}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by city, neighborhood, or plot ref"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
      )}

      <div className={styles.actions}>
        {isAgent && (
          <Link href="/seller/new" className={styles.listBtn}>
            List a property
          </Link>
        )}

        {!hideCart && (
          <Link href="/cart" className={styles.cartLink} aria-label="View cart">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
              <path
                d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6.2"
                stroke="var(--stone)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="20.5" r="1.4" fill="var(--stone)" />
              <circle cx="17" cy="20.5" r="1.4" fill="var(--stone)" />
            </svg>
            {cartIds.length > 0 && (
              <span className={styles.cartBadge}>{cartIds.length}</span>
            )}
          </Link>
        )}

        <Link href="/profile" className={styles.avatar} title={userName}>
          {initials}
        </Link>
      </div>
    </header>
  );
}
