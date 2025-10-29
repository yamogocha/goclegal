import Testimonials from "./components/testimonials";
import Welcome from "./components/welcome";


export default async function Home() {

    return (
        <>
          <Welcome />
          <Testimonials />
        </>
    )
}