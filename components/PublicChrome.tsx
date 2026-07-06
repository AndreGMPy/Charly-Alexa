"use client";

import CartDrawer from "@/components/CartDrawer";
import FloatingActions from "@/components/FloatingActions";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
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
