import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatCard from "@/components/admin/StatCard";
import tableStyles from "@/components/admin/AdminTable.module.css";
import { MOCK_PROPERTIES } from "@/lib/properties";
import {
  MOCK_PURCHASE_REQUESTS,
  formatRequestDate,
} from "@/lib/purchaseRequests";
// import { MOCK_USERS } from "@/lib/users";
import { MOCK_KYC_APPLICATIONS } from "@/lib/kycApplications";
import styles from "./page.module.css";

export default function AdminOverviewPage() {
  const totalListings = MOCK_PROPERTIES.length;
  const forSale = MOCK_PROPERTIES.filter((p) => p.status === "For Sale").length;
  const forRent = MOCK_PROPERTIES.filter((p) => p.status === "For Rent").length;

  const totalRequests = MOCK_PURCHASE_REQUESTS.length;
  const pending = MOCK_PURCHASE_REQUESTS.filter((r) => r.status === "Pending").length;
  const accepted = MOCK_PURCHASE_REQUESTS.filter((r) => r.status === "Accepted").length;
  const declined = MOCK_PURCHASE_REQUESTS.filter((r) => r.status === "Declined").length;

  // const totalSellers = MOCK_USERS.filter((u) => u.role === "seller").length;
  // const totalBuyers = MOCK_USERS.filter((u) => u.role === "buyer").length;

  const pendingKyc = MOCK_KYC_APPLICATIONS.filter((a) => a.status === "pending").length;

  const listedValue = MOCK_PROPERTIES.filter((p) => p.status === "For Sale").reduce(
    (sum, p) => sum + p.price,
    0
  );
  const listedValueLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(listedValue);

  const recentRequests = [...MOCK_PURCHASE_REQUESTS]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5)
    .map((request) => ({
      ...request,
      property: MOCK_PROPERTIES.find((p) => p.id === request.propertyId),
    }));

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        description="A system-wide snapshot of listings, requests, and users."
      />

      <div className={styles.statGrid}>
        <StatCard
          label="Listings"
          value={totalListings}
          sublabel={`${forSale} for sale · ${forRent} for rent`}
        />
        <StatCard
          label="Purchase requests"
          value={totalRequests}
          sublabel={`${pending} pending`}
        />
        <StatCard
          label="Requests resolved"
          value={accepted + declined}
          sublabel={`${accepted} accepted · ${declined} declined`}
        />
        <StatCard
          label="Users"
        // value={MOCK_USERS.length}
        // sublabel={`${totalSellers} sellers · ${totalBuyers} buyers`}
        />
        <StatCard
          label="KYC review"
          value={pendingKyc}
          sublabel="applications pending"
        />
        <StatCard label="Listed value (for sale)" value={listedValueLabel} />
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
                    <Link
                      href={`/property/${request.property.id}`}
                      className={tableStyles.rowLink}
                    >
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
                  <span
                    className={tableStyles.tag}
                    data-tone={request.status.toLowerCase()}
                  >
                    {request.status}
                  </span>
                </td>
                <td className={tableStyles.muted}>
                  {formatRequestDate(request.submittedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
