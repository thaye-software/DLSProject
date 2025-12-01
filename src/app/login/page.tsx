"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import "swiper/css";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { AnimatePresence, motion } from "framer-motion";

import Logo from "@/components/Logo";
import BackButton from "@/components/BackButton";
import { LoginForm, RegisterForm } from "@/components/Login";
import { Spinner } from "@/components/ui/spinner";
import { LogIn, UserPlus } from "lucide-react";

const images = ["/login_cover.jpg", "/login_cover_1.jpg", "/login_cover_2.jpg"];

function LoginContent() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [customerTypeSelected, setCustomerTypeSelected] = useState<boolean>(false);
  const searchParams = useSearchParams();
  const redirectUrl: string | null = searchParams.get("redirect");
  
  const handleCustomerTypeSelection = (isExistingCustomer: boolean) => {
    setIsLogin(isExistingCustomer);
    setCustomerTypeSelected(true);
  };

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

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl mb-12 sm:mb-16 md:mb-20 lg:mb-32 xl:mb-40">
            {redirectUrl && !customerTypeSelected ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-6"
              >
                <h1 className="text-3xl font-bold text-center max-w-2xl">
                  Welcome! Are you a new or existing customer?
                </h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-8">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCustomerTypeSelection(false)}
                    className="flex flex-col items-center justify-center p-8 border-2 border-border rounded-lg hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className="text-5xl mb-4"><UserPlus/></div>
                    <h2 className="text-xl font-semibold mb-2">New Customer</h2>
                    <p className="text-sm text-muted-foreground text-center">
                      Create an account to get started
                    </p>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCustomerTypeSelection(true)}
                    className="flex flex-col items-center justify-center p-8 border-2 border-border rounded-lg hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className="text-5xl mb-4"><LogIn/></div>
                    <h2 className="text-xl font-semibold mb-2">Existing Customer</h2>
                    <p className="text-sm text-muted-foreground text-center">
                      Sign in to your account
                    </p>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <div className="max-w-xs mx-auto">
                <AnimatePresence mode="wait">
                  {isLogin ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.28 }}
                    >
                      <LoginForm 
                        isLogin={isLogin} 
                        setIsLogin={setIsLogin} 
                        redirectUrl={redirectUrl || ""}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.28 }}
                    >
                      <RegisterForm 
                        isLogin={isLogin} 
                        setIsLogin={setIsLogin} 
                        redirectUrl={redirectUrl || ""} 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
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