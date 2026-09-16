"use client";

import Link from "next/link";
import DashboardNav from "@/components/property/DashboardNav";
import PropertyLocationMap from "@/components/property/PropertyLocationMap";
import PurchaseRequestForm from "@/components/property/PurchaseRequestForm";
import { formatPrice } from "@/lib/properties";
import type { Property } from "@/types/property";
import styles from "./PropertyDetailView.module.css";

interface PropertyDetailViewProps {
  property: Property;
}

export default function PropertyDetailView({ property }: PropertyDetailViewProps) {
  return (
    <div className={styles.page}>
      <DashboardNav />

      <div className={styles.body}>
        <Link href="/dashboard" className={styles.backLink}>
          ← Back to listings
        </Link>

        <div className={styles.gallery}>
          <img
            className={styles.heroImage}
            src={`https://picsum.photos/seed/${property.imageSeed}/960/620`}
            alt={property.title}
          />
          <div className={styles.thumbRow}>
            <img
              className={styles.thumb}
              src={`https://picsum.photos/seed/${property.imageSeed}-2/300/220`}
              alt=""
            />
            <img
              className={styles.thumb}
              src={`https://picsum.photos/seed/${property.imageSeed}-3/300/220`}
              alt=""
            />
            <img
              className={styles.thumb}
              src={`https://picsum.photos/seed/${property.imageSeed}-4/300/220`}
              alt=""
            />
          </div>
        </div>

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.headerRow}>
              <div>
                <span className={styles.statusTag} data-status={property.status}>
                  {property.status}
                </span>
                <h1 className={styles.title}>{property.title}</h1>
                <p className={styles.address}>
                  {property.address}, {property.city}
                </p>
              </div>
              <span className={styles.price}>
                {formatPrice(property.price, property.status)}
              </span>
            </div>

            <div className={styles.statGrid}>
              {property.beds > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{property.beds}</span>
                  <span className={styles.statLabel}>Bedrooms</span>
                </div>
              )}
              {property.baths > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{property.baths}</span>
                  <span className={styles.statLabel}>Bathrooms</span>
                </div>
              )}
              {property.parking > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{property.parking}</span>
                  <span className={styles.statLabel}>Parking</span>
                </div>
              )}
              <div className={styles.statItem}>
                <span className={styles.statValue}>{property.areaSqm}</span>
                <span className={styles.statLabel}>m² area</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{property.type}</span>
                <span className={styles.statLabel}>Type</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{property.plotRef}</span>
                <span className={styles.statLabel}>Plot ref</span>
              </div>
            </div>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Listed by</h2>
              <p className={styles.ownerLine}>{property.ownerName}</p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Location</h2>
              <PropertyLocationMap
                latitude={property.latitude}
                longitude={property.longitude}
                title={property.title}
              />
            </section>
          </main>

          <aside className={styles.sidebar}>
            <PurchaseRequestForm property={property} />
          </aside>
        </div>
      </div>
    </div>
  );
}
