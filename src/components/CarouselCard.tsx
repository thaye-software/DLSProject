"use client";
import Image from "next/image";
import React from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

interface CarouselCardProps {
  image: { id: number; src: string; brand: string };
}

export const CarouselCard: React.FC<CarouselCardProps> = ({ image }) => {
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(false);

  const brandToSlug = (brand: string) => {
    return brand.toLowerCase().replace(/\s+/g, "-");
  };

  return (
    <>
      <motion.div
        className="relative h-[500px] w-[600px] flex justify-center items-center"
        onHoverStart={() => setShowOverlay(true)}
        onHoverEnd={() => setShowOverlay(false)}
      >
        {/* Composited dim overlay (animating opacity) — cheaper than animating filter on the image */}
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: showOverlay ? 0.32 : 0.5 }}
          style={{ backgroundColor: "black" }}
          transition={{ duration: 0.18 }}
        />

        <AnimatePresence>
          {showOverlay && (
            <motion.div
              className="absolute inset-0 z-20 bg-black/50 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.h1
                className="text-white text-xl px-3 py-2 gap-2 flex justify-center items-center h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <Button
                  
                  onClick={() =>
                    router.push(`/watches/${brandToSlug(image.brand)}`)
                  }
                  className="group inline-flex text-2xl font-bold gap-2 cursor-pointer pointer-events-auto text-white/90 bg-transparent hover:bg-transparent"
                >
                  {image.brand}
                  <span
                    className="transition-transform duration-300 transform group-hover:translate-x-2"
                  >
                    <ArrowRight className=" inline items-center mb-1" />
                  </span>
                </Button>
              </motion.h1>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Plain image — no filter animation to avoid repaints */}
        <Image
          src={image.src}
          alt={image.brand}
          fill
          style={{ objectFit: "cover" }}
        />
      </motion.div>
    </>
  );
};
