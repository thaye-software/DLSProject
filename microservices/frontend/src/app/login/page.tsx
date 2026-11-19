"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import "swiper/css";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import Logo from "@/components/Home/Logo";
import BackButton from "@/components/Miscellaneous/BackButton";
import { LoginForm } from "@/components/Login";
import { Spinner } from "@/components/ui/spinner";

const images = ["/login_cover.jpg", "/login_cover_1.jpg", "/login_cover_2.jpg"];

function LoginContent() {
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
              Finite Watches
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl mb-12 sm:mb-16 md:mb-20 lg:mb-32 xl:mb-40">
            <div className="max-w-xs mx-auto">
              <LoginForm redirectUrl={redirectUrl || ""} />
            </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading... <Spinner/> </p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}