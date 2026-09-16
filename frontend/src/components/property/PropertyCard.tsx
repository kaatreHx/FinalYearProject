"use client";

import Link from "next/link";
import type { Property } from "@/types/property";
import { formatPrice } from "@/lib/properties";
import { useCart } from "@/context/CartContext";
import styles from "./PropertyCard.module.css";

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const { isInCart, toggleCart } = useCart();
  const inCart = isInCart(property.id);

  return (
    <Link href={`/property/${property.id}`} className={styles.cardLink}>
      <article className={styles.card}>
        <div className={styles.imageWrap}>
          <img
            className={styles.image}
            src={`https://picsum.photos/seed/${property.imageSeed}/640/440`}
            alt={property.title}
            loading="lazy"
          />
          <span className={styles.statusTag} data-status={property.status}>
            {property.status}
          </span>
          <button
            type="button"
            className={`${styles.cartBtn} ${inCart ? styles.cartBtnActive : ""}`}
            aria-pressed={inCart}
            aria-label={inCart ? "Remove from cart" : "Add to cart"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCart(property.id);
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path
                d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6.2"
                stroke={inCart ? "var(--ink-navy)" : "var(--white)"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="10"
                cy="20.5"
                r="1.4"
                fill={inCart ? "var(--ink-navy)" : "var(--white)"}
              />
              <circle
                cx="17"
                cy="20.5"
                r="1.4"
                fill={inCart ? "var(--ink-navy)" : "var(--white)"}
              />
            </svg>
          </button>
          <span className={styles.plotRef}>{property.plotRef}</span>
        </div>

        <div className={styles.body}>
          <div className={styles.priceRow}>
            <span className={styles.price}>
              {formatPrice(property.price, property.status)}
            </span>
            <span className={styles.typeTag}>{property.type}</span>
          </div>

          <h3 className={styles.title}>{property.title}</h3>
          <p className={styles.address}>
            {property.address}, {property.city}
          </p>

          <div className={styles.statLine}>
            {property.beds > 0 && <span>{property.beds} BD</span>}
            {property.baths > 0 && <span>{property.baths} BA</span>}
            {property.parking > 0 && <span>{property.parking} PK</span>}
            <span>{property.areaSqm} M²</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
