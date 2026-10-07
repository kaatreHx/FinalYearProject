"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/property/DashboardNav";
import PropertyLocationMap from "@/components/property/PropertyLocationMap";
import PurchaseRequestForm from "@/components/property/PurchaseRequestForm";
import { geocodeFirst } from "@/lib/geocode";
import {
  STATUS_LABEL,
  formatAddress,
  formatPrice,
  isPublicStatus,
  propertyImage,
} from "@/lib/properties";
import type { Property } from "@/types/property";
import styles from "./PropertyDetailView.module.css";

interface PropertyDetailViewProps {
  property: Property;
}

// The backend doesn't store coordinates, so resolve the map pin from the address.
function LocationSection({ property }: { property: Property }) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    property.latitude !== null && property.longitude !== null
      ? { lat: property.latitude, lon: property.longitude }
      : null
  );
  const [done, setDone] = useState(coords !== null);

  useEffect(() => {
    if (coords) return;
    let cancelled = false;
    geocodeFirst([
      [property.address, property.city, property.zip].filter(Boolean).join(", "),
      [property.city, property.zip].filter(Boolean).join(", "),
      property.city,
    ]).then((found) => {
      if (cancelled) return;
      setCoords(found);
      setDone(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id]);

  if (coords) {
    return (
      <>
        <PropertyLocationMap latitude={coords.lat} longitude={coords.lon} title={property.title} />
        {!property.address && (
          <p className={styles.mapNote}>
            Approximate location. The exact address is shared once the seller accepts a request.
          </p>
        )}
      </>
    );
  }
  return <p className={styles.mapNote}>{done ? "Map unavailable for this address." : "Locating on map…"}</p>;
}

export default function PropertyDetailView({ property }: PropertyDetailViewProps) {
  const isPublic = isPublicStatus(property.verificationStatus);
  const hero = propertyImage(property, 0, 960, 620);
  const thumbs = property.imageUrls.slice(1, 4);

  return (
    <div className={styles.page}>
      <DashboardNav />

      <div className={styles.body}>
        <Link href="/dashboard" className={styles.backLink}>
          ← Back to listings
        </Link>

        {!isPublic && (
          <div className={styles.notice}>
            This listing is <strong>{STATUS_LABEL[property.verificationStatus]}</strong> — only you can see
            it. It goes public after government verification.
          </div>
        )}

        <div className={styles.gallery}>
          {hero && <img className={styles.heroImage} src={hero} alt={property.title} />}
          {thumbs.length > 0 && (
            <div className={styles.thumbRow}>
              {thumbs.map((url) => (
                <img key={url} className={styles.thumb} src={url} alt="" />
              ))}
            </div>
          )}
        </div>

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.headerRow}>
              <div>
                <span className={styles.statusTag} data-status={property.status}>
                  {property.status}
                </span>
                <h1 className={styles.title}>{property.title}</h1>
                <p className={styles.address}>{formatAddress(property)}</p>
              </div>
              <span className={styles.price}>{formatPrice(property.price, property.status)}</span>
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
                <span className={styles.statLabel}>{property.landRegistrationNumber ? "Land reg. no." : "Listing ref"}</span>
              </div>
            </div>

            {property.description && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About this property</h2>
                <p className={styles.description}>{property.description}</p>
              </section>
            )}

            {isPublic && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Ownership verification</h2>
                <p className={styles.ownerLine}>✓ Ownership verified by the government registry.</p>
                {property.governmentRefNumber && (
                  <p className={styles.mapNote}>Reference: {property.governmentRefNumber}</p>
                )}
                {property.verificationStatus === "MINTED" && (
                  <p className={styles.mapNote}>
                    Minted as NFT{property.tokenId ? ` #${property.tokenId}` : ""}
                    {property.contractAddress ? ` · contract ${property.contractAddress}` : ""}
                    {property.mintTxHash ? ` · tx ${property.mintTxHash}` : ""}
                  </p>
                )}
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Listed by</h2>
              <p className={styles.ownerLine}>{property.ownerName}</p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Location</h2>
              <LocationSection property={property} />
            </section>
          </main>

          {isPublic && (
            <aside className={styles.sidebar}>
              <PurchaseRequestForm property={property} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
