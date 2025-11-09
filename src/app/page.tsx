import Carousel from "@/components/Carousel";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { redirect } from "next/navigation";
import { motion } from "framer-motion";
import RedirectButton from "@/components/RedirectButton";

const images = [
  { id: 1, src: "/carousel/1.jpg", brand: "Breguet" },
  { id: 2, src: "/carousel/2.jpg", brand: "Cartier" },
  { id: 3, src: "/carousel/3.jpg", brand: "Laurent Ferrier" },
  { id: 4, src: "/carousel/4.jpg", brand: "Jaeger LeCoultre" },
  { id: 5, src: "/carousel/5.jpg", brand: "Omega" },
  { id: 6, src: "/carousel/6.jpg", brand: "Omega" },
  { id: 7, src: "/carousel/7.jpg", brand: "Glashütte Original" },
];

const images2 = [
  { id: 1, src: "/carousel2/1.jpg", brand: "Jaeger LeCoultre" },
  { id: 2, src: "/carousel2/2.jpg", brand: "Omega" },
  { id: 3, src: "/carousel2/3.jpg", brand: "Omega" },
  { id: 4, src: "/carousel2/4.jpg", brand: "Blancpain" },
  { id: 5, src: "/carousel2/5.jpg", brand: "Jaeger LeCoultre" },
  { id: 6, src: "/carousel2/6.jpg", brand: "Glashütte Original" },
  { id: 7, src: "/carousel2/7.jpg", brand: "Cartier" },
];

export default function Home() {
  return (
    <>
      <div>
        <div>
          <Carousel direction="left" duration={70} images={images} />
        </div>
        <div className="absolute inset-x-0 z-10 transform -translate-y-9">
          <h1 className="text-white mx-auto text-6xl font-bold text-center drop-shadow-lg hover:scale-105 transition-transform duration-300">
            Limited Watches
          </h1>
        </div>
        <div>
          <Carousel direction="right" duration={80} images={images2} />
        </div>
      </div>
      <div className="container mx-auto p-10">
        <div className="grid grid-cols-5 gap-y-20">
          <div className="col-span-2">
            <h2 className="text-center text-3xl font-bold mt-20 mb-6 ">
              Carefully Curated.
            </h2>
            <p className=" max-w-2xl mb-4">
              Our passion lies in offering a meticulously curated collection of
              unique and limited edition watches.
              <br />
              <br />
              Over the last 5 years, we have handpicked each timepiece to ensure
              it meets our high standards of quality and exclusivity.
              <br />
              Each piece in our collection is a testament to fine craftsmanship
              and unique style, perfect for collectors and enthusiasts alike.
            </p>
            <RedirectButton targetPage="/watches" buttonText="Explore Collection"/>
          </div>
          <div className="flex justify-end items-center col-span-3">
            <Image
              className="shadow-2xl rounded-lg hover:scale-105 transition-transform duration-300"
              src="/audemars-piguet.jpg"
              alt="Audemars Piguet"
              width={700}
              height={500}
            />
          </div>
          <div className="col-span-3">
            <Image
              src="/unboxing2.jpg"
              alt="Unboxing experience"
              width={700}
              height={500}
              className="shadow-2xl rounded-lg hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="col-span-2">
            <h2 className="text-3xl font-bold mt-20 mb-6 text-center">
              Packaged to Perfection.
            </h2>
            <p className="mb-4">
              There’s no better feeling than bringing home your new watch. We
              know that moment matters - that’s why we make sure every detail is
              just right.
              <br />
              <br />
              Our commitment to quality extends beyond the watch itself; we
              believe that the unboxing experience is just as important.
            </p>
          </div>
          <div className="col-span-2 flex-col items-center">
            <h2 className="text-3xl font-bold mt-20 mb-6 text-center">
              Service Beyond the Sale.
            </h2>
            <p className="mb-4">
              We believe in building lasting relationships with our clients.
              That’s why our commitment doesn’t end with your purchase.
              <br />
              <br />
              From personalized styling advice to ongoing maintenance tips,
              we’re here to ensure your watch remains a cherished part of your collection for years to come.
            </p>
          </div>
          <div className="col-span-3 flex justify-end">
            <Image src="/onwrist.jpg" alt="On wrist" width={700} height={500} className="shadow-2xl rounded-lg hover:scale-105 transition-transform duration-300" />
          </div>
          
        </div>
      </div>
    </>
  );
}
