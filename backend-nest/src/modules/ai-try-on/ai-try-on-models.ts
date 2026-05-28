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

export const BUILT_IN_TRY_ON_MODELS: BuiltInTryOnModel[] = [
  {
    modelId: 'model-1',
    gender: 'female',
    bodyType: 'petite',
    heightCm: 155,
    weightKg: 45,
    imageUrl: '/ai-try-on/models/model1.png',
    labelRu: 'Женщина, миниатюрная, 155 см',
    labelEn: 'Female, petite, 155 cm',
  },
  {
    modelId: 'model-2',
    gender: 'female',
    bodyType: 'slim',
    heightCm: 170,
    weightKg: 52,
    imageUrl: '/ai-try-on/models/model2.png',
    labelRu: 'Женщина, худощавая, 170 см',
    labelEn: 'Female, slim, 170 cm',
  },
  {
    modelId: 'model-3',
    gender: 'female',
    bodyType: 'average',
    heightCm: 165,
    weightKg: 60,
    imageUrl: '/ai-try-on/models/model3.png',
    labelRu: 'Женщина, обычное телосложение, 165 см',
    labelEn: 'Female, average, 165 cm',
  },
  {
    modelId: 'model-4',
    gender: 'female',
    bodyType: 'curvy',
    heightCm: 170,
    weightKg: 72,
    imageUrl: '/ai-try-on/models/model4.png',
    labelRu: 'Женщина, пышная фигура, 170 см',
    labelEn: 'Female, curvy, 170 cm',
  },
  {
    modelId: 'model-5',
    gender: 'female',
    bodyType: 'plus-size',
    heightCm: 175,
    weightKg: 85,
    imageUrl: '/ai-try-on/models/model5.png',
    labelRu: 'Женщина, plus size, 175 см',
    labelEn: 'Female, plus size, 175 cm',
  },
  {
    modelId: 'model-6',
    gender: 'male',
    bodyType: 'slim',
    heightCm: 180,
    weightKg: 68,
    imageUrl: '/ai-try-on/models/model6.png',
    labelRu: 'Мужчина, худощавый, 180 см',
    labelEn: 'Male, slim, 180 cm',
  },
  {
    modelId: 'model-7',
    gender: 'male',
    bodyType: 'average',
    heightCm: 178,
    weightKg: 78,
    imageUrl: '/ai-try-on/models/model7.png',
    labelRu: 'Мужчина, обычное телосложение, 178 см',
    labelEn: 'Male, average, 178 cm',
  },
  {
    modelId: 'model-8',
    gender: 'male',
    bodyType: 'athletic',
    heightCm: 185,
    weightKg: 88,
    imageUrl: '/ai-try-on/models/model8.png',
    labelRu: 'Мужчина, атлетичное телосложение, 185 см',
    labelEn: 'Male, athletic, 185 cm',
  },
  {
    modelId: 'model-9',
    gender: 'male',
    bodyType: 'heavy',
    heightCm: 182,
    weightKg: 105,
    imageUrl: '/ai-try-on/models/model9.png',
    labelRu: 'Мужчина, крупное телосложение, 182 см',
    labelEn: 'Male, heavy, 182 cm',
  },
  {
    modelId: 'model-10',
    gender: 'male',
    bodyType: 'solid',
    heightCm: 188,
    weightKg: 92,
    imageUrl: '/ai-try-on/models/model10.png',
    labelRu: 'Мужчина, плотное телосложение, 188 см',
    labelEn: 'Male, solid, 188 cm',
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
