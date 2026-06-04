import { PublicShopProfilePageClient } from "@/components/public/public-shop-profile-page-client";

export default async function PublicShopProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <PublicShopProfilePageClient shopSlug={slug} />;
}
