import "./ui/marketing-hero.css";
import "./ui/product-plans.css";
import { MarketingHero } from "./ui/marketing-hero";
import { ProductPlans } from "./ui/product-plans";

export default function HomePage() {
  return (
    <>
      <MarketingHero />
      <ProductPlans />
    </>
  );
}
