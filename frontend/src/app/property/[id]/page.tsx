"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardNav from "@/components/property/DashboardNav";
import PropertyDetailView from "@/components/property/PropertyDetailView";
import { ApiError } from "@/lib/http";
import { fetchProperty } from "@/lib/properties";
import type { Property } from "@/types/property";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Sends the token when signed in, so an owner can still open their own
    // not-yet-verified listing; everyone else only sees VERIFIED/MINTED ones.
    fetchProperty(id)
      .then((p) => !cancelled && setProperty(p))
      .catch((err) => {
        if (cancelled) return;
        setError({
          message: err instanceof Error ? err.message : "Couldn't load this listing.",
          notFound: err instanceof ApiError && err.status === 404,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (property) return <PropertyDetailView property={property} />;

  return (
    <div>
      <DashboardNav />
      <div style={{ maxWidth: 640, margin: "64px auto", padding: "0 24px" }}>
        {error ? (
          <>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              {error.notFound ? "Listing not found" : "Something went wrong"}
            </h1>
            <p style={{ color: "#6b6559" }}>
              {error.notFound
                ? "This listing doesn't exist, or it hasn't been verified yet."
                : error.message}
            </p>
            <Link href="/dashboard">← Back to listings</Link>
          </>
        ) : (
          <p style={{ color: "#6b6559" }}>Loading listing…</p>
        )}
      </div>
    </div>
  );
}
