import { notFound } from "next/navigation";
import PropertyDetailView from "@/components/property/PropertyDetailView";
import { MOCK_PROPERTIES } from "@/lib/properties";

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;
  const property = MOCK_PROPERTIES.find((p) => p.id === id);

  if (!property) {
    notFound();
  }

  return <PropertyDetailView property={property} />;
}
