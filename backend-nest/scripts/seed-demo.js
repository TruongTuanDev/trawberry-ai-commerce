const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { randomUUID } = require("node:crypto");

const prisma = new PrismaClient();

const DEMO_SELLER_EMAIL = "demo-seller@trawberry.local";
const DEMO_SELLER_PASSWORD = "DemoSeller123!";
const DEMO_ADMIN_EMAIL = "demo-admin@trawberry.local";
const DEMO_ADMIN_PASSWORD = "DemoAdmin123!";
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
