import Link from "next/link";
import DashboardNav from "@/components/property/DashboardNav";
import SellerSubNav from "@/components/seller/SellerSubNav";
import GrowthBarChart from "@/components/seller/GrowthBarChart";
import { CURRENT_SELLER_ID, MOCK_PROPERTIES, formatPrice } from "@/lib/properties";
import { MOCK_PURCHASE_REQUESTS, formatRequestDate } from "@/lib/purchaseRequests";
import {
  getPropertiesAddedSeries,
  getSalesCountSeries,
  getSalesValueSeries,
  getSellerSummary,
} from "@/lib/sellerStats";
import styles from "./page.module.css";

export default function SellerGrowthPage() {
  const summary = getSellerSummary(CURRENT_SELLER_ID, MOCK_PROPERTIES, MOCK_PURCHASE_REQUESTS);

  const propertiesAddedSeries = getPropertiesAddedSeries(summary.myProperties);
  const salesCountSeries = getSalesCountSeries(summary.myProperties, MOCK_PURCHASE_REQUESTS);
  const salesValueSeries = getSalesValueSeries(summary.myProperties, MOCK_PURCHASE_REQUESTS);

  const currency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
      notation: v >= 1000 ? "compact" : "standard",
    }).format(v);

  return (
    <div className={styles.page}>
      <DashboardNav userName="Asha Gurung" hideCart />
      <SellerSubNav />

      <div className={styles.body}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Growth stats</h1>
          <p className={styles.subheading}>
            How your listings and sales have moved over the last 6 months.
          </p>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total listings</span>
            <span className={styles.statValue}>{summary.myProperties.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Sales closed</span>
            <span className={styles.statValue}>{summary.acceptedCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Sales value</span>
            <span className={styles.statValue}>{currency(summary.totalSalesValue)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Pending requests</span>
            <span className={styles.statValue}>{summary.pendingRequests.length}</span>
          </div>
        </div>

        <div className={styles.chartGrid}>
          <GrowthBarChart
            title="Properties added"
            description="New listings created per month."
            series={propertiesAddedSeries}
            color="var(--ink-navy)"
          />
          <GrowthBarChart
            title="Sales growth"
            description="Accepted purchase/rental requests per month."
            series={salesCountSeries}
            color="var(--brass)"
          />
          <GrowthBarChart
            title="Sales value"
            description="Total value of accepted requests per month."
            series={salesValueSeries}
            formatValue={currency}
            color="var(--sage)"
          />
        </div>

        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Pending requests</h2>
          <Link href="/seller/listings" className={styles.viewAllLink}>
            View in listings →
          </Link>
        </div>

        {summary.pendingRequests.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No pending requests</p>
            <p className={styles.emptyBody}>
              New buyer requests will show up here as they come in.
            </p>
          </div>
        ) : (
          <div className={styles.pendingList}>
            {summary.pendingRequests.map((request) => (
              <div key={request.id} className={styles.pendingRow}>
                <div className={styles.pendingMain}>
                  <span className={styles.pendingBuyer}>{request.buyerName}</span>
                  <span className={styles.pendingProperty}>
                    {request.property
                      ? request.property.title
                      : "Listing no longer available"}
                  </span>
                </div>
                <div className={styles.pendingMeta}>
                  {request.offerPrice !== null && (
                    <span className={styles.pendingOffer}>
                      {formatPrice(request.offerPrice, request.property?.status ?? "For Sale")}
                    </span>
                  )}
                  <span className={styles.pendingDate}>
                    {formatRequestDate(request.submittedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
