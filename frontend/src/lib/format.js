import { ethers } from "ethers";

export function formatEth(wei) {
  if (wei === null || wei === undefined || wei === "") return "—";
  try {
    const v = ethers.formatEther(BigInt(wei));
    // Trim trailing zeros for a cleaner look.
    return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`;
  } catch {
    return String(wei);
  }
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Human-friendly label + css class for a request status. */
export function requestStatusMeta(status) {
  const map = {
    Pending: { label: "Pending", cls: "badge-amber" },
    Accepted: { label: "Accepted", cls: "badge-blue" },
    GovApproved: { label: "Gov. Approved", cls: "badge-purple" },
    Paid: { label: "Completed", cls: "badge-green" },
    Rejected: { label: "Rejected", cls: "badge-red" },
  };
  return map[status] || { label: status || "Unknown", cls: "badge-gray" };
}

export function propertyStatusMeta(status) {
  const map = {
    pending: { label: "Pending verification", cls: "badge-amber" },
    verified: { label: "Verified", cls: "badge-green" },
    listed: { label: "Listed for sale", cls: "badge-blue" },
    rejected: { label: "Rejected", cls: "badge-red" },
  };
  return map[status] || { label: status || "Unknown", cls: "badge-gray" };
}

export function kycStatusMeta(status) {
  const map = {
    none: { label: "Not submitted", cls: "badge-gray" },
    pending: { label: "Under review", cls: "badge-amber" },
    approved: { label: "Verified", cls: "badge-green" },
    rejected: { label: "Rejected", cls: "badge-red" },
  };
  return map[status] || { label: status, cls: "badge-gray" };
}
