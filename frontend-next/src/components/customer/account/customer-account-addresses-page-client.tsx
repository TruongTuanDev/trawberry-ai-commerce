"use client";

import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { formatCustomerAddress } from "@/components/customer/account/customer-account-utils";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  type CustomerAddress,
  type CustomerAddressInput,
} from "@/lib/customer-api";
import { maybeNormalizePhone } from "@/lib/phone";

const emptyForm: CustomerAddressInput = {
  fullName: "",
  phone: "",
  city: "",
  region: "",
  street: "",
  apartment: "",
  postalCode: "",
  comment: "",
};

export function CustomerAccountAddressesPageClient() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerAddressInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAddresses = async () => {
    const response = await getCustomerAddresses();
    setAddresses(response.items);
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const response = await getCustomerAddresses();
        if (!mounted) {
          return;
        }
        setAddresses(response.items);
        setError(null);
      } catch (issue) {
        if (mounted) {
          setError(issue instanceof Error ? issue.message : "Unable to load addresses.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  const resetForm = () => {
    setEditingAddressId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...form,
        phone: maybeNormalizePhone(form.phone),
      };

      if (editingAddressId) {
        await updateCustomerAddress(editingAddressId, payload);
        setSuccess("Địa chỉ đã được cập nhật.");
      } else {
        await createCustomerAddress(payload);
        setSuccess("Địa chỉ mới đã được thêm.");
      }

      await loadAddresses();
      resetForm();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (address: CustomerAddress) => {
    setEditingAddressId(address.id);
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      city: address.city,
      region: address.region,
      street: address.street,
      apartment: address.apartment || "",
      postalCode: address.postalCode || "",
      comment: address.comment || "",
    });
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (addressId: string) => {
    setError(null);
    setSuccess(null);

    try {
      await deleteCustomerAddress(addressId);
      await loadAddresses();
      if (editingAddressId === addressId) {
        resetForm();
      }
      setSuccess("Địa chỉ đã được xoá.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to delete address.");
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setError(null);
    setSuccess(null);

    try {
      await setDefaultCustomerAddress(addressId);
      await loadAddresses();
      setSuccess("Địa chỉ mặc định đã được cập nhật.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to update default address.");
    }
  };

  return (
    <CustomerAccountShell
      title="Địa chỉ giao hàng"
      description="Lưu sổ địa chỉ giao hàng cho customer, đặt một địa chỉ mặc định và tái sử dụng địa chỉ đó trong checkout khi cần."
    >
      {error ? (
        <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="card-panel rounded-[1.8rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Sổ địa chỉ
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                Danh sách địa chỉ đã lưu
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4" data-testid="customer-address-list">
            {loading ? (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--muted)]">
                Loading addresses...
              </div>
            ) : addresses.length ? (
              addresses.map((address) => (
                <article
                  key={address.id}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#fcf8ff_100%)] px-5 py-5"
                  data-testid="customer-address-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-[var(--foreground)]">
                          {address.fullName}
                        </p>
                        {address.isDefault ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{address.phone}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                        {formatCustomerAddress(address)}
                      </p>
                      {address.comment ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">{address.comment}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!address.isDefault ? (
                        <button
                          type="button"
                          onClick={() => void handleSetDefault(address.id)}
                          className="public-button-secondary px-4 py-2 text-sm"
                          data-testid={`customer-address-default-${address.id}`}
                        >
                          Đặt mặc định
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleEdit(address)}
                        className="public-button-secondary px-4 py-2 text-sm"
                        data-testid={`customer-address-edit-${address.id}`}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(address.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                        data-testid={`customer-address-delete-${address.id}`}
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-5 text-sm text-[var(--muted)]">
                Chưa có địa chỉ nào được lưu.
              </div>
            )}
          </div>
        </section>

        <section className="card-panel rounded-[1.8rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {editingAddressId ? "Chỉnh sửa" : "Thêm mới"}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {editingAddressId ? "Cập nhật địa chỉ" : "Thêm địa chỉ giao hàng"}
              </h2>
            </div>
            {editingAddressId ? (
              <button type="button" onClick={resetForm} className="public-button-secondary px-4 py-2 text-sm">
                Huỷ
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <AddressField label="Người nhận">
              <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="public-input" data-testid="customer-address-fullName" />
            </AddressField>
            <AddressField label="Số điện thoại">
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="public-input" placeholder="+7XXXXXXXXXX" data-testid="customer-address-phone" />
            </AddressField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AddressField label="Thành phố">
                <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="public-input" data-testid="customer-address-city" />
              </AddressField>
              <AddressField label="Khu vực / tỉnh">
                <input value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} className="public-input" data-testid="customer-address-region" />
              </AddressField>
            </div>
            <AddressField label="Đường / số nhà">
              <textarea value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} rows={3} className="public-input min-h-28" data-testid="customer-address-street" />
            </AddressField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AddressField label="Căn hộ / tầng">
                <input value={form.apartment || ""} onChange={(event) => setForm((current) => ({ ...current, apartment: event.target.value }))} className="public-input" data-testid="customer-address-apartment" />
              </AddressField>
              <AddressField label="Mã bưu chính">
                <input value={form.postalCode || ""} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className="public-input" data-testid="customer-address-postalCode" />
              </AddressField>
            </div>
            <AddressField label="Ghi chú giao hàng">
              <textarea value={form.comment || ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} rows={3} className="public-input min-h-24" data-testid="customer-address-comment" />
            </AddressField>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="public-button-primary mt-6 px-5 py-3 text-sm disabled:opacity-60"
            data-testid="customer-address-save"
          >
            {saving ? "Đang lưu..." : editingAddressId ? "Lưu cập nhật" : "Thêm địa chỉ"}
          </button>
        </section>
      </div>
    </CustomerAccountShell>
  );
}

function AddressField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
