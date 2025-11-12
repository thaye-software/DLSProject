"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { LoginForm, RegisterForm } from "@/components/Login";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import { AnimatePresence, motion } from "framer-motion";

import Logo from "@/components/Logo";
import BackButton from "@/components/BackButton";

const images = ["/login_cover.jpg", "/login_cover_1.jpg", "/login_cover_2.jpg"];

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const searchParams = useSearchParams();
  const redirectUrl: string | null = searchParams.get("redirect");
  
  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background text-foreground">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-between items-center gap-2">
          <BackButton />
          <div className="flex items-center justify-end flex-1">
            <Logo className="h-8 w-8 dark:text-white mr-2" />
            <span className="text-2xl font-seasons font-semibold">
              Limited Watches
            </span>
          </div>
        </div>

        {redirectUrl && (
          <div className="flex flex-col items-center justify-center text-center">
            {/* Heading with responsive spacing */}
            <h1 className="text-3xl font-bold max-w-2xl mt-8 sm:mt-12 md:mt-16 lg:mt-20 xl:mt-24">
              If you are a new customer, please sign up — otherwise login to proceed.
            </h1>
          </div>
        )}
       

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs mb-12 sm:mb-16 md:mb-20 lg:mb-32 xl:mb-40">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.28 }}
                >
                  <LoginForm isLogin={isLogin} setIsLogin={setIsLogin} redirectUrl={redirectUrl ? redirectUrl : ""}/>
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