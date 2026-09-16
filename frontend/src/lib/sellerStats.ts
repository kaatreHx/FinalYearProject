import { getPropertiesByOwner } from "@/lib/properties";
import type { Property } from "@/types/property";
import type { PurchaseRequest } from "@/types/purchase-request";

export interface MonthlyPoint {
  label: string;
  value: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function lastNMonths(n: number, reference: Date) {
  const out: { label: string; year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    out.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

export function getPropertiesAddedSeries(
  properties: Property[],
  months = 6,
  reference: Date = new Date()
): MonthlyPoint[] {
  return lastNMonths(months, reference).map(({ label, year, month }) => ({
    label,
    value: properties.filter((p) => {
      const d = new Date(p.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length,
  }));
}

export function getSalesCountSeries(
  properties: Property[],
  requests: PurchaseRequest[],
  months = 6,
  reference: Date = new Date()
): MonthlyPoint[] {
  const propertyIds = new Set(properties.map((p) => p.id));
  return lastNMonths(months, reference).map(({ label, year, month }) => ({
    label,
    value: requests.filter((r) => {
      if (!propertyIds.has(r.propertyId) || r.status !== "Accepted") return false;
      const d = new Date(r.submittedAt);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length,
  }));
}

export function getSalesValueSeries(
  properties: Property[],
  requests: PurchaseRequest[],
  months = 6,
  reference: Date = new Date()
): MonthlyPoint[] {
  const byId = new Map(properties.map((p) => [p.id, p]));
  return lastNMonths(months, reference).map(({ label, year, month }) => {
    const value = requests
      .filter((r) => {
        if (!byId.has(r.propertyId) || r.status !== "Accepted") return false;
        const d = new Date(r.submittedAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, r) => sum + (r.offerPrice ?? byId.get(r.propertyId)?.price ?? 0), 0);
    return { label, value };
  });
}

export interface SellerSummary {
  myProperties: Property[];
  myRequests: PurchaseRequest[];
  pendingRequests: (PurchaseRequest & { property: Property | undefined })[];
  acceptedCount: number;
  totalSalesValue: number;
}

export function getSellerSummary(
  sellerId: string,
  properties: Property[],
  requests: PurchaseRequest[]
): SellerSummary {
  const myProperties = getPropertiesByOwner(properties, sellerId);
  const myPropertyIds = new Set(myProperties.map((p) => p.id));
  const myRequests = requests.filter((r) => myPropertyIds.has(r.propertyId));

  const accepted = myRequests.filter((r) => r.status === "Accepted");
  const totalSalesValue = accepted.reduce(
    (sum, r) =>
      sum + (r.offerPrice ?? myProperties.find((p) => p.id === r.propertyId)?.price ?? 0),
    0
  );

  const pendingRequests = myRequests
    .filter((r) => r.status === "Pending")
    .map((r) => ({ ...r, property: myProperties.find((p) => p.id === r.propertyId) }))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return {
    myProperties,
    myRequests,
    pendingRequests,
    acceptedCount: accepted.length,
    totalSalesValue,
  };
}
