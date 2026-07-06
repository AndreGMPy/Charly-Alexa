"use client";

import { auth, isFirebaseConfigured } from "@/lib/firebase";
import {
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Store,
  Tags,
  WalletCards,
  X,
} from "lucide-react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type AdminShellProps = {
  children: ReactNode;
};

const adminLinks = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Portada", href: "/admin/inicio", icon: Home },
  { label: "Productos", href: "/admin/productos", icon: Package },
  { label: "Categorías", href: "/admin/categorias", icon: Tags },
  { label: "Pedidos", href: "/admin/pedidos", icon: ClipboardList },
  { label: "Ventas", href: "/admin/ventas", icon: WalletCards },
  { label: "Datos de tienda", href: "/admin/configuracion", icon: Store },
];

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname?.startsWith("/admin/login");

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(isFirebaseConfigured);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      if (!isLoginRoute) {
        router.replace("/admin/login");
      }

      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);

      if (!currentUser && !isLoginRoute) {
        router.replace("/admin/login");
      }

      if (currentUser && isLoginRoute) {
        router.replace("/admin");
      }
    });

    return unsubscribe;
  }, [isLoginRoute, router]);

  async function handleLogout() {
    if (!auth) return;

    await signOut(auth);
    router.replace("/admin/login");
  }

  useEffect(() => {
    queueMicrotask(() => {
      setIsMobileOpen(false);
    });
  }, [pathname]);

  if (isLoginRoute) {
    return <div className="min-h-screen bg-[#fffaf5]">{children}</div>;
  }

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 text-slate-900">
        <div className="rounded-[1.75rem] bg-white px-8 py-7 text-center shadow-sm ring-1 ring-rose-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-lg font-black text-rose-500">
            CA
          </div>
          <p className="mt-4 text-sm font-black text-slate-950">
            Validando sesión
          </p>
        </div>
      </div>
    );
  }

  const navigation = (
    <nav className="space-y-2">
      {adminLinks.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsMobileOpen(false)}
            className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
              isActive
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-700 hover:bg-rose-50 hover:text-slate-950"
            }`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#fffaf5] text-slate-900 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-rose-100 bg-white/90 px-5 py-6 shadow-sm backdrop-blur lg:block">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-sm font-black text-rose-500 ring-1 ring-rose-100">
            CA
          </span>
          <span>
            <span className="block text-lg font-black leading-none text-slate-950">
              Charly Alexa
            </span>
            <span className="mt-1 block text-xs font-black uppercase tracking-wide text-slate-600">
              Panel vendedor
            </span>
          </span>
        </Link>

        <div className="mt-8">{navigation}</div>

        <div className="absolute bottom-6 left-5 right-5">
          <div className="mb-3 rounded-2xl bg-[#fffaf5] p-4 ring-1 ring-rose-100">
            <p className="truncate text-sm font-black text-slate-950">
              {user.email}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-600">Sesión activa</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="lg:hidden">
        <header className="sticky top-0 z-40 border-b border-rose-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-xs font-black text-rose-500 ring-1 ring-rose-100">
                CA
              </span>
              <span className="text-base font-black text-slate-950">
                Panel vendedor
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white"
              aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {isMobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>

          {isMobileOpen && (
            <div className="mt-4 max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-[1.5rem] bg-[#fffaf5] p-3 ring-1 ring-rose-100">
              {navigation}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"
              >
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </div>
          )}
        </header>
      </div>

      <main className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
