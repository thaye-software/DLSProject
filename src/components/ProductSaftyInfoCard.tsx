"use client"

import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductSafetyInfo {
  id: number | string;
  country: string;
  address: string;
  address2: string;
  zipCode: string;
  city: string;
  stateProvince: string;
  phoneNumber: string;
  email: string;
  website: string;
}

interface ProductSafetyInfoProps {
  safetyInfo: ProductSafetyInfo;
  brandName: string;
}

export default function ProductSafetyInfo({ safetyInfo, brandName }: ProductSafetyInfoProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <Card className="bg-white border-[#D3C6A3] shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3 text-[#1A1A1A]">
            <Shield size={24} className="text-[#773D0E]" />
            Product Safety Information
          </CardTitle>
          <CardDescription className="text-[#244B5A]">
            Manufacturer details and contact information
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Manufacturer Information */}
            <Card className="bg-[#F5F3EE] border-[#D3C6A3]">
              <CardHeader>
                <CardTitle className="text-lg text-[#773D0E]">
                  Manufacturer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <SafetyInfoItem 
                  label="Brand" 
                  value={brandName} 
                />
                <SafetyInfoItem 
                  label="Country" 
                  value={safetyInfo.country} 
                />
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card className="bg-[#F5F3EE] border-[#D3C6A3]">
              <CardHeader>
                <CardTitle className="text-lg text-[#773D0E]">
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {safetyInfo.phoneNumber && (
                  <SafetyInfoItem 
                    label="Phone" 
                    value={safetyInfo.phoneNumber} 
                  />
                )}
                {safetyInfo.email && (
                  <SafetyInfoItem 
                    label="Email" 
                    value={safetyInfo.email} 
                  />
                )}
                {safetyInfo.website && (
                  <SafetyInfoItem 
                    label="Website" 
                    value={
                      <a 
                        href={safetyInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#244B5A] hover:text-[#773D0E] underline transition-colors"
                      >
                        {safetyInfo.website}
                      </a>
                    } 
                  />
                )}
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card className="bg-[#F5F3EE] border-[#D3C6A3] md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg text-[#773D0E]">
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-[#244B5A] space-y-1">
                  <p>{safetyInfo.address}</p>
                  {safetyInfo.address2 && (
                    <p>{safetyInfo.address2}</p>
                  )}
                  <p>
                    {safetyInfo.zipCode} {safetyInfo.city}
                    {safetyInfo.stateProvince && 
                      `, ${safetyInfo.stateProvince}`
                    }
                  </p>
                  <p className="font-semibold text-[#1A1A1A] pt-1">
                    {safetyInfo.country}
                  </p>
                </address>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <div className="pt-6 border-t border-[#D3C6A3]">
            <p className="text-[#5E561C] text-xs leading-relaxed">
              This information is provided in accordance with EU product safety regulations. 
              For any safety concerns or questions regarding this product, please contact the manufacturer 
              using the details provided above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Component
function SafetyInfoItem({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2">
      <span className="text-[#5E561C] text-sm font-medium min-w-[100px]">{label}:</span>
      <span className="text-[#244B5A] text-sm">
        {value}
      </span>
    </div>
  );
}