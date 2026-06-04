const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { randomUUID } = require("node:crypto");

const prisma = new PrismaClient();

const DEMO_SELLER_EMAIL = "demo-seller@trawberry.local";
const DEMO_SELLER_PASSWORD = "DemoSeller123!";
const DEMO_ADMIN_EMAIL = "demo-admin@trawberry.local";
const DEMO_ADMIN_PASSWORD = "DemoAdmin123!";
const DEMO_CUSTOMER_EMAIL = "demo-customer@trawberry.local";
const DEMO_CUSTOMER_PASSWORD = "DemoCustomer123!";
const DEMO_SHOP_SLUG = "demo-marketplace-shop";
const DEMO_SHOP_NAME = "Demo Strawberry Store";
const DEMO_PAYMENT_INSTRUCTIONS =
  "Transfer to Demo Strawberry Store / AC 4100 1000 2000 and keep your order code in the payment note.";

const demoProducts = [
  {
    imageId: "11111111-1111-4111-8111-111111111111",
    wbNmId: BigInt(9100001),
    chrtId: BigInt(9200001),
    slug: "linen-bloom-dress",
    title: "Linen Bloom Dress",
    description:
      "Breathable day dress with a soft waistline, textured cotton-linen feel, and a warm neutral palette for marketplace demos.",
    brand: "Berry Atelier",
    categoryName: "Dresses",
    price: "79.00",
    imageLabel: "Linen Bloom",
  },
  {
    imageId: "22222222-2222-4222-8222-222222222222",
    wbNmId: BigInt(9100002),
    chrtId: BigInt(9200002),
    slug: "studio-canvas-jacket",
    title: "Studio Canvas Jacket",
    description:
      "Structured lightweight jacket designed for layered spring looks, with a polished silhouette and easy catalog photography styling.",
    brand: "North Market",
    categoryName: "Outerwear",
    price: "112.50",
    imageLabel: "Canvas Jacket",
  },
  {
    imageId: "33333333-3333-4333-8333-333333333333",
    wbNmId: BigInt(9100003),
    chrtId: BigInt(9200003),
    slug: "satin-night-set",
    title: "Satin Night Set",
    description:
      "Coordinated lounge set with a subtle sheen and gift-ready presentation, suitable for checkout and manual-payment demos.",
    brand: "Moon Thread",
    categoryName: "Sets",
    price: "95.25",
    imageLabel: "Satin Set",
  },
];

const marketplaceCategories = [
  { id: BigInt(1000), name: "Женская одежда", slug: "women", parentId: null, sortOrder: 10 },
  { id: BigInt(1010), name: "Джинсы", slug: "jeans", parentId: BigInt(1000), sortOrder: 10 },
  { id: BigInt(1020), name: "Брюки", slug: "pants", parentId: BigInt(1000), sortOrder: 20 },
  { id: BigInt(1030), name: "Юбки", slug: "skirts", parentId: BigInt(1000), sortOrder: 30 },
  { id: BigInt(1040), name: "Шорты", slug: "shorts", parentId: BigInt(1000), sortOrder: 40 },
  { id: BigInt(1050), name: "Платья", slug: "dresses", parentId: BigInt(1000), sortOrder: 50 },
  { id: BigInt(1060), name: "Рубашки", slug: "shirts", parentId: BigInt(1000), sortOrder: 60 },
  { id: BigInt(1070), name: "Куртки", slug: "jackets", parentId: BigInt(1000), sortOrder: 70 },
  { id: BigInt(1080), name: "Толстовки", slug: "hoodies", parentId: BigInt(1000), sortOrder: 80 },
  { id: BigInt(1090), name: "Комплекты", slug: "sets", parentId: BigInt(1000), sortOrder: 90 },
  { id: BigInt(2000), name: "Мужская одежда", slug: "men", parentId: null, sortOrder: 20 },
  { id: BigInt(3000), name: "Детская одежда", slug: "kids", parentId: null, sortOrder: 30 },
  { id: BigInt(4000), name: "Обувь", slug: "shoes", parentId: null, sortOrder: 40 },
  { id: BigInt(5000), name: "Аксессуары", slug: "accessories", parentId: null, sortOrder: 50 },
];

