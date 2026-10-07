"use client";

import type { Property } from "@/types/property";
import { formatAddress, formatPrice, propertyImage } from "@/lib/properties";
import { useCart } from "@/context/CartContext";
import styles from "./CartLineItem.module.css";

interface CartLineItemProps {
  property: Property;
}

export default function CartLineItem({ property }: CartLineItemProps) {
  const { removeFromCart } = useCart();

  return (
    <div className={styles.row}>
      <img
        className={styles.thumb}
        src={propertyImage(property, 0, 200, 150) ?? undefined}
        alt={property.title}
      />

      <div className={styles.info}>
        <div className={styles.topLine}>
          <h3 className={styles.title}>{property.title}</h3>
          <span className={styles.plotRef}>{property.plotRef}</span>
        </div>
        <p className={styles.address}>{formatAddress(property)}</p>
        <div className={styles.statLine}>
          {property.beds > 0 && <span>{property.beds} BD</span>}
          {property.baths > 0 && <span>{property.baths} BA</span>}
          <span>{property.areaSqm} M²</span>
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.price}>
          {formatPrice(property.price, property.status)}
        </span>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => removeFromCart(property.id)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
