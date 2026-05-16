export type WbImportIssueLevel = 'WARNING' | 'ERROR';

export type WbImportIssue = {
  level: WbImportIssueLevel;
  code: string;
  message: string;
  row?: number;
  sellerSku?: string | null;
};

export type WbImportImage = {
  url: string;
  isMain: boolean;
  sortOrder: number;
};

export type WbImportVariant = {
  rowNumber: number;
  sellerSku: string | null;
  wbBarcode: string | null;
  sizeName: string | null;
  russianSize: string | null;
  price: number | null;
  stockQuantity: number;
};

export type WbImportProduct = {
  groupKey: string;
  sellerSku: string | null;
  externalProductId: string | null;
  name: string;
  categoryName: string | null;
  categoryId: string | null;
  mappedCategoryName: string | null;
  sourceCategoryName: string | null;
  brand: string | null;
  description: string | null;
  videoUrl: string | null;
  needKiz: boolean | null;
  gender: string | null;
  composition: string | null;
  color: string | null;
  packageWeightGram: number | null;
  packageHeightCm: number | null;
  packageLengthCm: number | null;
  packageWidthCm: number | null;
  variants: WbImportVariant[];
  images: WbImportImage[];
  warnings: WbImportIssue[];
  errors: WbImportIssue[];
};

export type WbImportNormalizedPayload = {
  source: 'WILDBERRIES_EXCEL';
  totalRows: number;
  products: WbImportProduct[];
  warnings: WbImportIssue[];
  errors: WbImportIssue[];
};

export type WbImportConfirmResult = {
  importId: string;
  createdProducts: number;
  updatedProducts: number;
  createdVariants: number;
  updatedVariants: number;
  addedImages: number;
  skippedImages: number;
};
