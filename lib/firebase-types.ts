import type { Timestamp } from "firebase/firestore";
import type { StockByVariant } from "@/lib/variant-utils";

export type FirebaseDate = Timestamp | Date | string | null;

export type ProductStatus = "active" | "inactive" | "draft" | "archived";

export type WholesaleMode = "none" | "surtido" | "producto" | "mixed" | "product";

export type MainCategoryName = "Niña" | "Niño" | "Unisex";

export type ProductSection = "nina" | "nino" | "unisex";

export type ProductCategoryValue = MainCategoryName | ProductSection;

export type HomeSection = "ofertas" | "novedades" | "temporada" | null;

export type OrderStatus =
  | "Nuevo"
  | "Confirmado"
  | "Preparando"
  | "Listo para entregar"
  | "Entregado"
  | "Cancelado"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type CheckoutDeliveryMethod =
  | "Recoger en tienda"
  | "Entrega local"
  | "Envío nacional";

export type DeliveryMethod = CheckoutDeliveryMethod | "Envío a domicilio";

export type ShippingStatus = "pickup" | "calculated" | "quote_required";

export type OrderShipping = {
  method: DeliveryMethod;
  cost: number;
  status: ShippingStatus;
  requiresQuote: boolean;
};

export type DeliveryAddress = {
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  references?: string;
};

export type PaymentStatus = "pending" | "paid" | "failed" | "manual";

export type PaymentProvider = "mercadopago" | "manual";

export type OrderPayment = {
  status: PaymentStatus;
  provider: PaymentProvider;
  preferenceId?: string;
  initPoint?: string;
  paymentId?: string;
  paidAt?: FirebaseDate;
  amountPaid?: number;
  updatedAt?: FirebaseDate;
};

export type ProductSizeStock = {
  size: string;
  stock: number;
};

export type FirebaseProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: ProductCategoryValue;
  sections?: ProductSection[];
  subcategory: string;
  subcategories?: string[];
  price: number;
  basePrice?: number;
  paymentFeePercent?: number;
  wholesaleRunEnabled?: boolean;
  wholesaleRunPrice?: number | null;
  wholesaleRunSizes?: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  stockBySize: ProductSizeStock[];
  stockByVariant?: StockByVariant;
  images: string[];
  mainImage: string;
  isOffer: boolean;
  isNew: boolean;
  isSeasonal: boolean;
  isActive: boolean;
  isTestProduct?: boolean;
  isFeatured: boolean;
  featuredOrder: number;
  showOnHome: boolean;
  homeSection: HomeSection;
  status?: ProductStatus;
  wholesaleMode: WholesaleMode;
  wholesalePrice?: number | null;
  wholesaleMinQuantity: number;
  wholesaleNote?: string;
  createdAt: FirebaseDate;
  updatedAt: FirebaseDate;
};

export type FirebaseCategory = {
  id: string;
  name: MainCategoryName;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: FirebaseDate;
  updatedAt: FirebaseDate;
};

export type FirebaseSubcategory = {
  id: string;
  name: string;
  slug: string;
  parentCategory: MainCategoryName;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: FirebaseDate;
  updatedAt: FirebaseDate;
};

export type FirebaseOrderItem = {
  productId: string;
  slug: string;
  name?: string;
  productName?: string;
  category?: ProductCategoryValue;
  subcategory?: string;
  size: string;
  color?: string;
  image?: string;
  mainImage?: string;
  price: number;
  quantity: number;
  subtotal: number;
  wholesaleType?: WholesaleMode;
  wholesaleMinimum?: number;
  regularPrice?: number;
  wholesaleRunApplied?: boolean;
  wholesaleRunPrice?: number | null;
  priceLabel?: "regular" | "wholesale" | "wholesale_run";
};

export type FirebaseCustomer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  deliveryAddress?: DeliveryAddress;
  notes?: string;
  createdAt: FirebaseDate;
  updatedAt: FirebaseDate;
};

export type FirebaseOrder = {
  id: string;
  orderNumber?: string;
  customerId?: string;
  customer?: Omit<FirebaseCustomer, "id" | "createdAt" | "updatedAt">;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryMethod?: DeliveryMethod;
  address?: string;
  customerAddress?: string;
  deliveryAddress?: DeliveryAddress;
  shipping?: OrderShipping;
  items: FirebaseOrderItem[];
  subtotal: number;
  shippingCost?: number;
  total: number;
  payment?: OrderPayment;
  totalItems?: number;
  status: OrderStatus;
  source?: "web" | "store" | string;
  inventoryReturned?: boolean;
  inventoryReturnedAt?: FirebaseDate;
  inventoryReturnedBy?: string;
  isDeleted?: boolean;
  deletedAt?: FirebaseDate;
  deletedBy?: string | null;
  wholesaleValidation?: {
    canCheckout?: boolean;
    messages?: string[];
    missingSurtido?: number;
    missingByProduct?: { productName: string; missing: number }[];
  };
  notes?: string;
  createdAt: FirebaseDate;
  updatedAt: FirebaseDate;
};

export type PaymentMethod =
  | "Efectivo"
  | "Transferencia"
  | "Tarjeta"
  | "Mixto"
  | "Otro";

export type PaymentBreakdown = {
  cash: number;
  transfer: number;
  card: number;
};
