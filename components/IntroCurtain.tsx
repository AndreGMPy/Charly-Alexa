"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const INTRO_STORAGE_KEY = "charly-alexa-intro-seen";

export default function IntroCurtain() {
  const [isReady, setIsReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    let isActive = true;
    let timer: number | undefined;

    queueMicrotask(() => {
      if (!isActive) return;

      const hasSeenIntro = sessionStorage.getItem(INTRO_STORAGE_KEY);

      if (hasSeenIntro === "true") {
        setShowIntro(false);
        setIsReady(true);
        return;
      }

      sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
      setShowIntro(true);
      setIsReady(true);

      timer = window.setTimeout(() => {
        setShowIntro(false);
      }, 1600);
    });

    return () => {
      isActive = false;

      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  function closeIntro() {
    sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    setShowIntro(false);
  }

  if (!isReady) return null;

  return (
    <AnimatePresence>
      {showIntro && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fffaf5] px-6"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            y: -24,
            transition: {
              duration: 0.55,
              ease: "easeInOut",
            },
          }}
        >
          <motion.button
            type="button"
            onClick={closeIntro}
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar introducción"
          />

          <motion.div
            className="relative z-10 flex flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                duration: 0.6,
                ease: "easeOut",
              },
            }}
          >
            <motion.div
              className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white text-2xl font-black text-slate-950 shadow-xl ring-1 ring-rose-100 sm:h-24 sm:w-24 sm:text-3xl"
              initial={{ rotate: -8 }}
              animate={{
                rotate: 0,
                transition: {
                  duration: 0.6,
                  ease: "easeOut",
                },
              }}
            >
              CA
            </motion.div>

            <motion.p
              className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-rose-500"
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  delay: 0.2,
                  duration: 0.45,
                },
              }}
            >
              Boutique infantil
            </motion.p>

            <motion.h1
              className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-5xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  delay: 0.32,
                  duration: 0.5,
                },
              }}
            >
              Charly Alexa
            </motion.h1>

            <motion.p
              className="mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-500 sm:text-base"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  delay: 0.45,
                  duration: 0.5,
                },
              }}
            >
              Prendas para niñas y niños, elegidas con cuidado para cada día.
            </motion.p>

            <motion.button
              type="button"
              onClick={closeIntro}
              className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-xs font-black text-white shadow-lg transition hover:bg-slate-800"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: {
                  delay: 0.58,
                  duration: 0.3,
                },
              }}
            >
              Descubrir colección
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
