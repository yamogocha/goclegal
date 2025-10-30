import Welcome from "./welcome/page";
import Services from "./services/page";
import Testimonials from "./testimonials/page";


export default async function Home() {

    return (
        <>
          <Welcome />
          <Services />
          <Testimonials />
        </>
    )
}