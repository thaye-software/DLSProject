"use client";

import Carousel from "@/components/Carousel";

export default function Home() {
  return (
    <div className="">
      <div className="">
        <Carousel direction="left" duration={40} />
      </div>

      <div className="absolute inset-x-0 z-10 transform -translate-y-9  pointer-events-none">
        <h1 className="text-white mx-auto text-6xl font-bold text-center drop-shadow-lg">
          Limited Watches
        </h1>
      </div>

      <div className="">
        <Carousel direction="right" duration={50} />
      </div>
    </div>
  );
}
