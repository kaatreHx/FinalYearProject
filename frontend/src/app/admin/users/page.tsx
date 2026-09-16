import AdminPageHeader from "@/components/admin/AdminPageHeader";
import tableStyles from "@/components/admin/AdminTable.module.css";
import { getPropertiesByOwner, MOCK_PROPERTIES } from "@/lib/properties";
import { MOCK_PURCHASE_REQUESTS } from "@/lib/purchaseRequests";
import { MOCK_USERS, formatJoinedDate } from "@/lib/users";

export default function AdminUsersPage() {
  return (
    <div>
      <AdminPageHeader
        title="Users"
        description={`${MOCK_USERS.length} accounts — sellers and buyers on the platform.`}
      />

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Activity</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((user) => {
              const activity =
                user.role === "seller"
                  ? `${getPropertiesByOwner(MOCK_PROPERTIES, user.id).length} listing(s)`
                  : `${
                      MOCK_PURCHASE_REQUESTS.filter(
                        (r) => r.buyerEmail === user.email
                      ).length
                    } request(s)`;

              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td className={tableStyles.muted}>{user.email}</td>
                  <td>
                    <span
                      className={tableStyles.tag}
                      data-tone={user.role === "seller" ? "seller" : undefined}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className={tableStyles.muted}>{activity}</td>
                  <td className={tableStyles.muted}>
                    {formatJoinedDate(user.joinedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
