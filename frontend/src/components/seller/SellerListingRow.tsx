"use client";

import type { Property } from "@/types/property";
import { formatPrice } from "@/lib/properties";
import styles from "./SellerListingRow.module.css";

interface SellerListingRowProps {
  property: Property;
  active: boolean;
  pendingCount: number;
  onSelect: () => void;
}

export default function SellerListingRow({
  property,
  active,
  pendingCount,
  onSelect,
}: SellerListingRowProps) {
  return (
    <button
      type="button"
      className={`${styles.row} ${active ? styles.rowActive : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <img
        className={styles.thumb}
        src={`https://picsum.photos/seed/${property.imageSeed}/160/120`}
        alt=""
        loading="lazy"
      />

      <div className={styles.info}>
        <div className={styles.topLine}>
          <span className={styles.title}>{property.title}</span>
          <span className={styles.statusTag} data-status={property.status}>
            {property.status}
          </span>
        </div>
        <p className={styles.address}>
          {property.address}, {property.city}
        </p>
        <span className={styles.price}>
          {formatPrice(property.price, property.status)}
        </span>
      </div>

      {pendingCount > 0 && (
        <span className={styles.badge}>{pendingCount}</span>
      )}
    </button>
  );
}
