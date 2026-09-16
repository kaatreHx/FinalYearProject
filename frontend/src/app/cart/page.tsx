"use client";

import Link from "next/link";
import DashboardNav from "@/components/property/DashboardNav";
import CartLineItem from "@/components/property/CartLineItem";
import { useCart } from "@/context/CartContext";
import { MOCK_PROPERTIES } from "@/lib/properties";
import styles from "./page.module.css";

export default function CartPage() {
  const { cartIds, clearCart } = useCart();
  const items = MOCK_PROPERTIES.filter((p) => cartIds.includes(p.id));

  const saleCount = items.filter((p) => p.status === "For Sale").length;
  const rentCount = items.filter((p) => p.status === "For Rent").length;

  return (
    <div className={styles.page}>
      <DashboardNav />

      <div className={styles.body}>
        <div className={styles.headerRow}>
          <h1 className={styles.heading}>Your cart</h1>
          {items.length > 0 && (
            <button type="button" className={styles.clearBtn} onClick={clearCart}>
              Clear all
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Your cart is empty</p>
            <p className={styles.emptyBody}>
              Add listings from the dashboard to compare and request viewings.
            </p>
            <Link href="/dashboard" className={styles.browseLink}>
              Browse properties
            </Link>
          </div>
        ) : (
          <div className={styles.layout}>
            <div className={styles.list}>
              {items.map((property) => (
                <CartLineItem key={property.id} property={property} />
              ))}
            </div>

            <aside className={styles.summary}>
              <h4 className={styles.summaryLabel}>Summary</h4>

              <div className={styles.summaryRow}>
                <span>Listings selected</span>
                <span>{items.length}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>For sale</span>
                <span>{saleCount}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>For rent</span>
                <span>{rentCount}</span>
              </div>

              <button type="button" className={styles.requestBtn}>
                Request viewings
              </button>
              <p className={styles.summaryNote}>
                An agent will reach out to schedule viewing times for each
                listing above.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
