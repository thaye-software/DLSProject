"use client";
import Image from "next/image";
import React from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CarouselCardProps {
  image: string;
}

export const CarouselCard: React.FC<CarouselCardProps> = ({ image }) => {
  const [showOverlay, setShowOverlay] = useState(false);

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
                className="text-white text-xs px-3 py-2 gap-2 flex items-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <span>Watch model</span>
              </motion.h1>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Plain image — no filter animation to avoid repaints */}
        <Image
          src={image}
          alt={image}
          fill
          style={{ objectFit: "cover" }}
        />
      </motion.div>
    </>
  );
};
