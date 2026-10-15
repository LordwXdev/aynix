import { useState } from "react";
import { api } from "../api/client";
import type { Paged, User } from "../api/types";
import { Badge } from "../components/Badge";
import { Confirm, PendingConfirm } from "../components/Confirm";
import { Pager } from "../components/Pager";
import { SearchBox } from "../components/SearchBox";
import { StatusTabs } from "../components/StatusTabs";
import { useAction } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";
import { dateTime, humanize } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useFilters } from "../lib/useFilters";

export const Users = () => {
  const { user: me } = useAuth();
  const { values, page, set } = useFilters(["role", "q"]);
  const run = useAction();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const { data, error, reload } = useAsync(
    () => api.get<Paged<User>>("/api/admin/users", { ...values, page, limit: 20 }),
    [values.role, values.q, page]
  );

  const setActive = (user: User, isActive: boolean) =>
    setConfirm({
      title: isActive ? `Unban ${user.name}?` : `Ban ${user.name}?`,
      message: isActive
        ? "They will be able to log in again."
        : "They are logged out on every device and cannot log in. Drivers stop getting jobs.",
      confirmLabel: isActive ? "Unban" : "Ban user",
      danger: !isActive,
      run: async () => {
        if (await run(() => api.patch(`/api/admin/users/${user.id}/active`, { isActive }), isActive ? "User unbanned" : "User banned")) {
          await reload();
        }
      },
    });

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
      </div>
      <div className="toolbar">
        <StatusTabs
          label="Role"
          options={["CUSTOMER", "VENDOR", "DRIVER", "ADMIN"]}
          value={values.role}
          onChange={(role) => set({ role })}
        />
        <SearchBox value={values.q} placeholder="Name, phone or email" onSearch={(q) => set({ q })} />
      </div>
      <div className="card">
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    {u.email && <div className="small muted">{u.email}</div>}
                  </td>
                  <td className="mono">{u.phone}</td>
                  <td>{humanize(u.role)}</td>
                  <td>{u.isActive ? <Badge status="ACTIVE" /> : <Badge status="BANNED" />}</td>
                  <td className="muted">{dateTime(u.createdAt)}</td>
                  <td className="num">
                    {u.id !== me?.id &&
                      (u.isActive ? (
                        <button className="btn sm danger" onClick={() => setActive(u, false)}>
                          Ban
                        </button>
                      ) : (
                        <button className="btn sm" onClick={() => setActive(u, true)}>
                          Unban
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && <div className="empty">No users found</div>}
        </div>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {confirm && (
        <Confirm {...confirm} onConfirm={confirm.run} onClose={() => setConfirm(null)} />
      )}
    </>
  );
};
