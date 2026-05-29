"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { useI18n } from "@/i18n/use-i18n";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type AdminUser,
} from "@/lib/admin-api";
import { useAuthStore } from "@/stores/auth-store";

export function AdminUsersPageClient() {
  const { t } = useI18n("admin");
  const loggedInAdmin = useAuthStore((state) => state.adminUser);

  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  // Modal / Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userRole, setUserRole] = useState<"ADMIN" | "SELLER" | "CUSTOMER">("CUSTOMER");
  const [userStatus, setUserStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getAdminUsers({
        search: search.trim() || undefined,
        role: role !== "ALL" ? role : undefined,
        status: status !== "ALL" ? status : undefined,
        page,
        limit,
      });
      setItems(response.items);
      setTotalPages(response.meta.totalPages);
      setTotalItems(response.meta.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers();
    }, 200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, status, page]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setUserRole("CUSTOMER");
    setUserStatus("ACTIVE");
    setPassword("");
    setResetPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFullName(user.fullName || "");
    setEmail(user.email);
    setPhone(user.phone || "");
    setUserRole(user.role as "ADMIN" | "SELLER" | "CUSTOMER");
    setUserStatus(user.status as "ACTIVE" | "DISABLED");
    setPassword("");
    setResetPassword(false);
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }

    if (!editingUser && !password.trim()) {
      toast.error("Password is required for new users.");
      return;
    }

    if (!editingUser && password.length < 6) {
      toast.error(t("errors.PASSWORD_TOO_SHORT") || "Password must be at least 6 characters.");
      return;
    }

    if (editingUser && resetPassword && password.length < 6) {
      toast.error(t("errors.PASSWORD_TOO_SHORT") || "Password must be at least 6 characters.");
      return;
    }

    // Security Guards
    if (editingUser && editingUser.id === loggedInAdmin?.id) {
      if (userRole !== "ADMIN") {
        toast.error(t("adminUsers.cannotDemoteSelf") || "You cannot demote yourself from the admin role.");
        return;
      }
      if (userStatus !== "ACTIVE") {
        toast.error(t("adminUsers.cannotDisableSelf") || "You cannot disable your own admin account.");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingUser) {
        await updateAdminUser(editingUser.id, {
          fullName: fullName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          role: userRole,
          status: userStatus,
          password: resetPassword && password.trim() ? password : undefined,
        });
        toast.success(t("adminUsers.userUpdated") || "User updated.");
      } else {
        await createAdminUser({
          fullName: fullName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          role: userRole,
          status: userStatus,
          password,
        });
        toast.success(t("adminUsers.userCreated") || "User created.");
      }
      setIsModalOpen(false);
      void fetchUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save user";
      const mappedErr = t(`errors.${msg}`) || msg;
      toast.error(mappedErr);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (user.id === loggedInAdmin?.id) {
      toast.error(t("adminUsers.cannotDeleteSelf") || "You cannot delete your own account.");
      return;
    }

    const confirmMsg = t("adminUsers.confirmDelete") || "Are you sure you want to delete this user?";
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteAdminUser(user.id);
      toast.success(t("adminUsers.userDeleted") || "User deleted.");
      void fetchUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      const mappedErr = t(`errors.${msg}`) || msg;
      toast.error(mappedErr);
    }
  };

  const handleDisable = async (user: AdminUser) => {
    if (user.id === loggedInAdmin?.id) {
      toast.error(t("adminUsers.cannotDisableSelf") || "You cannot disable your own admin account.");
      return;
    }

    const confirmMsg = t("adminUsers.confirmDisable") || "Are you sure you want to disable this user?";
    if (!window.confirm(confirmMsg)) return;

    try {
      await updateAdminUser(user.id, {
        status: "DISABLED",
      });
      toast.success(t("adminUsers.userDisabled") || "User disabled.");
      void fetchUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to disable user";
      const mappedErr = t(`errors.${msg}`) || msg;
      toast.error(mappedErr);
    }
  };

  const renderRoleBadge = (roleVal: string) => {
    switch (roleVal) {
      case "ADMIN":
        return (
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            ADMIN
          </span>
        );
      case "SELLER":
        return (
          <span className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
            SELLER
          </span>
        );
      case "CUSTOMER":
        return (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            CUSTOMER
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {roleVal}
          </span>
        );
    }
  };

  const renderStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case "ACTIVE":
        return (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            {t("adminUsers.active") || "Active"}
          </span>
        );
      case "DISABLED":
        return (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            {t("adminUsers.disabled") || "Disabled"}
          </span>
        );
      case "DELETED":
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            {t("adminUsers.deleted") || "Deleted"}
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            {statusVal}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      {/* Title Card */}
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("adminShell.badge") || "Admin"}
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
            {t("adminUsers.title") || "User management"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("adminUsers.title") || "User management"}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer"
          data-testid="add-user-btn"
        >
          {t("adminUsers.addUser") || "Add user"}
        </button>
      </section>

      {/* Filters block */}
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("adminUsers.searchUsers") || "Search users"}
            className="min-w-[280px] rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="admin-users-search"
          />
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="admin-users-role-filter"
          >
            <option value="ALL">{t("adminUsers.allRoles") || "All roles"}</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SELLER">SELLER</option>
            <option value="CUSTOMER">CUSTOMER</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="admin-users-status-filter"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">{t("adminUsers.active") || "Active"}</option>
            <option value="DISABLED">{t("adminUsers.disabled") || "Disabled"}</option>
            <option value="DELETED">{t("adminUsers.deleted") || "Deleted"}</option>
          </select>
        </div>
      </section>

      {error && (
        <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Main Table view */}
      {loading ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
          Loading users...
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 text-sm text-center text-[var(--muted)]" data-testid="admin-users-empty-state">
          {t("adminUsers.noUsersFound") || "No users found."}
        </section>
      ) : (
        <div className="space-y-4">
          <section className="rounded-[1.5rem] border border-[var(--border)] bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" data-testid="users-table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">{t("adminUsers.id") || "ID"}</th>
                    <th className="px-6 py-4">{t("adminUsers.fullName") || "Full name"}</th>
                    <th className="px-6 py-4">{t("adminUsers.email") || "Email"}</th>
                    <th className="px-6 py-4">{t("adminUsers.phone") || "Phone"}</th>
                    <th className="px-6 py-4">{t("adminUsers.role") || "Role"}</th>
                    <th className="px-6 py-4">{t("adminUsers.status") || "Status"}</th>
                    <th className="px-6 py-4">{t("adminUsers.createdAt") || "Created at"}</th>
                    <th className="px-6 py-4 text-right">{t("adminUsers.actions") || "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {items.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors" data-testid="user-row">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-400">
                        {user.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">
                        {user.fullName || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {user.phone || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition cursor-pointer"
                          data-testid="edit-user-action"
                        >
                          {t("adminUsers.editUser") || "Edit"}
                        </button>
                        {user.status === "ACTIVE" && (
                          <button
                            onClick={() => void handleDisable(user)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition cursor-pointer"
                            data-testid="disable-user-action"
                          >
                            {t("adminUsers.disableUser") || "Disable"}
                          </button>
                        )}
                        <button
                          onClick={() => void handleDelete(user)}
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          data-testid="delete-user-action"
                        >
                          {t("adminUsers.deleteUser") || "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[var(--border)]">
              <div className="text-xs text-slate-500">
                Showing page <span className="font-semibold">{page}</span> of{" "}
                <span className="font-semibold">{totalPages}</span> ({totalItems} total users)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                  data-testid="pagination-prev"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                  data-testid="pagination-next"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Add / Edit Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="user-form-modal">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-2xl flex flex-col z-10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <h3 className="text-xl font-bold text-slate-800" data-testid="modal-title">
                {editingUser ? t("adminUsers.editUser") : t("adminUsers.addUser")}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                aria-label="Close form"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-6 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  {t("adminUsers.fullName") || "Full Name"}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                  data-testid="input-fullName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  {t("adminUsers.email") || "Email"} *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                  data-testid="input-email"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  {t("adminUsers.phone") || "Phone"}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+79991234567"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                  data-testid="input-phone"
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    {t("adminUsers.role") || "Role"}
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as "ADMIN" | "SELLER" | "CUSTOMER")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-role"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="SELLER">SELLER</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    {t("adminUsers.status") || "Status"}
                  </label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value as "ACTIVE" | "DISABLED")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-status"
                  >
                    <option value="ACTIVE">{t("adminUsers.active") || "Active"}</option>
                    <option value="DISABLED">{t("adminUsers.disabled") || "Disabled"}</option>
                  </select>
                </div>
              </div>

              {/* Password controls */}
              {!editingUser ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    {t("adminUsers.password") || "Password"} *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-password"
                  />
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="resetPasswordCheckbox"
                      checked={resetPassword}
                      onChange={(e) => setResetPassword(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                      data-testid="checkbox-reset-password"
                    />
                    <label htmlFor="resetPasswordCheckbox" className="ml-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      Reset Password?
                    </label>
                  </div>
                  {resetPassword && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        {t("adminUsers.newPassword") || "New Password"}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={resetPassword}
                        placeholder="Min 6 characters"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                        data-testid="input-new-password"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition"
                  data-testid="submit-user-btn"
                >
                  {saving ? "Saving..." : t("adminUsers.saveUser") || "Save user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
