"use client";

import CartDrawer from "@/components/CartDrawer";
import FloatingActions from "@/components/FloatingActions";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { isFirebaseConfigured } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type PublicChromeProps = {
  children: ReactNode;
};

export default function PublicChrome({ children }: PublicChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  if (isAdminRoute) {
    return <>{children}</>;
  }

  if (!isFirebaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 text-center text-slate-900">
        <section className="max-w-md rounded-[1.75rem] bg-white px-7 py-8 shadow-sm ring-1 ring-rose-100">
          <p className="text-sm font-black text-slate-950">
            La tienda todavía no está lista. Intenta más tarde.
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      {children}
      <SiteFooter />
      <CartDrawer />
      <FloatingActions />
    </>
  );
}
