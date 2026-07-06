"use client";

import {
  buildWhatsAppUrlWithNumber,
  useSiteSettings,
} from "@/hooks/useSiteSettings";
import { useCartStore } from "@/store/cart-store";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function FloatingActions() {
  const pathname = usePathname();
  const { settings } = useSiteSettings();

  const [hasMounted, setHasMounted] = useState(false);

  const openCart = useCartStore((state) => state.openCart);
  const rawTotalItems = useCartStore((state) => state.totalItems());

  const totalItems = hasMounted ? rawTotalItems : 0;
  const isProductPage = pathname.startsWith("/producto");

  const message = `Hola, quiero información del catálogo de ${settings.storeName}.`;

  useEffect(() => {
    queueMicrotask(() => {
      setHasMounted(true);
    });
  }, []);

  return (
    <div
      className={`fixed right-3 z-[820] flex flex-col gap-2 sm:right-5 sm:gap-3 ${
        isProductPage ? "bottom-20 sm:bottom-5" : "bottom-4 sm:bottom-5"
      }`}
    >
      <motion.a
        href={buildWhatsAppUrlWithNumber(
          settings.whatsappInternational,
          message
        )}
        target="_blank"
        rel="noreferrer"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-100 transition sm:h-12 sm:w-12 md:h-14 md:w-14"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle size={19} />
      </motion.a>

      <motion.button
        type="button"
        onClick={openCart}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-200 transition sm:h-12 sm:w-12"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Abrir carrito"
      >
        <ShoppingBag size={18} />

        {hasMounted && totalItems > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white sm:h-6 sm:w-6 sm:text-xs">
            {totalItems}
          </span>
        )}
      </motion.button>
    </div>
  );
}
