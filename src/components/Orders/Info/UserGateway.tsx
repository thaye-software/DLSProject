"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoginForm, RegisterForm } from "@/components/Login";

export default function UserGateway({redirectUrl}: {redirectUrl: string}) {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {/* Heading */}
      <h1 className="text-3xl font-bold mb-8 max-w-2xl">
        If you are a new customer, please sign up — otherwise login to proceed.
      </h1>

      {/* Form Container */}
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
              <LoginForm isLogin={isLogin} setIsLogin={setIsLogin} redirectUrl={redirectUrl}/>
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.28 }}
            >
              <RegisterForm isLogin={isLogin} setIsLogin={setIsLogin} redirectUrl={redirectUrl}/>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
