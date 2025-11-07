"use client";

import Carousel from "@/components/Carousel";

const images = [
  "/carousel/1.jpg",
  "/carousel/2.jpg",
  "/carousel/3.jpg",
  "/carousel/4.jpg",
  "/carousel/5.jpg",
  "/carousel/6.jpg",
  "/carousel/7.jpg",
  "/carousel/8.jpg",
];

const images2 = [
  "/carousel2/1.jpg",
  "/carousel2/2.jpg",
  "/carousel2/3.jpg",
  "/carousel2/4.jpg",
  "/carousel2/5.jpg",
  "/carousel2/6.jpg",
  "/carousel2/7.jpg",
]

export default function Home() {
  return (
    <div className="">
      <div className="">
        <Carousel direction="left" duration={70} images={images} />
      </div>

      <div className="absolute inset-x-0 z-10 transform -translate-y-9  pointer-events-none">
        <h1 className="text-white mx-auto text-6xl font-bold text-center drop-shadow-lg">
          Limited Watches
        </h1>
      </div>

      <div className="">
        <Carousel direction="right" duration={80} images={images2} />
      </div>
    </div>
  );
}
