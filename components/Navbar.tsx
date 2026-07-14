"use client";

import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getActiveProducts } from "@/lib/firebase-services/products";
import { mapFirebaseProductToProduct } from "@/lib/product-mappers";
import {
  formatPrice,
  getProductDisplayLabel,
  getSectionLabels,
  getSubcategoryLabels,
  isPublicStoreProduct,
  products,
} from "@/lib/products";
import { navLinks } from "@/lib/site";
import { useCartStore } from "@/store/cart-store";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function Navbar() {
  const { settings } = useSiteSettings();
  const [query, setQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState(() =>
    products.filter(isPublicStoreProduct)
  );
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();

  const openCart = useCartStore((state) => state.openCart);
  const rawTotalItems = useCartStore((state) => state.totalItems());
  const totalItems = hasMounted ? rawTotalItems : 0;

  const normalizedQuery = query.trim().toLowerCase();
  const hasSearch = normalizedQuery.length > 0;

  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    return catalogProducts
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.category.toLowerCase().includes(normalizedQuery) ||
          getSectionLabels(product).toLowerCase().includes(normalizedQuery) ||
          product.subcategory.toLowerCase().includes(normalizedQuery) ||
          getSubcategoryLabels(product).toLowerCase().includes(normalizedQuery) ||
          product.colors.join(" ").toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 5);
  }, [catalogProducts, normalizedQuery]);

  useEffect(() => {
    let isCurrent = true;

    async function loadProducts() {
      try {
        const firebaseProducts = await getActiveProducts();

        if (!isCurrent || firebaseProducts.length === 0) return;

        setCatalogProducts(
          firebaseProducts
            .filter(isPublicStoreProduct)
            .map(mapFirebaseProductToProduct)
        );
      } catch {
        // Keep the local catalog if saved products are not available.
      }
    }

    queueMicrotask(() => {
      setHasMounted(true);
    });
    void loadProducts();

    return () => {
      isCurrent = false;
    };
  }, []);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function renderCartBadge() {
    if (!hasMounted || totalItems <= 0) return null;

    return (
      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
        {totalItems}
      </span>
    );
  }

  return (
    <header className="sticky top-0 z-[900] border-b border-rose-100 bg-[#fffaf5]/95 shadow-sm backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-rose-50 sm:h-10 sm:w-10 lg:hidden"
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link
            href="/"
            onClick={closeMenu}
            className="flex min-w-0 items-center gap-2 sm:gap-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-xs font-black text-slate-950 shadow-sm ring-1 ring-rose-100 sm:h-10 sm:w-10">
              CA
            </span>

            <span className="min-w-0 leading-none">
              <span className="hidden truncate text-[10px] font-black uppercase tracking-wide text-rose-500 sm:block sm:text-xs">
                {settings.tagline}
              </span>

              <span className="block max-w-[8.5rem] truncate text-base font-black text-slate-950 sm:max-w-none sm:text-xl">
                {settings.storeName}
              </span>
            </span>
          </Link>
        </div>

        <div className="hidden items-center gap-7 text-sm font-black text-slate-600 lg:flex">
          {navLinks.map((link) => {
            const basePath = link.href.split("#")[0];
            const isActive = basePath !== "/" && pathname === basePath;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition hover:text-rose-500 ${
                  isActive ? "text-slate-950" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="relative hidden w-full max-w-sm md:block">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm ring-1 ring-rose-100">
            <Search size={18} className="text-slate-400" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar vestidos, conjuntos, tallas..."
              className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          {hasSearch && (
            <div className="absolute left-0 right-0 top-[115%] overflow-hidden rounded-[1.5rem] bg-white shadow-2xl ring-1 ring-slate-100">
              {results.length > 0 ? (
                results.map((product) => (
                  <Link
                    key={product.id}
                    href={`/producto/${product.slug}`}
                    onClick={() => setQuery("")}
                    className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-rose-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">
                        {product.name}
                      </p>

                      <p className="text-xs font-bold text-slate-400">
                        {getProductDisplayLabel(product) || product.category}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-black text-rose-500">
                      {formatPrice(product.price)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="p-4 text-sm font-bold text-slate-500">
                  No encontramos productos con esa búsqueda.
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={openCart}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition hover:scale-105 sm:h-11 sm:w-11"
          aria-label="Abrir carrito"
        >
          <ShoppingBag size={17} />
          {renderCartBadge()}
        </button>
      </nav>

      {isMenuOpen && (
        <div className="border-t border-rose-100 bg-[#fffaf5] px-3 pb-4 pt-3 shadow-lg lg:hidden">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm ring-1 ring-rose-100">
              <Search size={17} className="text-slate-400" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar productos..."
                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => {
                const basePath = link.href.split("#")[0];
                const isActive = basePath !== "/" && pathname === basePath;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className={`rounded-2xl px-4 py-2.5 text-center text-sm font-black shadow-sm ring-1 transition ${
                      isActive
                        ? "bg-slate-950 text-white ring-slate-950"
                        : "bg-white text-slate-800 ring-slate-100 hover:bg-rose-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {hasSearch && (
              <div className="mt-3 overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-100">
                <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Resultados
                </p>

                {results.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {results.map((product) => (
                      <Link
                        key={product.id}
                        href={`/producto/${product.slug}`}
                        onClick={() => {
                          setQuery("");
                          closeMenu();
                        }}
                        className="block p-3 transition hover:bg-rose-50"
                      >
                        <p className="text-sm font-black text-slate-950">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {getProductDisplayLabel(product) || product.category} ·{" "}
                          {formatPrice(product.price)}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-sm font-bold text-slate-500">
                    No encontramos productos con esa búsqueda.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
