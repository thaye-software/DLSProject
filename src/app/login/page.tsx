"use client";

import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const images = ["/login_cover.jpg", "/login_cover_1.jpg", "/login_cover_2.jpg"];

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-between items-center gap-2">
          <Button onClick={() => window.history.back()} variant="ghost">
            <ArrowLeft />
            Back
          </Button>
          <div className="flex items-center justify-end flex-1">
            <Image
              src="/logo.svg"
              alt="Logo"
              className="fill-black"
              width={56}
              height={56}
            />
            <span className="text-2xl font-seasons font-semibold">
              Limited Watches
            </span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.28 }}
                >
                  <LoginForm isLogin={isLogin} setIsLogin={setIsLogin} />
                </motion.div>
              ) : (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.28 }}
                >
                  <RegisterForm isLogin={isLogin} setIsLogin={setIsLogin} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <Swiper
          className="absolute inset-0 h-full w-full"
          modules={[Autoplay]}
          spaceBetween={0}
          slidesPerView={1}
          loop={true}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
        >
          {images.map((src, idx) => (
            <SwiperSlide key={idx}>
              <img
                src={src}
                alt={`Login slide ${idx + 1}`}
                className="h-full w-full object-cover dark:brightness-[0.8]"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
