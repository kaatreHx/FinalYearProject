"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/property/DashboardNav";
import SellerSubNav from "@/components/seller/SellerSubNav";
import SellerListingRow from "@/components/seller/SellerListingRow";
import PurchaseRequestCard from "@/components/seller/PurchaseRequestCard";
import VerificationPanel from "@/components/seller/VerificationPanel";
import { fetchMyProperties, formatAddress, formatPrice, isPublicStatus } from "@/lib/properties";
import {
  MOCK_PURCHASE_REQUESTS,
  countPendingRequests,
  getRequestsForProperty,
} from "@/lib/purchaseRequests";
import type { Property } from "@/types/property";
import type { PurchaseRequest, PurchaseRequestStatus } from "@/types/purchase-request";
import styles from "./page.module.css";

export default function SellerListingsPage() {
  const [myListings, setMyListings] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Purchase requests don't have a backend endpoint yet, so they stay mocked.
  const [requests, setRequests] = useState<PurchaseRequest[]>(MOCK_PURCHASE_REQUESTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyProperties()
      .then((data) => {
        if (cancelled) return;
        setMyListings(data);
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Couldn't load your listings."))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProperty = myListings.find((property) => property.id === selectedId) ?? null;
  const selectedRequests = selectedProperty ? getRequestsForProperty(requests, selectedProperty.id) : [];

  function handleUpdated(updated: Property) {
    setMyListings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(id: string) {
    setMyListings((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  function updateStatus(requestId: string, status: PurchaseRequestStatus) {
    // Replace with a real API call once the requests endpoint exists.
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
  }

  return (
    <div className={styles.page}>
      <DashboardNav hideCart />
      <SellerSubNav />

      <div className={styles.body}>
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}>
            <h1 className={styles.heading}>My listings</h1>
            <span className={styles.count}>
              {myListings.length} listing{myListings.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isLoading ? (
            <p className={styles.emptyMuted}>Loading your listings…</p>
          ) : loadError ? (
            <p className={styles.emptyMuted}>{loadError}</p>
          ) : myListings.length === 0 ? (
            <p className={styles.emptyMuted}>
              You haven&apos;t listed any properties yet. <Link href="/seller/new">List your first one</Link>.
            </p>
          ) : (
            <div className={styles.list}>
              {myListings.map((property) => (
                <SellerListingRow
                  key={property.id}
                  property={property}
                  active={property.id === selectedId}
                  pendingCount={countPendingRequests(requests, property.id)}
                  onSelect={() => setSelectedId(property.id)}
                />
              ))}
            </div>
          )}
        </aside>

        <main className={styles.main}>
          {selectedProperty ? (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{selectedProperty.title}</h2>
                  <p className={styles.detailAddress}>{formatAddress(selectedProperty)}</p>
                  <Link href={`/property/${selectedProperty.id}`} className={styles.detailAddress}>
                    View listing →
                  </Link>
                </div>
                <span className={styles.detailPrice}>
                  {formatPrice(selectedProperty.price, selectedProperty.status)}
                </span>
              </div>

              <VerificationPanel
                key={selectedProperty.id + selectedProperty.verificationStatus}
                property={selectedProperty}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />

              <div className={styles.requestsHeader}>
                <h3 className={styles.requestsHeading}>Purchase requests</h3>
                <span className={styles.count}>
                  {selectedRequests.length} request{selectedRequests.length !== 1 ? "s" : ""}
                </span>
              </div>

              {!isPublicStatus(selectedProperty.verificationStatus) ? (
                <div className={styles.emptyRequests}>
                  <p className={styles.emptyTitle}>Not open to buyers yet</p>
                  <p className={styles.emptyBody}>
                    Buyers can only see and request this property once the government has verified it.
                  </p>
                </div>
              ) : selectedRequests.length === 0 ? (
                <div className={styles.emptyRequests}>
                  <p className={styles.emptyTitle}>No requests yet</p>
                  <p className={styles.emptyBody}>
                    You&apos;ll see buyer inquiries and offers here as they come in.
                  </p>
                </div>
              ) : (
                <div className={styles.requestsList}>
                  {selectedRequests.map((request) => (
                    <PurchaseRequestCard
                      key={request.id}
                      request={request}
                      onAccept={() => updateStatus(request.id, "Accepted")}
                      onDecline={() => updateStatus(request.id, "Declined")}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            !isLoading && !loadError && <p className={styles.emptyMuted}>Select a listing to see its details.</p>
          )}
        </main>
      </div>
    </div>
  );
}