const categoryMappings = [
  ["WILDBERRIES_EXCEL", "Dresses", null, BigInt(1050), "0.9800"],
  ["WILDBERRIES_EXCEL", "Outerwear", null, BigInt(1070), "0.9500"],
  ["WILDBERRIES_EXCEL", "Sets", null, BigInt(1090), "0.9500"],
  ["WILDBERRIES_EXCEL", "Jeans", null, BigInt(1010), "0.9800"],
  ["WILDBERRIES_EXCEL", "Skirts", null, BigInt(1030), "0.9800"],
  ["WILDBERRIES_EXCEL", "Shirts", null, BigInt(1060), "0.9800"],
  ["WILDBERRIES_API", "Dresses", null, BigInt(1050), "0.9800"],
  ["WILDBERRIES_API", "Hoodies", null, BigInt(1080), "0.9800"],
  ["WILDBERRIES_API", "Shirts", null, BigInt(1060), "0.9800"],
];

function assertSeedAllowed() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const confirmed = process.env.DEMO_SEED_CONFIRM === "true";
  if (nodeEnv === "production" && !confirmed) {
    throw new Error(
      "Refusing to seed demo data in production without DEMO_SEED_CONFIRM=true.",
    );
  }
}

async function main() {
  assertSeedAllowed();

  const passwordHash = await bcrypt.hash(DEMO_SELLER_PASSWORD, 10);
  const adminPasswordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const customerPasswordHash = await bcrypt.hash(DEMO_CUSTOMER_PASSWORD, 10);

  for (const category of marketplaceCategories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });
  }

  for (const [source, sourceCategoryName, sourceSubjectName, targetCategoryId, confidence] of categoryMappings) {
    const existing = await prisma.categoryMapping.findFirst({
      where: { source, sourceCategoryName, sourceSubjectName },
      select: { id: true },
    });
    if (existing) {
      await prisma.categoryMapping.update({
        where: { id: existing.id },
        data: { targetCategoryId, confidence },
      });
    } else {
      await prisma.categoryMapping.create({
        data: { source, sourceCategoryName, sourceSubjectName, targetCategoryId, confidence },
      });
    }
  }

  await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      passwordHash: adminPasswordHash,
      fullName: "Demo Admin",
      phone: "+79990000009",
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      id: randomUUID(),
      email: DEMO_ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      fullName: "Demo Admin",
      phone: "+79990000009",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: DEMO_CUSTOMER_EMAIL },
    update: {
      passwordHash: customerPasswordHash,
      fullName: "Demo Customer",
      phone: "+79990000001",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
    create: {
      id: randomUUID(),
      email: DEMO_CUSTOMER_EMAIL,
      passwordHash: customerPasswordHash,
      fullName: "Demo Customer",
      phone: "+79990000001",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: DEMO_SELLER_EMAIL },
    update: {
      passwordHash,
      fullName: "Demo Seller",
      phone: "+79990000000",
      role: "SELLER",
      status: "ACTIVE",
    },
    create: {
      id: randomUUID(),
      email: DEMO_SELLER_EMAIL,
      passwordHash,
      fullName: "Demo Seller",
      phone: "+79990000000",
      role: "SELLER",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const sellerProfile = await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    update: {
      approvalStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewNote: "Demo seed approved seller profile.",
      approvedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
    },
    create: {
      id: randomUUID(),
      userId: user.id,
      approvalStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewNote: "Demo seed approved seller profile.",
      approvedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
    },
    select: { id: true },
  });

  const shop = await prisma.shop.upsert({
    where: { slug: DEMO_SHOP_SLUG },
    update: {
      sellerProfileId: sellerProfile.id,
      name: DEMO_SHOP_NAME,
      status: "ACTIVE",
      paymentInstructions: DEMO_PAYMENT_INSTRUCTIONS,
      contactInfo: "demo-seller@trawberry.local / +79990000000",
    },
    create: {
      id: randomUUID(),
      sellerProfileId: sellerProfile.id,
      name: DEMO_SHOP_NAME,
      slug: DEMO_SHOP_SLUG,
      status: "ACTIVE",
      paymentInstructions: DEMO_PAYMENT_INSTRUCTIONS,
      contactInfo: "demo-seller@trawberry.local / +79990000000",
    },
    select: { id: true },
  });

  await prisma.sellerProfile.update({
    where: { userId: user.id },
    data: {
      currentShopId: shop.id,
    },
  });

  for (const [index, product] of demoProducts.entries()) {
    const createdProduct = await prisma.product.upsert({
      where: {
        shopId_wbNmId: {
          shopId: shop.id,
          wbNmId: product.wbNmId,
        },
      },
      update: {
        wbTitle: product.title,
        localTitle: product.title,
        wbDescription: product.description,
        localDescription: product.description,
        seoSlug: product.slug,
        brand: product.brand,
        categoryName: product.categoryName,
        sourceCategoryName: product.categoryName,
        sourceCategorySource: "MANUAL",
        categoryId:
          product.categoryName === "Dresses"
            ? BigInt(1050)
            : product.categoryName === "Outerwear"
              ? BigInt(1070)
              : product.categoryName === "Sets"
                ? BigInt(1090)
                : null,
        visibility: "ACTIVE",
      },
      create: {
        id: randomUUID(),
        shopId: shop.id,
        wbNmId: product.wbNmId,
        wbTitle: product.title,
        localTitle: product.title,
        wbDescription: product.description,
        localDescription: product.description,
        seoSlug: product.slug,
        brand: product.brand,
        categoryName: product.categoryName,
        sourceCategoryName: product.categoryName,
        sourceCategorySource: "MANUAL",
        categoryId:
          product.categoryName === "Dresses"
            ? BigInt(1050)
            : product.categoryName === "Outerwear"
              ? BigInt(1070)
              : product.categoryName === "Sets"
                ? BigInt(1090)
                : null,
        visibility: "ACTIVE",
      },
      select: { id: true },
    });

    const imageUrl = `http://localhost:3000/demo/demo-product-${index + 1}.svg`;
    await prisma.productImage.upsert({
      where: { id: product.imageId },
      update: {
        productId: createdProduct.id,
        wbUrl: imageUrl,
        localUrl: imageUrl,
        imageType: "ORIGINAL",
        isMain: true,
        sortOrder: 0,
      },
      create: {
        id: product.imageId,
        productId: createdProduct.id,
        wbUrl: imageUrl,
        localUrl: imageUrl,
        imageType: "ORIGINAL",
        isMain: true,
        sortOrder: 0,
      },
    });

    await prisma.productVariant.upsert({
      where: {
        productId_chrtId: {
          productId: createdProduct.id,
          chrtId: product.chrtId,
        },
      },
      update: {
        isActive: true,
        basePrice: product.price,
        discountPrice: product.price,
        stockQuantity: 50,
      },
      create: {
        id: randomUUID(),
        productId: createdProduct.id,
        chrtId: product.chrtId,
        techSize: "M",
        wbSize: "M",
        isActive: true,
        basePrice: product.price,
        discountPrice: product.price,
        stockQuantity: 50,
        reservedStock: 0,
      },
    });
  }

  const demoSlides = [
    {
      id: "d070b471-1111-4111-8111-111111111111",
      titleRu: "Распродажа платьев",
      titleEn: "Summer Dresses Sale",
      subtitleRu: "Скидки до 50% на все платья из льна",
      subtitleEn: "Up to 50% off on all linen dresses",
      ctaLabelRu: "Купить",
      ctaLabelEn: "Shop Now",
      ctaUrl: "/products?category=dresses",
      altTextRu: "Слайд платья",
      altTextEn: "Dresses Slide",
      imageDesktopUrl: "http://localhost:3000/demo/demo-product-1.svg",
      imageMobileUrl: "http://localhost:3000/demo/demo-product-1.svg",
      backgroundColor: "linear-gradient(135deg, #cb11ab 0%, #8e1cff 100%)",
      displayOrder: 1,
      isActive: true,
    },
    {
      id: "d070b472-2222-4222-8222-222222222222",
      titleRu: "Новая коллекция",
      titleEn: "New Arrivals",
      subtitleRu: "Стильные куртки и жакеты этого сезона",
      subtitleEn: "Stylish jackets and blazers of the season",
      ctaLabelRu: "Смотреть",
      ctaLabelEn: "Explore",
      ctaUrl: "/products?category=jackets",
      altTextRu: "Слайд куртки",
      altTextEn: "Jackets Slide",
      imageDesktopUrl: "http://localhost:3000/demo/demo-product-2.svg",
      backgroundColor: "linear-gradient(135deg, #9b2bff 0%, #ff5d85 100%)",
      displayOrder: 2,
      isActive: true,
    }
  ];

  await prisma.homepageSlide.deleteMany({});

  for (const slide of demoSlides) {
    await prisma.homepageSlide.upsert({
      where: { id: slide.id },
      update: slide,
      create: slide,
    });
  }

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

  const publicProductCount = await prisma.product.count({
    where: {
      shopId: shop.id,
      visibility: "ACTIVE",
    },
  });

  console.log(
    JSON.stringify({
      sellerEmail: DEMO_SELLER_EMAIL,
      sellerPassword: DEMO_SELLER_PASSWORD,
      adminEmail: DEMO_ADMIN_EMAIL,
      adminPassword: DEMO_ADMIN_PASSWORD,
      customerEmail: DEMO_CUSTOMER_EMAIL,
      customerPassword: DEMO_CUSTOMER_PASSWORD,
      shopSlug: DEMO_SHOP_SLUG,
      shopId: shop.id,
      publicProductCount,
    }),
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await prisma.$disconnect();
  });
