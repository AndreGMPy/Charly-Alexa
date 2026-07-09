"use client";

import { Ruler, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type SizeGuideModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const sizeRows = [
  {
    size: "1",
    age: "12-18 meses",
    height: "78-86 cm",
    measurements: "Pecho 50-52 cm · cintura 49-51 cm",
  },
  {
    size: "2",
    age: "18-24 meses",
    height: "86-92 cm",
    measurements: "Pecho 52-54 cm · cintura 50-52 cm",
  },
  {
    size: "4",
    age: "3-4 años",
    height: "98-104 cm",
    measurements: "Pecho 56-58 cm · cintura 53-54 cm",
  },
  {
    size: "6",
    age: "5-6 años",
    height: "110-116 cm",
    measurements: "Pecho 60-62 cm · cintura 55-56 cm",
  },
  {
    size: "8",
    age: "7-8 años",
    height: "122-128 cm",
    measurements: "Pecho 64-66 cm · cintura 57-58 cm",
  },
  {
    size: "10",
    age: "9-10 años",
    height: "134-140 cm",
    measurements: "Pecho 68-72 cm · cintura 59-61 cm",
  },
  {
    size: "12",
    age: "11-12 años",
    height: "146-152 cm",
    measurements: "Pecho 74-78 cm · cintura 62-64 cm",
  },
  {
    size: "14",
    age: "13-14 años",
    height: "154-160 cm",
    measurements: "Pecho 80-84 cm · cintura 65-67 cm",
  },
  {
    size: "16",
    age: "15-16 años",
    height: "160-166 cm",
    measurements: "Pecho 86-90 cm · cintura 68-70 cm",
  },
];

export default function SizeGuideModal({
  isOpen,
  onClose,
}: SizeGuideModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar guía de tallas"
            onClick={onClose}
            className="fixed inset-0 z-[998] bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 z-[999] w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <Ruler size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase text-rose-500">
                    Charly Alexa
                  </p>
                  <h2 className="text-xl font-black text-slate-950">
                    Guía de tallas
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-100 p-3 text-slate-700 transition hover:bg-slate-200"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm leading-6 text-slate-600">
                Las medidas son aproximadas y pueden variar según el modelo.
                Si la prenda es ajustada, conviene confirmar por WhatsApp.
              </p>

              <div className="mt-5 grid gap-2 sm:hidden">
                {sizeRows.map((row) => (
                  <div
                    key={`mobile-${row.size}`}
                    className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-lg font-black text-slate-950">
                        Talla {row.size}
                      </strong>
                      <span className="rounded-xl bg-white px-3 py-1 text-xs font-black text-rose-600 ring-1 ring-rose-100">
                        {row.age}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Estatura: {row.height}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {row.measurements}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-100 sm:block">
                <div className="grid min-w-[640px] grid-cols-[0.6fr_1fr_1fr_1.6fr] bg-slate-950 px-4 py-3 text-xs font-black text-white">
                  <span>Talla</span>
                  <span>Edad aprox.</span>
                  <span>Estatura</span>
                  <span>Pecho / cintura</span>
                </div>

                {sizeRows.map((row) => (
                  <div
                    key={row.size}
                    className="grid min-w-[640px] grid-cols-[0.6fr_1fr_1fr_1.6fr] gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:text-sm"
                  >
                    <strong className="text-slate-950">{row.size}</strong>
                    <span>{row.age}</span>
                    <span>{row.height}</span>
                    <span>{row.measurements}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                Tip: si la niña o el niño está entre dos tallas, normalmente
                conviene elegir la talla más grande.
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
