import DashboardNav from "@/components/property/DashboardNav";
import SellerSubNav from "@/components/seller/SellerSubNav";
import ListPropertyForm from "@/components/seller/ListPropertyForm";
import styles from "./page.module.css";

export default function NewListingPage() {
  return (
    <div className={styles.page}>
      <DashboardNav userName="Asha Gurung" hideCart />
      <SellerSubNav />

      <div className={styles.body}>
        <div className={styles.header}>
          <h1 className={styles.heading}>List a property</h1>
          <p className={styles.subheading}>
            Add the details below and your listing goes live for buyers to
            browse and send purchase requests.
          </p>
        </div>

        <ListPropertyForm />
      </div>
    </div>
  );
}
