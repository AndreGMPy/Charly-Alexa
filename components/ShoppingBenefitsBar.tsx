import { shoppingBenefits } from "@/lib/site";
import { MessageCircle, Ruler, Truck } from "lucide-react";

const icons = [Ruler, MessageCircle, Truck];

export default function ShoppingBenefitsBar() {
  return (
    <section className="border-y border-rose-100 bg-white/80 px-4 py-5 sm:px-5">
      <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3">
        {shoppingBenefits.map((benefit, index) => {
          const Icon = icons[index] ?? Ruler;

          return (
            <div
              key={benefit.title}
              className="flex items-start gap-3 rounded-2xl bg-[#fffaf5] px-4 py-4 ring-1 ring-slate-100"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm">
                <Icon size={19} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950">
                  {benefit.title}
                </h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {benefit.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
