import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultModels = [
  {
    id: 'model-1',
    labelEn: 'Female, petite, 155 cm',
    labelRu: 'Женщина, миниатюрная, 155 см',
    gender: 'female',
    bodyType: 'petite',
    heightCm: 155,
    weightKg: 45,
    imageUrl: '/ai-try-on/models/model1.png',
    sortOrder: 10,
  },
  {
    id: 'model-2',
    labelEn: 'Female, slim, 170 cm',
    labelRu: 'Женщина, худощавая, 170 см',
    gender: 'female',
    bodyType: 'slim',
    heightCm: 170,
    weightKg: 52,
    imageUrl: '/ai-try-on/models/model2.png',
    sortOrder: 20,
  },
  {
    id: 'model-3',
    labelEn: 'Female, average, 165 cm',
    labelRu: 'Женщина, обычное телосложение, 165 см',
    gender: 'female',
    bodyType: 'average',
    heightCm: 165,
    weightKg: 60,
    imageUrl: '/ai-try-on/models/model3.png',
    sortOrder: 30,
  },
  {
    id: 'model-4',
    labelEn: 'Female, curvy, 170 cm',
    labelRu: 'Женщина, пышная фигура, 170 см',
    gender: 'female',
    bodyType: 'curvy',
    heightCm: 170,
    weightKg: 72,
    imageUrl: '/ai-try-on/models/model4.png',
    sortOrder: 40,
  },
  {
    id: 'model-5',
    labelEn: 'Female, plus size, 175 cm',
    labelRu: 'Женщина, plus size, 175 см',
    gender: 'female',
    bodyType: 'plus-size',
    heightCm: 175,
    weightKg: 85,
    imageUrl: '/ai-try-on/models/model5.png',
    sortOrder: 50,
  },
  {
    id: 'model-6',
    labelEn: 'Male, slim, 180 cm',
    labelRu: 'Мужчина, худощавый, 180 см',
    gender: 'male',
    bodyType: 'slim',
    heightCm: 180,
    weightKg: 68,
    imageUrl: '/ai-try-on/models/model6.png',
    sortOrder: 60,
  },
  {
    id: 'model-7',
    labelEn: 'Male, average, 178 cm',
    labelRu: 'Мужчина, обычное телосложение, 178 см',
    gender: 'male',
    bodyType: 'average',
    heightCm: 178,
    weightKg: 78,
    imageUrl: '/ai-try-on/models/model7.png',
    sortOrder: 70,
  },
  {
    id: 'model-8',
    labelEn: 'Male, athletic, 185 cm',
    labelRu: 'Мужчина, атлетичное телосложение, 185 см',
    gender: 'male',
    bodyType: 'athletic',
    heightCm: 185,
    weightKg: 88,
    imageUrl: '/ai-try-on/models/model8.png',
    sortOrder: 80,
  },
  {
    id: 'model-9',
    labelEn: 'Male, heavy, 182 cm',
    labelRu: 'Мужчина, крупное телосложение, 182 см',
    gender: 'male',
    bodyType: 'heavy',
    heightCm: 182,
    weightKg: 105,
    imageUrl: '/ai-try-on/models/model9.png',
    sortOrder: 90,
  },
  {
    id: 'model-10',
    labelEn: 'Male, solid, 188 cm',
    labelRu: 'Мужчина, плотное телосложение, 188 см',
    gender: 'male',
    bodyType: 'solid',
    heightCm: 188,
    weightKg: 92,
    imageUrl: '/ai-try-on/models/model10.png',
    sortOrder: 100,
  },
];

async function main() {
  console.log('Seeding AI Try-On Models...');
  for (const m of defaultModels) {
    await prisma.aiTryOnModel.upsert({
      where: { id: m.id },
      update: {
        labelEn: m.labelEn,
        labelRu: m.labelRu,
        gender: m.gender,
        bodyType: m.bodyType,
        heightCm: m.heightCm,
        weightKg: m.weightKg,
        imageUrl: m.imageUrl,
        sortOrder: m.sortOrder,
        isActive: true,
      },
      create: {
        id: m.id,
        labelEn: m.labelEn,
        labelRu: m.labelRu,
        gender: m.gender,
        bodyType: m.bodyType,
        heightCm: m.heightCm,
        weightKg: m.weightKg,
        imageUrl: m.imageUrl,
        sortOrder: m.sortOrder,
        isActive: true,
      },
    });
  }
  console.log('AI Try-On Models seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding AI Try-On Models:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
