import type { Property } from "@/types/property";
import PropertyCard from "./PropertyCard";
import styles from "./PropertyGrid.module.css";

interface PropertyGridProps {
  properties: Property[];
}

export default function PropertyGrid({ properties }: PropertyGridProps) {
  if (properties.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No listings match those filters</p>
        <p className={styles.emptyBody}>
          Try widening your price range or clearing a filter.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
