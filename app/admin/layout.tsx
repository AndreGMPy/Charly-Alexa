import AdminShell from "@/components/admin/AdminShell";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Panel vendedor | Charly Alexa",
  description: "Panel privado para administrar productos y pedidos.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
