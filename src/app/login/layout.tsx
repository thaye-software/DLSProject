import { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1920px] mx-auto min-h-screen bg-[#F5F3EE]">
      {children}
    </div>
  );
}
