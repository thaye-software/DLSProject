// components/Checkout/ProgressSteps.tsx
"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/tailwindUtils"

interface ProgressStepsProps {
  currentStep: number
}

export default function ProgressSteps({ currentStep }: ProgressStepsProps) {
  const steps = ['Billing & Shipping', 'Payment', 'Confirmation']

  return (
    <nav aria-label="Progress" className="mb-6">
      <ol className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, idx) => {
          const stepNumber = idx + 1
          const isComplete = currentStep > stepNumber
          const isCurrent = currentStep === stepNumber
          
          return (
            <li key={step} className="flex items-center flex-1 last:flex-initial">
              {/* Step Circle */}
              <div className="flex flex-col items-center relative z-10">
                <span className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all bg-background",
                  isComplete && "border-primary bg-primary",
                  isCurrent && "border-primary",
                  !isComplete && !isCurrent && "border-border"
                )}>
                  {isComplete ? (
                    <Check className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <span className={cn(
                      "text-sm font-medium",
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    )}>
                      {stepNumber}
                    </span>
                  )}
                </span>
                <span className={cn(
                  "mt-1.5 text-xs font-medium whitespace-nowrap",
                  isCurrent && "text-primary",
                  isComplete && "text-foreground",
                  !isComplete && !isCurrent && "text-muted-foreground"
                )}>
                  {step}
                </span>
              </div>

              {/* Connecting Line */}
              {idx < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-border mx-2 sm:mx-4 -mt-6 relative">
                  <div className={cn(
                    "absolute inset-0 bg-primary transition-all duration-500",
                    isComplete ? "w-full" : "w-0"
                  )} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}