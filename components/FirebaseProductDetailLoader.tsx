"use client";

import ProductDetailClient from "@/components/ProductDetailClient";
import {
  getActiveProducts,
  getCachedActiveProductBySlug,
  getCachedActiveProducts,
  getProductBySlug as getSavedProductBySlug,
} from "@/lib/firebase-services/products";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import type { Product } from "@/lib/products";
import { ArrowLeft, Search, ShoppingBag } from "lucide-react";
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

function ProductDetailSkeleton({ isSlow }: { isSlow: boolean }) {
  return (
    <main className="min-h-screen bg-[#fffaf5] pb-24 text-slate-900 lg:pb-12">
      <section className="mx-auto max-w-6xl px-4 py-3 sm:px-5 sm:py-4">
        <div className="h-10 w-40 animate-pulse rounded-full bg-white shadow-sm ring-1 ring-slate-100" />
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-8 sm:px-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.85fr)] lg:gap-7 lg:pb-10">
        <div>
          <div className="h-[300px] animate-pulse rounded-[1.5rem] bg-white shadow-lg ring-1 ring-slate-100 sm:h-[420px] sm:rounded-[1.75rem] lg:h-[500px]" />
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`detail-image-skeleton-${index}`}
                className="h-16 animate-pulse rounded-2xl bg-white ring-1 ring-slate-100 sm:h-24"
              />
            ))}
          </div>
        </div>

        <div className="lg:pt-2">
          <div className="mb-4 flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded-full bg-rose-50" />
            <div className="h-8 w-28 animate-pulse rounded-full bg-white" />
          </div>

          <div className="h-3 w-48 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-4 h-10 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="mt-3 h-10 w-4/5 animate-pulse rounded-full bg-slate-100" />

          <div className="mt-5 space-y-2">
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
          </div>

          <div className="mt-5 h-12 w-40 animate-pulse rounded-full bg-slate-100" />

          <div className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.75rem] sm:p-5">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`detail-size-skeleton-${index}`}
                  className="h-10 w-20 animate-pulse rounded-full bg-slate-100"
                />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.75rem] sm:p-5">
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
              <div className="h-8 w-10 animate-pulse rounded-full bg-slate-100" />
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>

          <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid">
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-rose-100 px-5 py-3.5 text-sm font-black text-rose-300"
            >
              <ShoppingBag size={18} />
              Agregar
            </button>
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-emerald-100 px-5 py-3.5 text-sm font-black text-emerald-300"
            >
              Consultar
            </button>
          </div>

          {isSlow && (
            <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-100">
              Estamos cargando este producto...
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function ProductEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-12 text-slate-900 sm:px-5">
      <section className="mx-auto max-w-xl rounded-[1.75rem] bg-white p-8 text-center shadow-sm ring-1 ring-rose-100">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
          <Search size={24} />
        </div>

        <h1 className="mt-5 text-2xl font-black text-slate-950">{title}</h1>

        <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
          {message}
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          <ArrowLeft size={17} />
          Volver al catálogo
        </Link>
      </section>
    </main>
  );
}

export default function FirebaseProductDetailLoader({
  slug,
}: FirebaseProductDetailLoaderProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "missing" | "error">(
    "loading"
  );
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const slowTimer = window.setTimeout(() => {
      if (isCurrent) {
        setIsSlow(true);
      }
    }, 2500);

    async function loadRelatedProducts(currentProduct: Product) {
      try {
        const cachedProducts = getCachedActiveProducts();
        const activeProducts =
          cachedProducts.length > 0 ? cachedProducts : await getActiveProducts();

        if (!isCurrent) return;

        const mappedProducts = activeProducts.map(mapFirebaseProductToProduct);
        setRelatedProducts(getRelatedProducts(currentProduct, mappedProducts));
      } catch {
        if (isCurrent) {
          setRelatedProducts([]);
        }
      }
    }

    async function loadProduct() {
      setProduct(null);
      setRelatedProducts([]);
      setLoadState("loading");
      setIsSlow(false);

      try {
        const cachedProduct = getCachedActiveProductBySlug(slug);
        const savedProduct = cachedProduct ?? (await getSavedProductBySlug(slug));

        if (!isCurrent) return;

        if (!savedProduct || !savedProduct.isActive) {
          setLoadState("missing");
          return;
        }

        const mappedProduct = mapFirebaseProductToProduct(savedProduct);

        window.clearTimeout(slowTimer);
        setIsSlow(false);
        setProduct(mappedProduct);
        void loadRelatedProducts(mappedProduct);
      } catch {
        if (isCurrent) {
          setLoadState("error");
        }
      }
    }

    void loadProduct();

    return () => {
      isCurrent = false;
      window.clearTimeout(slowTimer);
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

  if (loadState === "missing") {
    return (
      <ProductEmptyState
        title="No encontramos este producto."
        message="Puede que ya no esté disponible o que el enlace haya cambiado."
      />
    );
  }

  if (loadState === "error") {
    return (
      <ProductEmptyState
        title="No se pudo cargar la tienda."
        message="No se pudo cargar la tienda. Intenta de nuevo."
      />
    );
  }

  return <ProductDetailSkeleton isSlow={isSlow} />;
}
