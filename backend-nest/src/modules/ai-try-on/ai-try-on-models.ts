export type BuiltInTryOnModel = {
  modelId: string;
  gender: 'male' | 'female' | 'other';
  bodyType: 'slim' | 'regular' | 'large';
  heightCm: number;
  imageUrl: string;
  labelRu: string;
  labelEn: string;
};

export const BUILT_IN_TRY_ON_MODELS: BuiltInTryOnModel[] = [
  {
    modelId: 'female_slim_168',
    gender: 'female',
    bodyType: 'slim',
    heightCm: 168,
    imageUrl: '/demo/try-on-model-female-slim.png',
    labelRu: 'Женщина, худощавое, 168 см',
    labelEn: 'Female, slim, 168 cm',
  },
  {
    modelId: 'female_regular_165',
    gender: 'female',
    bodyType: 'regular',
    heightCm: 165,
    imageUrl: '/demo/try-on-model-female-regular.png',
    labelRu: 'Женщина, обычное, 165 см',
    labelEn: 'Female, regular, 165 cm',
  },
  {
    modelId: 'male_regular_175',
    gender: 'male',
    bodyType: 'regular',
    heightCm: 175,
    imageUrl: '/demo/try-on-model-male-regular.png',
    labelRu: 'Мужчина, обычное, 175 см',
    labelEn: 'Male, regular, 175 cm',
  },
  {
    modelId: 'male_large_178',
    gender: 'male',
    bodyType: 'large',
    heightCm: 178,
    imageUrl: '/demo/try-on-model-male-large.png',
    labelRu: 'Мужчина, плотное, 178 см',
    labelEn: 'Male, large, 178 cm',
  },
];

export function findBuiltInTryOnModel(modelId?: string | null) {
  if (!modelId) {
    return null;
  }

  return (
    BUILT_IN_TRY_ON_MODELS.find((model) => model.modelId === modelId) ?? null
  );
}
