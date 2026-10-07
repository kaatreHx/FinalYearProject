"use client";

import type { Property } from "@/types/property";
import { STATUS_LABEL, formatAddress, formatPrice, propertyImage } from "@/lib/properties";
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
        src={propertyImage(property, 0, 160, 120) ?? undefined}
        alt=""
        loading="lazy"
      />

      <div className={styles.info}>
        <div className={styles.topLine}>
          <span className={styles.title}>{property.title}</span>
          <span className={styles.statusTag} data-status={property.verificationStatus}>
            {STATUS_LABEL[property.verificationStatus]}
          </span>
        </div>
        <p className={styles.address}>{formatAddress(property)}</p>
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
