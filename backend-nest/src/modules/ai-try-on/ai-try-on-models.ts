export type BuiltInTryOnModel = {
  modelId: string;
  gender: 'male' | 'female' | 'other';
  bodyType: string;
  heightCm: number;
  weightKg: number;
  imageUrl: string;
  labelRu: string;
  labelEn: string;
};

/** @deprecated Load models dynamically from database instead */
export const BUILT_IN_TRY_ON_MODELS: BuiltInTryOnModel[] = [];

/** @deprecated Load models dynamically from database instead */
export function findBuiltInTryOnModel() {
  return null;
}
