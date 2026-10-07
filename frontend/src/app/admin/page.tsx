"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatCard from "@/components/admin/StatCard";
import tableStyles from "@/components/admin/AdminTable.module.css";
import { fetchReviewQueue } from "@/lib/government";
import { MOCK_PURCHASE_REQUESTS, formatRequestDate } from "@/lib/purchaseRequests";
import type { Property, VerificationStatus } from "@/types/property";
import styles from "./page.module.css";

const STATUSES: VerificationStatus[] = ["PENDING", "DISPATCHED", "VERIFIED", "MINTED", "REJECTED"];

export default function AdminOverviewPage() {
  const [byStatus, setByStatus] = useState<Record<VerificationStatus, Property[]> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(STATUSES.map((s) => fetchReviewQueue(s)))
      .then((lists) =>
        setByStatus(
          Object.fromEntries(STATUSES.map((s, i) => [s, lists[i]])) as Record<VerificationStatus, Property[]>
        )
      )
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load property stats."));
  }, []);

  const count = (s: VerificationStatus) => (byStatus ? byStatus[s].length : "—");

  const liveListings = byStatus ? [...byStatus.VERIFIED, ...byStatus.MINTED] : [];
  const listedValueLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(liveListings.reduce((sum, p) => sum + p.price, 0));

  // Purchase requests are still mocked (no backend endpoint yet).
  const totalRequests = MOCK_PURCHASE_REQUESTS.length;
  const pending = MOCK_PURCHASE_REQUESTS.filter((r) => r.status === "Pending").length;

  const allProperties = byStatus ? STATUSES.flatMap((s) => byStatus[s]) : [];
  const recentRequests = [...MOCK_PURCHASE_REQUESTS]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5)
    .map((request) => ({
      ...request,
      property: allProperties.find((p) => p.id === request.propertyId),
    }));

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        description="A snapshot of property verification and buyer activity."
      />

      {loadError && <p className={tableStyles.emptyState}>{loadError}</p>}

      <div className={styles.statGrid}>
        <StatCard label="Awaiting review" value={count("PENDING")} sublabel="submitted by sellers" />
        <StatCard label="With government" value={count("DISPATCHED")} sublabel="being verified" />
        <StatCard label="Verified" value={count("VERIFIED")} sublabel="ready to mint" />
        <StatCard label="NFTs minted" value={count("MINTED")} />
        <StatCard label="Rejected" value={count("REJECTED")} />
        <StatCard label="Live listed value" value={byStatus ? listedValueLabel : "—"} sublabel="verified + minted" />
        <StatCard label="Purchase requests" value={totalRequests} sublabel={`${pending} pending`} />
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Recent purchase requests</h2>
        <Link href="/admin/requests" className={styles.viewAllLink}>
          View all →
        </Link>
      </div>

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Property</th>
              <th>Offer</th>
              <th>Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {recentRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.buyerName}</td>
                <td>
                  {request.property ? (
                    <Link href={`/property/${request.property.id}`} className={tableStyles.rowLink}>
                      {request.property.title}
                    </Link>
                  ) : (
                    <span className={tableStyles.muted}>Removed listing</span>
                  )}
                </td>
                <td>
                  {request.offerPrice !== null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(request.offerPrice)
                    : "—"}
                </td>
                <td>
                  <span className={tableStyles.tag} data-tone={request.status.toLowerCase()}>
                    {request.status}
                  </span>
                </td>
                <td className={tableStyles.muted}>{formatRequestDate(request.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
