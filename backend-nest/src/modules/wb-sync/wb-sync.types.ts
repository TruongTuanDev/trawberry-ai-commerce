export type WbSyncMode = 'PREVIEW' | 'IMPORT';
export type WbSyncType = 'ALL_PRODUCTS' | 'BY_ARTICLE' | 'BY_CODES';
export type WbPublishMode = 'DRAFT' | 'ACTIVE_IF_VALID';
export type WbImageMode = 'REMOTE_URL';
export type WbApiSourceMode = 'mock' | 'real';
export type WbSafeErrorCode =
  | 'WB_BAD_REQUEST_400'
  | 'WB_UNAUTHORIZED_401'
  | 'WB_FORBIDDEN_403'
  | 'WB_RATE_LIMIT_429'
  | 'WB_EMPTY_RESPONSE'
  | 'WB_NETWORK_TIMEOUT'
  | 'WB_NETWORK_ERROR'
  | 'WB_CREDENTIAL_MISSING'
  | 'WB_CREDENTIAL_DECRYPT_FAILED'
  | 'WB_MOCK_MODE_ACTIVE'
  | 'WB_CONFIG_MISSING';

export type WbSyncIssue = {
  level: 'WARNING' | 'ERROR';
  code: string;
  message: string;
  article?: string | null;
  nmID?: number | null;
};

export type WbCardPhoto = {
  big?: string;
  c516x688?: string;
  c246x328?: string;
  hq?: string;
  square?: string;
  tm?: string;
};

export type WbCardSize = {
  chrtID?: number;
  techSize?: string;
  wbSize?: string;
  skus?: string[];
};

export type WbCardCharacteristic = {
  id?: number;
  name?: string;
  value?: unknown;
};

export type WbCard = {
  nmID?: number;
  imtID?: number;
  nmUUID?: string;
  subjectID?: number;
  subjectName?: string;
  vendorCode?: string;
  brand?: string;
  title?: string;
  description?: string;
  video?: string;
  needKiz?: boolean;
  createdAt?: string;
  updatedAt?: string;
  photos?: WbCardPhoto[];
  dimensions?: {
    width?: number;
    height?: number;
    length?: number;
    weightBrutto?: number;
    isValid?: boolean;
  };
  characteristics?: WbCardCharacteristic[];
  sizes?: WbCardSize[];
  wholesale?: { enabled?: boolean; quantum?: number };
};

export type WbCardsResponse = {
  cards: WbCard[];
  cursor?: { updatedAt?: string; nmID?: number; total?: number };
};

export type WbFetchCardsOptions = {
  apiKey: string | null;
  limit: number;
  article?: string;
  nmIds?: string[];
};

export type WbFetchCardsResult = {
  cards: WbCard[];
  mode: WbApiSourceMode;
  pagesFetched: number;
  fetchedCount: number;
  scannedCount: number;
  cursor?: { updatedAt?: string; nmID?: number; total?: number };
};

export type WbConnectionVerifyResult = {
  success: true;
  mode: WbApiSourceMode;
  fetched: number;
  message: string;
};

export type WbDiagnosticsResult = {
  mode: WbApiSourceMode;
  shopId: string;
  hasCredential: boolean;
  connected: boolean;
  keyLast4: string | null;
  lastVerifiedAt: string | null;
  lastVerificationStatus: 'SUCCESS' | 'FAILED' | 'NOT_VERIFIED';
  lastVerificationError: string | null;
  canAttemptRealVerify: boolean;
  missingConfig: string[];
};

export type WbMappedVariant = {
  chrtId: bigint;
  sellerSku: string | null;
  wbBarcode: string | null;
  sizeName: string | null;
  russianSize: string | null;
};

export type WbMappedProduct = {
  source: 'WILDBERRIES_API';
  externalProductId: string | null;
  sellerSku: string | null;
  wbNmId: bigint;
  wbImtId: bigint | null;
  wbNmUuid: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
  categoryId: string | null;
  mappedCategoryName: string | null;
  sourceCategoryName: string | null;
  subjectId: bigint | null;
  videoUrl: string | null;
  needKiz: boolean | null;
  dimensions: {
    width: number | null;
    height: number | null;
    length: number | null;
    weightBrutto: number | null;
    isValid: boolean | null;
  };
  characteristics: {
    gender: string | null;
    composition: string | null;
    color: string | null;
  };
  variants: WbMappedVariant[];
  images: Array<{ url: string; isMain: boolean; sortOrder: number }>;
  warnings: WbSyncIssue[];
  errors: WbSyncIssue[];
};
