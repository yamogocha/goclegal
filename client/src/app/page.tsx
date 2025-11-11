import Welcome from "./welcome/page";
import Services from "./services/page";
import Testimonials from "./testimonials/page";
import Navigation from "./navigation/page";
import Contact from "./contact/page";
import Footer from "./footer/page";


export default async function Home() {

    return (
        <div className="relative min-h-screen">
          <Navigation />
          <Welcome />
          <Services />
          <Testimonials />
          <Contact />
          <Footer />
        </div>
    )
}