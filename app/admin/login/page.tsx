"use client";

import { refreshAndCheckAdminUser } from "@/lib/admin-auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import {
  getSafeLoginErrorMessage,
  logErrorInDevelopment,
} from "@/lib/safe-errors";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { LockKeyhole, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isFirebaseConfigured || !auth) {
      setError("La conexión de la tienda no está configurada correctamente.");
      return;
    }

    try {
      setIsSubmitting(true);

      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const hasAdminClaim = await refreshAndCheckAdminUser(credential.user);

      if (!hasAdminClaim) {
        await signOut(auth);
        setError("Tu cuenta no tiene permisos para entrar al panel.");
        toast.error("Tu cuenta no tiene permisos para entrar al panel.");
        return;
      }

      toast.success("Sesión iniciada");
      router.replace("/admin");
    } catch (loginError) {
      logErrorInDevelopment("Admin login error", loginError);
      const message = getSafeLoginErrorMessage(loginError);
      setError(message);
      toast.error("No se pudo iniciar sesión");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            <LockKeyhole size={24} />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-500">
              Charly Alexa
            </p>

            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Panel vendedor
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Correo
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-rose-100 bg-[#fffaf5] px-4 py-3 text-[16px] font-bold text-slate-800 outline-none transition placeholder:text-slate-300 placeholder:opacity-70 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 sm:text-sm"
              placeholder="Ej. vendedor@charlyalexa.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Contraseña
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-rose-100 bg-[#fffaf5] px-4 py-3 text-[16px] font-bold text-slate-800 outline-none transition placeholder:text-slate-300 placeholder:opacity-70 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 sm:text-sm"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold leading-5 text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <LogIn size={17} />
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-5 block text-center text-xs font-black uppercase tracking-wide text-slate-400 transition hover:text-rose-500"
        >
          Volver a la tienda
        </Link>
      </section>
    </main>
  );
}
