export const storeConfig = {
  name: "Charly Alexa",
  legalName: "Creaciones Charly Alexa",
  tagline: "Tienda online infantil",
  description:
    "Ropa infantil para niñas y niños en tallas 1 a 16, con atención directa por WhatsApp.",
  address: "16 de Septiembre No. 3, Zona Centro",
  whatsappDisplay: "445 144 8846",
  whatsappInternational: "524451448846",
  googleMapsUrl:
    "https://www.google.com/maps/search/?api=1&query=16%20de%20Septiembre%20No.%203%2C%20Zona%20Centro",
};

export const navLinks = [
  { label: "Niña", href: "/nina" },
  { label: "Niño", href: "/nino" },
  { label: "Ofertas", href: "/#ofertas" },
  { label: "Ubicación", href: "/#ubicacion" },
];

export const heroImages = {
  girl:
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop&sig=hero-girl",
  boy:
    "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=1200&auto=format&fit=crop&sig=hero-boy",
  looks:
    "https://images.unsplash.com/photo-1522771930-78848d9293e8?q=80&w=1200&auto=format&fit=crop&sig=hero-looks",
};

export const promoTiles = [
  {
    title: "Ofertas nuevas",
    subtitle: "Prendas seleccionadas con precio especial.",
    label: "Ofertas",
    girlFilter: "Ofertas",
    boyFilter: "Ofertas",
    visualLabel: "Precio especial",
    tone: "rose",
    imageUrl:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=900&auto=format&fit=crop&sig=promo-ofertas",
  },
  {
    title: "Novedades",
    subtitle: "Lo más reciente para armar looks de temporada.",
    label: "Nuevo",
    girlFilter: "Novedades",
    boyFilter: "Novedades",
    visualLabel: "Llegadas recientes",
    tone: "lilac",
    imageUrl:
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=900&auto=format&fit=crop&sig=promo-novedades",
  },
  {
    title: "Tendencias",
    subtitle: "Conjuntos, básicos y piezas fáciles de combinar.",
    label: "Tendencia",
    girlFilter: "Conjuntos",
    boyFilter: "Conjuntos",
    visualLabel: "Looks completos",
    tone: "sky",
    imageUrl:
      "https://images.unsplash.com/photo-1522771930-78848d9293e8?q=80&w=900&auto=format&fit=crop&sig=promo-tendencias",
  },
  {
    title: "Temporada",
    subtitle: "Ropa fresca, fiesta y capas ligeras para cada plan.",
    label: "Temporada",
    girlFilter: "Fiesta",
    boyFilter: "Chamarras",
    visualLabel: "Selección actual",
    tone: "amber",
    imageUrl:
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?q=80&w=900&auto=format&fit=crop&sig=promo-temporada",
  },
] as const;

export const heroHighlights = [
  "Tallas 1 a 16",
  "Novedades",
  "Ofertas",
  "Atención por WhatsApp",
];

export const shoppingBenefits = [
  {
    title: "Compra por talla",
    description: "Elige la talla en cada producto antes de agregar al carrito.",
  },
  {
    title: "Pedido por WhatsApp",
    description: "El resumen sale listo con productos, tallas y total.",
  },
  {
    title: "Recoge o solicita envío",
    description: "Confirma disponibilidad y entrega directa con la tienda.",
  },
];

export const genderEntries = [
  {
    label: "Niña",
    href: "/nina",
    subtitle: "Vestidos, conjuntos, fiesta, playeras y accesorios.",
    accent: "rose",
    imageUrl:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop&sig=gender-nina",
  },
  {
    label: "Niño",
    href: "/nino",
    subtitle: "Conjuntos, playeras, pantalones, chamarras y básicos.",
    accent: "sky",
    imageUrl:
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=1200&auto=format&fit=crop&sig=gender-nino",
  },
] as const;

/**
 * Imágenes temporales por categoría/subcategoría.
 * 
 * Después puedes cambiar estas URLs por fotos reales de Charly Alexa.
 * Lo ideal en la versión final es que cada producto tenga su propia imagen.
 */
export const productVisualImages = {
  Niña:
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop&sig=nina-general",

  Niño:
    "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=1200&auto=format&fit=crop&sig=nino-general",

  Unisex:
    "https://images.unsplash.com/photo-1522771930-78848d9293e8?q=80&w=1200&auto=format&fit=crop&sig=unisex-general",

  Vestidos:
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop&sig=vestidos-nina",

  Fiesta:
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?q=80&w=1200&auto=format&fit=crop&sig=fiesta-vestido",

  Conjuntos:
    "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=1200&auto=format&fit=crop&sig=conjuntos-infantiles",

  Playeras:
    "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?q=80&w=1200&auto=format&fit=crop&sig=playeras-infantiles",

  Pantalones:
    "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=1200&auto=format&fit=crop&sig=pantalones-nino",

  Chamarras:
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop&sig=chamarras-infantiles",

  Accesorios:
    "https://images.unsplash.com/photo-1522771930-78848d9293e8?q=80&w=1200&auto=format&fit=crop&sig=accesorios-infantiles",
} as const;

export const paymentMethods = [
  "Transferencia bancaria",
  "Pago en tienda",
  "Pagos seguros por Mercado Pago o Stripe, si se activa",
];

export const policyLinks = [
  "Cambios y devoluciones",
  "Apartados",
  "Envíos y entregas",
  "Privacidad",
];

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${storeConfig.whatsappInternational}?text=${encodeURIComponent(
    message
  )}`;
}