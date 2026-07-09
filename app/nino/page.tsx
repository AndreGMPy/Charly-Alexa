import FloatingActions from "@/components/FloatingActions";
import GenderProductSection from "@/components/GenderProductSection";
import { isPublicStoreProduct, productAppearsInSection, products } from "@/lib/products";
import { ArrowLeft, Shirt } from "lucide-react";
import Link from "next/link";

type NinoPageProps = {
  searchParams: Promise<{
    filtro?: string | string[];
  }>;
};

function getInitialFilter(filtro?: string | string[]) {
  return Array.isArray(filtro) ? filtro[0] : filtro;
}

export default async function NinoPage({ searchParams }: NinoPageProps) {
  const { filtro } = await searchParams;
  const initialFilter = getInitialFilter(filtro);

  const boyProducts = products.filter(
    (product) =>
      isPublicStoreProduct(product) &&
      productAppearsInSection(product, "nino")
  );

  return (
    <>
      <FloatingActions />

      <main className="min-h-screen bg-[#fffaf5] text-slate-900">
        <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-[#fffaf5] to-lime-50 px-4 py-8 sm:px-5 sm:py-14">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(125,211,252,0.14)_0_32%,transparent_32%_68%,rgba(217,249,157,0.14)_68%_100%)]" />

          <div className="relative mx-auto max-w-7xl">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-sky-100 transition hover:bg-sky-50"
            >
              <ArrowLeft size={17} />
              Volver al inicio
            </Link>

            <div className="mt-10 max-w-4xl">
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-sky-600">
                <Shirt size={17} />
                Colección
              </p>

              <h1 className="mt-4 text-6xl font-black tracking-tight text-slate-950 sm:text-8xl">
                Niño
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-9">
                Conjuntos, playeras, pantalones y básicos para uso diario,
                salidas y temporada.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/nino?filtro=Novedades"
                  className="rounded-full bg-white px-7 py-3 text-sm font-black text-slate-950 shadow-sm ring-1 ring-sky-100 transition hover:bg-sky-50"
                >
                  Novedades
                </Link>

                <Link
                  href="/nino?filtro=Ofertas"
                  className="rounded-full bg-sky-600 px-7 py-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
                >
                  Ofertas
                </Link>
              </div>
            </div>
          </div>
        </section>

        <GenderProductSection
          id="catalogo-nino"
          title="Niño"
          subtitle="Filtra por colección, subcategoría, talla, color y precio para encontrar más rápido la prenda ideal."
          products={boyProducts}
          accent="sky"
          initialFilter={initialFilter}
        />
      </main>
    </>
  );
}
