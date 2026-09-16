"use client";

import { useMemo, useState } from "react";
import DashboardNav from "@/components/property/DashboardNav";
import SellerSubNav from "@/components/seller/SellerSubNav";
import SellerListingRow from "@/components/seller/SellerListingRow";
import PurchaseRequestCard from "@/components/seller/PurchaseRequestCard";
import {
  CURRENT_SELLER_ID,
  MOCK_PROPERTIES,
  formatPrice,
  getPropertiesByOwner,
} from "@/lib/properties";
import {
  MOCK_PURCHASE_REQUESTS,
  countPendingRequests,
  getRequestsForProperty,
} from "@/lib/purchaseRequests";
import type { PurchaseRequest, PurchaseRequestStatus } from "@/types/purchase-request";
import styles from "./page.module.css";

export default function SellerListingsPage() {
  const myListings = useMemo(
    () => getPropertiesByOwner(MOCK_PROPERTIES, CURRENT_SELLER_ID),
    []
  );

  const [requests, setRequests] = useState<PurchaseRequest[]>(
    MOCK_PURCHASE_REQUESTS
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    myListings[0]?.id ?? null
  );

  const selectedProperty =
    myListings.find((property) => property.id === selectedId) ?? null;

  const selectedRequests = selectedProperty
    ? getRequestsForProperty(requests, selectedProperty.id)
    : [];

  function updateStatus(requestId: string, status: PurchaseRequestStatus) {
    // Replace with a real API call once the requests endpoint exists,
    // e.g. POST `${API_BASE_URL}/requests/:id/status`
    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, status } : request
      )
    );
  }

  return (
    <div className={styles.page}>
      <DashboardNav userName="Asha Gurung" hideCart />
      <SellerSubNav />

      <div className={styles.body}>
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}>
            <h1 className={styles.heading}>My listings</h1>
            <span className={styles.count}>
              {myListings.length} listing{myListings.length !== 1 ? "s" : ""}
            </span>
          </div>

          {myListings.length === 0 ? (
            <p className={styles.emptyMuted}>
              You haven&apos;t listed any properties yet.
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
                  <h2 className={styles.detailTitle}>
                    {selectedProperty.title}
                  </h2>
                  <p className={styles.detailAddress}>
                    {selectedProperty.address}, {selectedProperty.city}
                  </p>
                </div>
                <span className={styles.detailPrice}>
                  {formatPrice(selectedProperty.price, selectedProperty.status)}
                </span>
              </div>

              <div className={styles.requestsHeader}>
                <h3 className={styles.requestsHeading}>Purchase requests</h3>
                <span className={styles.count}>
                  {selectedRequests.length} request
                  {selectedRequests.length !== 1 ? "s" : ""}
                </span>
              </div>

              {selectedRequests.length === 0 ? (
                <div className={styles.emptyRequests}>
                  <p className={styles.emptyTitle}>No requests yet</p>
                  <p className={styles.emptyBody}>
                    You&apos;ll see buyer inquiries and offers here as they
                    come in.
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
            <p className={styles.emptyMuted}>
              Select a listing to see its requests.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
