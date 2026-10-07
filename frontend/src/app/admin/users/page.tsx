import AdminPageHeader from "@/components/admin/AdminPageHeader";
import tableStyles from "@/components/admin/AdminTable.module.css";

// The backend has no "list users" endpoint yet (admin module is empty), and
// the mock data this page used to read is gone from lib/users.ts. Once an
// endpoint like GET /admin/users exists, fetch it here and render the table.
export default function AdminUsersPage() {
  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Sellers and buyers on the platform."
      />
      <div className={tableStyles.tableWrap}>
        <p className={tableStyles.emptyState}>
          User management isn&apos;t connected yet — the backend doesn&apos;t expose a users list.
        </p>
      </div>
    </div>
  );
}
