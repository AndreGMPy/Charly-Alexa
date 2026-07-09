import FloatingActions from "@/components/FloatingActions";
import GenderProductSection from "@/components/GenderProductSection";
import { isPublicStoreProduct, productAppearsInSection, products } from "@/lib/products";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

type NinaPageProps = {
  searchParams: Promise<{
    filtro?: string | string[];
  }>;
};

function getInitialFilter(filtro?: string | string[]) {
  return Array.isArray(filtro) ? filtro[0] : filtro;
}

export default async function NinaPage({ searchParams }: NinaPageProps) {
  const { filtro } = await searchParams;
  const initialFilter = getInitialFilter(filtro);

  const girlProducts = products.filter(
    (product) =>
      isPublicStoreProduct(product) &&
      productAppearsInSection(product, "nina")
  );

  return (
    <>
      <FloatingActions />

      <main className="min-h-screen bg-[#fffaf5] text-slate-900">
        <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-[#fffaf5] to-amber-50 px-4 py-8 sm:px-5 sm:py-14">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(251,113,133,0.10)_0_32%,transparent_32%_68%,rgba(254,240,138,0.12)_68%_100%)]" />

          <div className="relative mx-auto max-w-7xl">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50"
            >
              <ArrowLeft size={17} />
              Volver al inicio
            </Link>

            <div className="mt-10 max-w-4xl">
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-rose-500">
                <Sparkles size={17} />
                Colección
              </p>

              <h1 className="mt-4 text-6xl font-black tracking-tight text-slate-950 sm:text-8xl">
                Niña
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-9">
                Vestidos, conjuntos y prendas de temporada para armar looks
                cómodos y bonitos.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/nina?filtro=Novedades"
                  className="rounded-full bg-white px-7 py-3 text-sm font-black text-slate-950 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50"
                >
                  Novedades
                </Link>

                <Link
                  href="/nina?filtro=Ofertas"
                  className="rounded-full bg-rose-500 px-7 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-600"
                >
                  Ofertas
                </Link>
              </div>
            </div>
          </div>
        </section>

        <GenderProductSection
          id="catalogo-nina"
          title="Niña"
          subtitle="Filtra por colección, subcategoría, talla, color y precio para encontrar más rápido la prenda ideal."
          products={girlProducts}
          accent="pink"
          initialFilter={initialFilter}
        />
      </main>
    </>
  );
}
