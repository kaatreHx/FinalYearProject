import styles from "./AdminPageHeader.module.css";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
}

export default function AdminPageHeader({ title, description }: AdminPageHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
