export type SellerNextStep =
  | 'COMPLETE_ONBOARDING'
  | 'WAIT_FOR_APPROVAL'
  | 'CONTACT_SUPPORT'
  | 'APPROVED';

type SellerStateInput = {
  approvalStatus?: string | null;
  rejectionReason?: string | null;
  legalType?: string | null;
  legalName?: string | null;
  inn?: string | null;
  legalAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bik?: string | null;
  documentCount?: number;
};

export function isSellerOnboardingComplete(profile: SellerStateInput) {
  const requiredTextFields = [
    profile.legalType,
    profile.legalName,
    profile.inn,
    profile.legalAddress,
    profile.contactName,
    profile.contactPhone,
    profile.contactEmail,
    profile.bankName,
    profile.bankAccount,
    profile.bik,
  ];

  return (
    requiredTextFields.every((value) => Boolean(value?.trim())) &&
    (profile.documentCount ?? 0) > 0
  );
}

export function resolveSellerNextStep(
  profile: SellerStateInput,
): SellerNextStep {
  if (profile.approvalStatus === 'APPROVED') {
    return 'APPROVED';
  }

  if (profile.approvalStatus === 'REJECTED') {
    return 'CONTACT_SUPPORT';
  }

  if (!isSellerOnboardingComplete(profile)) {
    return 'COMPLETE_ONBOARDING';
  }

  return 'WAIT_FOR_APPROVAL';
}
