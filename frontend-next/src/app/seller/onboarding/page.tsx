"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getSellerOnboardingProfile,
  listSellerDocuments,
  updateSellerOnboardingProfile,
  uploadSellerDocument,
  type LegalType,
  type SellerDocument,
  type SellerDocumentType,
  type SellerOnboardingProfile,
} from "@/lib/seller-onboarding-api";

const legalTypes: LegalType[] = ["INDIVIDUAL", "IP", "LLC", "OTHER"];
const documentTypes: SellerDocumentType[] = ["PASSPORT", "INN", "OGRN", "COMPANY_REGISTRATION", "BANK_DETAILS", "OTHER"];

const emptyProfile = {
  legalType: "IP" as LegalType,
  legalName: "",
  inn: "",
  ogrn: "",
  kpp: "",
  legalAddress: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  bankName: "",
  bankAccount: "",
  bik: "",
};

export default function SellerOnboardingPage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [approval, setApproval] = useState<Pick<SellerOnboardingProfile, "sellerApprovalStatus" | "sellerRejectionReason"> | null>(null);
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [documentType, setDocumentType] = useState<SellerDocumentType>("INN");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const [profileResult, documentResult] = await Promise.all([
          getSellerOnboardingProfile(),
          listSellerDocuments(),
        ]);
        if (!mounted) return;
        setProfile({
          legalType: profileResult.legalType ?? "IP",
          legalName: profileResult.legalName ?? "",
          inn: profileResult.inn ?? "",
          ogrn: profileResult.ogrn ?? "",
          kpp: profileResult.kpp ?? "",
          legalAddress: profileResult.legalAddress ?? "",
          contactName: profileResult.contactName ?? "",
          contactPhone: profileResult.contactPhone ?? "",
          contactEmail: profileResult.contactEmail ?? "",
          bankName: profileResult.bankName ?? "",
          bankAccount: profileResult.bankAccount ?? "",
          bik: profileResult.bik ?? "",
        });
        setApproval({
          sellerApprovalStatus: profileResult.sellerApprovalStatus,
          sellerRejectionReason: profileResult.sellerRejectionReason,
        });
        setDocuments(documentResult);
        setError(null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load onboarding.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateSellerOnboardingProfile(profile);
      setApproval({
        sellerApprovalStatus: updated.sellerApprovalStatus,
        sellerRejectionReason: updated.sellerRejectionReason,
      });
      setMessage("Onboarding profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save onboarding profile.");
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async () => {
    if (!file) {
      setError("Choose a document file first.");
      return;
    }
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      const uploaded = await uploadSellerDocument(documentType, file);
      setDocuments((current) => [uploaded, ...current]);
      setFile(null);
      setMessage("Document uploaded for review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const setField = (field: keyof typeof emptyProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="space-y-6" data-testid="seller-onboarding-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Seller verification</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
              Onboarding and KYC documents
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Complete legal profile details and upload verification documents before admin approval.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Approval status</p>
            <p className="mt-1 font-bold text-[var(--foreground)]" data-testid="seller-onboarding-status">
              {approval?.sellerApprovalStatus ?? "Loading"}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {approval?.sellerApprovalStatus === "REJECTED"
                ? "Review the rejection note, update onboarding details, and re-upload any required documents."
                : approval?.sellerApprovalStatus === "APPROVED"
                  ? "Seller approval is active. Marketplace tools are available."
                  : "Complete profile details and add at least one verification document before admin approval."}
            </p>
          </div>
        </div>
        {approval?.sellerApprovalStatus === "REJECTED" && approval.sellerRejectionReason ? (
          <div className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            {approval.sellerRejectionReason}
          </div>
        ) : null}
      </section>

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

      <form onSubmit={(event) => void saveProfile(event)} className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
            <span>Legal type</span>
            <select
              value={profile.legalType}
              onChange={(event) => setField("legalType", event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              data-testid="seller-legal-type"
            >
              {legalTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <ProfileInput label="Legal name" value={profile.legalName} onChange={(value) => setField("legalName", value)} testId="seller-legal-name" />
          <ProfileInput label="INN" value={profile.inn} onChange={(value) => setField("inn", value)} testId="seller-inn" />
          <ProfileInput label="OGRN / OGRNIP" value={profile.ogrn} onChange={(value) => setField("ogrn", value)} testId="seller-ogrn" />
          <ProfileInput label="KPP" value={profile.kpp} onChange={(value) => setField("kpp", value)} testId="seller-kpp" />
          <ProfileInput label="Legal address" value={profile.legalAddress} onChange={(value) => setField("legalAddress", value)} testId="seller-legal-address" />
          <ProfileInput label="Contact name" value={profile.contactName} onChange={(value) => setField("contactName", value)} testId="seller-contact-name" />
          <ProfileInput label="Contact phone" value={profile.contactPhone} onChange={(value) => setField("contactPhone", value)} testId="seller-contact-phone" />
          <ProfileInput label="Contact email" value={profile.contactEmail} onChange={(value) => setField("contactEmail", value)} testId="seller-contact-email" />
          <ProfileInput label="Bank name" value={profile.bankName} onChange={(value) => setField("bankName", value)} testId="seller-bank-name" />
          <ProfileInput label="Bank account" value={profile.bankAccount} onChange={(value) => setField("bankAccount", value)} testId="seller-bank-account" />
          <ProfileInput label="BIK" value={profile.bik} onChange={(value) => setField("bik", value)} testId="seller-bik" />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={loading || saving}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="seller-onboarding-save"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="w-full space-y-2 text-sm font-semibold text-[var(--foreground)] lg:max-w-xs">
            <span>Document type</span>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as SellerDocumentType)}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              data-testid="seller-document-type"
            >
              {documentTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="w-full space-y-2 text-sm font-semibold text-[var(--foreground)]">
            <span>Document file</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              data-testid="seller-document-input"
            />
          </label>
          <button
            type="button"
            onClick={() => void uploadDocument()}
            disabled={uploading}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="seller-document-upload"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-[var(--border)]">
          {documents.length ? (
            documents.map((document) => (
              <div key={document.id} className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[1fr_140px_1.2fr]" data-testid="seller-document-row">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{document.originalName ?? document.documentType}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{document.documentType}</p>
                </div>
                <span className="w-fit rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                  {document.status}
                </span>
                <p className="text-sm text-[var(--muted)]">{document.rejectionReason ?? (document.reviewedAt ? `Reviewed ${new Date(document.reviewedAt).toLocaleDateString()}` : "Awaiting admin review")}</p>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-[var(--muted)]">No documents uploaded yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileInput({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
        data-testid={testId}
      />
    </label>
  );
}
