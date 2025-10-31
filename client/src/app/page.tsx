import Welcome from "./welcome/page";
import Services from "./services/page";
import Testimonials from "./testimonials/page";
import Navigation from "./navigation/page";


export default async function Home() {

    return (
        <>
          <Navigation />
          <Welcome />
          <Services />
          <Testimonials />
        </>
    )
}