import Welcome from "./welcome/page";
import Services from "./services/page";
import Testimonials from "./testimonials/page";
import Navigation from "./navigation/page";
import Contact from "./contact/page";
import Footer from "./footer/page";
import Script from "next/script";
import { homepageSchema } from "@/lib/schema";


export default async function Home() {

    return (
        <div className="relative min-h-screen">
          <Script id="homepage-schema" type="application/ld+json">
            {JSON.stringify(homepageSchema)}
          </Script>
          <Navigation />
          <Welcome />
          <Services />
          <Testimonials />
          <Contact />
          <Footer />
        </div>
    )
}