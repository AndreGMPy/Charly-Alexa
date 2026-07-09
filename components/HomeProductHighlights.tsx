"use client";

import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import { getHomepageSettings } from "@/lib/firebase-services/homepage";
import {
  getActiveProducts,
  getCachedActiveProducts,
} from "@/lib/firebase-services/products";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import { getFeaturedOffers, isPublicStoreProduct } from "@/lib/products";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function getCachedFeaturedOffers() {
  const cachedProducts = getCachedActiveProducts();
  const publicProducts = cachedProducts.filter(isPublicStoreProduct);
  const offerProducts = publicProducts.filter((product) => product.isOffer);
  const fallbackProducts = publicProducts.filter((product) => product.isFeatured);
  const productsForSection =
    offerProducts.length > 0 ? offerProducts : fallbackProducts;

  return productsForSection
    .sort((a, b) => a.featuredOrder - b.featuredOrder)
    .slice(0, 5)
    .map(mapFirebaseProductToProduct);
}

function getDateValue(value: { toDate?: () => Date } | Date | string | null) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
}

export default function HomeProductHighlights() {
  const [featuredOffers, setFeaturedOffers] = useState(() => {
    const cachedOffers = getCachedFeaturedOffers();
    return cachedOffers.length > 0 ? cachedOffers : getFeaturedOffers();
  });
  const [isLoading, setIsLoading] = useState(
    () => getCachedActiveProducts().length === 0 && featuredOffers.length === 0
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadFeaturedOffers() {
      if (featuredOffers.length === 0) {
        setIsLoading(true);
      }

      try {
        const [homepageSettings, firebaseProducts] = await Promise.all([
          getHomepageSettings(),
          getActiveProducts(),
        ]);

        if (!isCurrent || firebaseProducts.length === 0) return;

        const featuredIds = homepageSettings?.featuredProductIds ?? [];
        const publicProducts = firebaseProducts.filter(isPublicStoreProduct);
        const offerProducts = publicProducts
          .filter((product) => product.isOffer)
          .sort((a, b) => a.featuredOrder - b.featuredOrder);
        const selectedProducts =
          featuredIds.length > 0
            ? featuredIds
                .map((id) =>
                  publicProducts.find((product) => product.id === id)
                )
                .filter(
                  (product): product is (typeof firebaseProducts)[number] =>
                    Boolean(product)
                )
            : [];
        const featuredProducts = publicProducts
          .filter((product) => product.isFeatured)
          .sort((a, b) => a.featuredOrder - b.featuredOrder);
        let homeProducts = offerProducts;

        if (homeProducts.length === 0) {
          homeProducts = selectedProducts;
        }

        if (homeProducts.length === 0) {
          homeProducts = featuredProducts;
        }

        if (homeProducts.length === 0) {
          homeProducts = [...publicProducts].sort(
            (a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt)
          );
        }

        if (homeProducts.length === 0) return;

        setFeaturedOffers(
          homeProducts
            .slice(0, 5)
            .map((product) => mapFirebaseProductToProduct(product))
        );
      } catch {
        // Keep the fallback offers if saved products are not available.
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadFeaturedOffers();

    return () => {
      isCurrent = false;
    };
  }, [featuredOffers.length]);

  if (!isLoading && featuredOffers.length === 0) {
    return null;
  }

  return (
    <section id="ofertas" className="bg-[#fffaf5] px-4 py-7 sm:px-5 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 max-w-3xl sm:mb-7">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-500 sm:text-xs">
            Ofertas de boutique
          </p>
          <h2 className="mt-1.5 text-2xl font-black leading-tight text-slate-950 sm:mt-2 sm:text-4xl">
            Ofertas y prendas destacadas
          </h2>
          <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-slate-500 sm:text-base">
            Encuentra promociones activas y piezas elegidas para renovar su clóset.
          </p>
        </div>

        {isLoading && featuredOffers.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`home-product-skeleton-${index}`}
                className={index === 4 ? "hidden lg:block" : ""}
              >
                <ProductCardSkeleton compact />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {featuredOffers.map((product, index) => (
              <div key={product.id} className={index === 4 ? "hidden lg:block" : ""}>
                <ProductCard product={product} compact />
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:justify-center">
          <Link
            href="/nina?filtro=Ofertas"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-black text-slate-800 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
          >
            Colección Niña
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/nino?filtro=Ofertas"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:scale-[1.02] sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
          >
            Colección Niño
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
