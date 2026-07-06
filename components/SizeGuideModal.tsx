"use client";

import { Ruler, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type SizeGuideModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const sizeRows = [
  {
    size: "1-3",
    age: "Etapa inicial",
    height: "75 - 95 cm",
    recommendation: "Revisar largo y complexión",
  },
  {
    size: "4-6",
    age: "Niños pequeños",
    height: "96 - 115 cm",
    recommendation: "Uso diario",
  },
  {
    size: "8-10",
    age: "Niños medianos",
    height: "116 - 135 cm",
    recommendation: "Revisar complexión",
  },
  {
    size: "12-16",
    age: "Niños grandes",
    height: "136 - 160 cm",
    recommendation: "Confirmar medida",
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
                Esta guía es aproximada. Para mayor seguridad, se recomienda
                confirmar la talla por WhatsApp antes de hacer el pedido.
              </p>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
                <div className="grid min-w-[560px] grid-cols-4 bg-slate-950 px-4 py-3 text-xs font-black text-white">
                  <span>Talla</span>
                  <span>Etapa</span>
                  <span>Altura</span>
                  <span>Nota</span>
                </div>

                {sizeRows.map((row) => (
                  <div
                    key={row.size}
                    className="grid min-w-[560px] grid-cols-4 gap-2 border-t border-slate-100 px-4 py-4 text-xs text-slate-600 sm:text-sm"
                  >
                    <strong className="text-slate-950">{row.size}</strong>
                    <span>{row.age}</span>
                    <span>{row.height}</span>
                    <span>{row.recommendation}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                Tip: si el niño está entre dos tallas, normalmente conviene
                elegir la talla más grande.
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
