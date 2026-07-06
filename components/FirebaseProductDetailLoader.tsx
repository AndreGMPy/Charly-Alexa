"use client";

import ProductDetailClient from "@/components/ProductDetailClient";
import {
  getActiveProducts,
  getProductBySlug as getSavedProductBySlug,
} from "@/lib/firebase-services/products";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import type { Product } from "@/lib/products";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type FirebaseProductDetailLoaderProps = {
  slug: string;
};

function getRelatedProducts(product: Product, products: Product[]) {
  return products
    .filter(
      (item) =>
        item.id !== product.id &&
        (item.category === product.category ||
          item.category === "Unisex" ||
          product.category === "Unisex" ||
          item.subcategory === product.subcategory)
    )
    .slice(0, 3);
}

export default function FirebaseProductDetailLoader({
  slug,
}: FirebaseProductDetailLoaderProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadProduct() {
      try {
        const savedProduct = await getSavedProductBySlug(slug);

        if (!isCurrent) return;

        if (!savedProduct || !savedProduct.isActive) {
          setIsMissing(true);
          return;
        }

        const activeProducts = await getActiveProducts();
        const mappedProduct = mapFirebaseProductToProduct(savedProduct);
        const mappedProducts = activeProducts.map(mapFirebaseProductToProduct);

        if (!isCurrent) return;

        setProduct(mappedProduct);
        setRelatedProducts(getRelatedProducts(mappedProduct, mappedProducts));
      } catch {
        if (isCurrent) {
          setIsMissing(true);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isCurrent = false;
    };
  }, [slug]);

  if (product) {
    return (
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-12 text-slate-900 sm:px-5">
      <section className="mx-auto max-w-xl rounded-[1.75rem] bg-white p-8 text-center shadow-sm ring-1 ring-rose-100">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
          <Search size={24} />
        </div>

        <h1 className="mt-5 text-2xl font-black text-slate-950">
          {isLoading ? "Buscando producto" : "Producto no encontrado"}
        </h1>

        <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
          {isMissing
            ? "No encontramos este producto disponible en la tienda."
            : "Estamos cargando la información del producto."}
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          <ArrowLeft size={17} />
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
