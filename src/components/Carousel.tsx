"use client";
import { CarouselCard } from "@/components/CarouselCard";
import { animate, useMotionValue } from "framer-motion";
import { useEffect } from "react";
import useMeasure from "react-use-measure";
import { motion } from "framer-motion";

type Direction = "left" | "right";

export default function Carousel({
  direction = "left",
  duration = 25,
  images,
}: {
  direction?: Direction;
  duration?: number;
  images: (string | { id: number; src: string; brand: string })[];
}) {
  const [ref, { width }] = useMeasure();
  const xTranslation = useMotionValue(0);

  // normalize images to objects { id, src, brand }
  const normalizedImages = images.map((item, idx) =>
    typeof item === "string" ? { id: idx, src: item, brand: "" } : item
  );

  useEffect(() => {
    if (!width) return;
    const singleCopyWidth = width / 2;

    // For left: animate 0 -> -singleCopyWidth, then reset to 0
    // For right: animate -singleCopyWidth -> 0, then reset to -singleCopyWidth
    const startValue = direction === "left" ? 0 : -singleCopyWidth;
    const targetValue = direction === "left" ? -singleCopyWidth : 0;

    // ensure starting position
    xTranslation.set(startValue);

    let controls: ReturnType<typeof animate> | undefined;

    const start = () => {
      controls = animate(xTranslation, targetValue, {
        ease: "linear",
        duration,
        onComplete: () => {
          // reset to start value and restart — duplication of images makes this seamless
          xTranslation.set(startValue);
          start();
        },
      });
    };

    start();
    return () => controls?.stop();
  }, [width, xTranslation, direction, duration]);

  return (
    <div className="w-full overflow-visible">
      <motion.div ref={ref} className="flex w-max" style={{ x: xTranslation }}>
        {[...normalizedImages, ...normalizedImages].map((image, i) => (
          <CarouselCard image={image} key={i} />
        ))}
      </motion.div>
    </div>
  );
}
