import Nav from '../components/sections/Nav';
import Hero from '../components/sections/Hero';
import TrustBar from '../components/sections/TrustBar';
import ProductShowcase from '../components/sections/ProductShowcase';
import WholesaleBenefits from '../components/sections/WholesaleBenefits';
import PricingTiers from '../components/sections/PricingTiers';
import Testimonials from '../components/sections/Testimonials';
import FinalCta from '../components/sections/FinalCta';
import Footer from '../components/sections/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <TrustBar />
      <ProductShowcase />
      <WholesaleBenefits />
      <PricingTiers />
      <Testimonials />
      <FinalCta />
      <Footer />
    </div>
  );
}
