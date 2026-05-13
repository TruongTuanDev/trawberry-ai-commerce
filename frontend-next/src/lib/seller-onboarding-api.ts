import { apiRequest } from "@/lib/api";

export type LegalType = "INDIVIDUAL" | "IP" | "LLC" | "OTHER";
export type SellerDocumentType = "PASSPORT" | "INN" | "OGRN" | "COMPANY_REGISTRATION" | "BANK_DETAILS" | "OTHER";
export type SellerDocumentStatus = "PENDING" | "APPROVED" | "REJECTED";

export type SellerOnboardingProfile = {
  userId: string;
  sellerApprovalStatus: string;
  sellerRejectionReason: string | null;
  legalType: LegalType | null;
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  kpp: string | null;
  legalAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bik: string | null;
  updatedAt: string;
};

export type SellerDocument = {
  id: string;
  userId: string;
  documentType: SellerDocumentType;
  url: string;
  storageKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  status: SellerDocumentStatus;
  rejectionReason: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
};

export type UpdateSellerOnboardingProfileInput = {
  legalType?: LegalType;
  legalName?: string;
  inn?: string;
  ogrn?: string;
  kpp?: string;
  legalAddress?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  bankName?: string;
  bankAccount?: string;
  bik?: string;
};

export async function getSellerOnboardingProfile() {
  return apiRequest<SellerOnboardingProfile>("/api/seller/onboarding/profile", {
    method: "GET",
  });
}

export async function updateSellerOnboardingProfile(input: UpdateSellerOnboardingProfileInput) {
  return apiRequest<SellerOnboardingProfile>("/api/seller/onboarding/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function listSellerDocuments() {
  return apiRequest<SellerDocument[]>("/api/seller/onboarding/documents", {
    method: "GET",
  });
}

export async function uploadSellerDocument(documentType: SellerDocumentType, file: File) {
  const formData = new FormData();
  formData.append("documentType", documentType);
  formData.append("file", file);

  return apiRequest<SellerDocument>("/api/seller/onboarding/documents", {
    method: "POST",
    body: formData,
  });
}
