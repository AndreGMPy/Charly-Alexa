import GenderEntryCards from "@/components/GenderEntryCards";
import HeroSection from "@/components/HeroSection";
import HomeProductHighlights from "@/components/HomeProductHighlights";
import IntroCurtain from "@/components/IntroCurtain";
import StoreInfoSection from "@/components/StoreInfoSection";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-900">
      <IntroCurtain />

      <HeroSection />

      <GenderEntryCards />

      <HomeProductHighlights />

      <StoreInfoSection />
    </main>
  );
}