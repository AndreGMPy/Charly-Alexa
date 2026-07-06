import FirebaseProductDetailLoader from "@/components/FirebaseProductDetailLoader";
import ProductDetailClient from "@/components/ProductDetailClient";
import {
  getProductBySlug,
  getRelatedProducts,
  products,
} from "@/lib/products";
import { storeConfig } from "@/lib/site";
import type { Metadata } from "next";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: `Producto | ${storeConfig.name}`,
    };
  }

  return {
    title: `${product.name} | ${storeConfig.name}`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return <FirebaseProductDetailLoader slug={slug} />;
  }

  return (
    <ProductDetailClient
      product={product}
      relatedProducts={getRelatedProducts(product)}
    />
  );
}
