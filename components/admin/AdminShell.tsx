"use client";

import { isAdminUser } from "@/lib/admin-auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { logErrorInDevelopment } from "@/lib/safe-errors";
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
import { useEffect, useRef, useState } from "react";

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
  const [accessDenied, setAccessDenied] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return;
    }

    let isCurrent = true;

    async function verifyAdminAccess(currentUser: User | null) {
      if (!currentUser) {
        if (!isCurrent) return;

        setUser(null);
        setChecking(false);

        if (!isLoginRoute && !deniedRef.current) {
          router.replace("/admin/login");
        }

        return;
      }

      const hasAdminClaim = await isAdminUser(currentUser);
      if (!isCurrent) return;

      if (!hasAdminClaim) {
        deniedRef.current = !isLoginRoute;
        setUser(null);
        setAccessDenied(!isLoginRoute);
        setChecking(false);

        if (auth?.currentUser) {
          await signOut(auth).catch((error) => {
            logErrorInDevelopment(
              "Admin sign out after denied access failed",
              error
            );
          });
        }

        return;
      }

      deniedRef.current = false;
      setUser(currentUser);
      setAccessDenied(false);
      setChecking(false);

      if (isLoginRoute) {
        router.replace("/admin");
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setChecking(true);
      if (!deniedRef.current) {
        setAccessDenied(false);
      }
      void verifyAdminAccess(currentUser);
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [isLoginRoute, router]);

  async function handleLogout() {
    if (!auth) return;

    deniedRef.current = false;
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

  if (!isFirebaseConfigured || !auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 text-slate-900">
        <div className="rounded-[1.75rem] bg-white px-8 py-7 text-center shadow-sm ring-1 ring-rose-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-lg font-black text-rose-500">
            CA
          </div>
          <p className="mt-4 text-sm font-black text-slate-950">
            La tienda todavía no está lista. Intenta más tarde.
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 text-slate-900">
        <div className="rounded-[1.75rem] bg-white px-8 py-7 text-center shadow-sm ring-1 ring-rose-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-lg font-black text-rose-500">
            CA
          </div>
          <p className="mt-4 text-sm font-black text-slate-950">
            No tienes permisos para entrar al panel.
          </p>
          <Link
            href="/admin/login"
            className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 text-slate-900">
        <div className="rounded-[1.75rem] bg-white px-8 py-7 text-center shadow-sm ring-1 ring-rose-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-lg font-black text-rose-500">
            CA
          </div>
          <p className="mt-4 text-sm font-black text-slate-950">
            Verificando acceso...
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
            className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition sm:min-h-12 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm ${
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
    <div className="min-h-dvh bg-[#fffaf5] text-slate-900 lg:grid lg:grid-cols-[280px_1fr]">
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
              {user.email ?? "Administrador"}
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
        <header className="sticky top-0 z-40 border-b border-rose-100 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-xs font-black text-rose-500 ring-1 ring-rose-100">
                CA
              </span>
              <span className="text-sm font-black text-slate-950">
                Panel vendedor
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white"
              aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {isMobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>

          {isMobileOpen && (
            <div className="mt-3 max-h-[calc(100dvh-4.75rem)] overflow-y-auto rounded-[1.25rem] bg-[#fffaf5] p-2 ring-1 ring-rose-100">
              {navigation}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
              >
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </div>
          )}
        </header>
      </div>

      <main className="admin-panel min-w-0 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
