import { buildWhatsAppUrl, storeConfig } from "@/lib/site";
import { ArrowLeft, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type PolicySection = {
  title: string;
  items: string[];
};

type PolicyContent = {
  slug: string;
  title: string;
  subtitle: string;
  sections: PolicySection[];
  cta: string;
};

const policies: PolicyContent[] = [
  {
    slug: "cambios-y-devoluciones",
    title: "Cambios y devoluciones",
    subtitle:
      "Queremos que tu compra sea clara desde el inicio. Estas condiciones nos ayudan a revisar cada caso con orden y cuidado.",
    sections: [
      {
        title: "Condiciones para cambios",
        items: [
          "Los cambios están sujetos a disponibilidad de talla, modelo y color.",
          "Para solicitar un cambio, el cliente debe comunicarse por WhatsApp.",
          "La prenda debe estar sin uso, limpia, sin daños, con etiquetas y en condiciones de venta.",
          "No se aceptan cambios en prendas usadas, lavadas, dañadas o alteradas.",
          "Los cambios deben solicitarse dentro de los 3 días naturales posteriores a recibir el pedido.",
        ],
      },
      {
        title: "Productos especiales y ofertas",
        items: [
          "En productos en oferta, liquidación o pedidos especiales, los cambios pueden estar limitados.",
          "No hay devoluciones en efectivo salvo error confirmado de la tienda o caso especial autorizado.",
          "Los gastos de envío por cambio corren por cuenta del cliente, salvo error de la tienda.",
        ],
      },
      {
        title: "Producto incorrecto o con defecto",
        items: [
          "Si el producto llegó incorrecto o con defecto, el cliente debe enviar evidencia por WhatsApp.",
          "La tienda revisará el caso y confirmará la solución disponible antes de iniciar cualquier cambio.",
        ],
      },
    ],
    cta: "Si tienes dudas sobre un cambio, contáctanos por WhatsApp.",
  },
  {
    slug: "apartados",
    title: "Apartados",
    subtitle:
      "Los apartados permiten reservar una prenda por tiempo limitado cuando la tienda confirma disponibilidad.",
    sections: [
      {
        title: "Cómo se confirma un apartado",
        items: [
          "El apartado se confirma únicamente cuando la tienda lo autoriza por WhatsApp.",
          "La tienda puede pedir anticipo para reservar una prenda.",
          "Los apartados están sujetos a disponibilidad de stock.",
          "Cualquier acuerdo especial debe confirmarse por WhatsApp.",
        ],
      },
      {
        title: "Plazo y disponibilidad",
        items: [
          "El tiempo máximo de apartado es de 3 días naturales.",
          "Si el cliente no liquida o confirma dentro del plazo, la prenda puede volver a estar disponible para venta.",
          "En prendas de alta demanda, temporada, ofertas o mayoreo, los apartados pueden no estar disponibles.",
        ],
      },
      {
        title: "Anticipos",
        items: [
          "El anticipo puede no ser reembolsable si el cliente cancela sin aviso o deja vencer el apartado.",
          "La tienda confirmará por WhatsApp el monto, plazo y condiciones antes de reservar la prenda.",
        ],
      },
    ],
    cta: "Para solicitar un apartado, escríbenos por WhatsApp con el nombre o captura del producto.",
  },
  {
    slug: "envios-y-entregas",
    title: "Envíos y entregas",
    subtitle:
      "Preparamos cada pedido con los datos proporcionados por el cliente y confirmamos cualquier detalle importante por WhatsApp.",
    sections: [
      {
        title: "Datos de entrega",
        items: [
          "La tienda realiza envíos a la dirección proporcionada por el cliente.",
          "El cliente debe revisar que sus datos estén completos: calle, número, colonia, ciudad, estado, código postal y referencias.",
          "Si el paquete regresa por datos incorrectos o ausencia del cliente, el reenvío corre por cuenta del cliente.",
        ],
      },
      {
        title: "Costo y tiempos",
        items: [
          "El costo de envío puede variar según destino, tamaño del pedido, paquetería y cantidad de prendas.",
          "Pedidos grandes o de mayoreo pueden requerir cotización especial por WhatsApp.",
          "Los tiempos de entrega dependen de la paquetería y la ubicación del cliente.",
          "La tienda no se hace responsable por retrasos causados por paquetería, clima, direcciones incorrectas o datos incompletos.",
        ],
      },
      {
        title: "Proceso del pedido",
        items: [
          "La disponibilidad de productos se confirma antes de preparar el pedido.",
          "El pedido se procesa una vez confirmado el pago o acuerdo con la tienda.",
          "Para pedidos locales o acuerdos especiales, la tienda puede coordinar por WhatsApp.",
        ],
      },
    ],
    cta: "Si necesitas confirmar el costo de envío, contáctanos por WhatsApp.",
  },
  {
    slug: "privacidad",
    title: "Privacidad",
    subtitle:
      "Usamos tus datos únicamente para procesar pedidos, entregar productos y dar seguimiento a tu compra.",
    sections: [
      {
        title: "Datos que podemos solicitar",
        items: [
          "Nombre.",
          "Teléfono.",
          "Dirección de entrega.",
          "Referencias de domicilio.",
          "Información del pedido.",
        ],
      },
      {
        title: "Uso de la información",
        items: [
          "Los datos se usan para confirmar pedidos, enviar productos, resolver dudas y dar seguimiento por WhatsApp.",
          "La tienda no vende ni comparte datos personales con terceros para fines publicitarios.",
          "Los datos pueden compartirse únicamente con servicios necesarios para completar el pedido, como paqueterías o plataformas de pago.",
        ],
      },
      {
        title: "Pagos y derechos del cliente",
        items: [
          "Los pagos en línea se procesan mediante plataformas externas seguras, como Mercado Pago.",
          "La tienda no almacena datos completos de tarjetas bancarias.",
          "El cliente puede solicitar corrección o eliminación de sus datos contactando por WhatsApp.",
          "Al usar el sitio y realizar un pedido, el cliente acepta el uso de sus datos para completar la compra.",
        ],
      },
    ],
    cta: "Para dudas sobre tus datos personales, contáctanos por WhatsApp.",
  },
];

const policyBySlug = new Map(policies.map((policy) => [policy.slug, policy]));

type PolicyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return policies.map((policy) => ({
    slug: policy.slug,
  }));
}

export async function generateMetadata({
  params,
}: PolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const policy = policyBySlug.get(slug);

  if (!policy) {
    return {
      title: `Políticas | ${storeConfig.name}`,
    };
  }

  return {
    title: `${policy.title} | ${storeConfig.name}`,
    description: policy.subtitle,
  };
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  const policy = policyBySlug.get(slug);

  if (!policy) {
    notFound();
  }

  const whatsappMessage = `Hola, tengo dudas sobre ${policy.title.toLowerCase()} en ${storeConfig.name}.`;

  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-8 text-slate-900 sm:px-5 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50 sm:text-sm"
        >
          <ArrowLeft size={16} />
          Volver a la tienda
        </Link>

        <header className="mt-7 max-w-3xl sm:mt-10">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-500 sm:text-xs">
            Políticas de compra
          </p>
          <h1 className="mt-2 text-4xl font-black leading-none text-slate-950 sm:text-5xl">
            {policy.title}
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-slate-600 sm:text-lg sm:leading-8">
            {policy.subtitle}
          </p>
        </header>

        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-3">
          {policy.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-6"
            >
              <h2 className="text-lg font-black text-slate-950">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-600">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-lg sm:mt-10 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-6">
          <div>
            <p className="text-sm font-black sm:text-base">{policy.cta}</p>
            <p className="mt-1 text-xs font-semibold text-white/65 sm:text-sm">
              Te atendemos directo por WhatsApp para revisar tu caso.
            </p>
          </div>

          <a
            href={buildWhatsAppUrl(whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 sm:mt-0 sm:w-auto"
          >
            <MessageCircle size={18} />
            WhatsApp
          </a>
        </section>
      </div>
    </main>
  );
}
