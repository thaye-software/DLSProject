"use client"

import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductSafetyInfo {
  id: number | string;
  country: string | null;
  address: string | null;
  address2: string | null;
  zipCode: string | null;
  city: string | null;
  stateProvince: string | null;
  phoneNumber: string | null;
  email: string | null;
  website: string | null;
}

interface ProductSafetyInfoProps {
  safetyInfo: ProductSafetyInfo;
  brandName: string;
}

export default function ProductSafetyInfo({ safetyInfo, brandName }: ProductSafetyInfoProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <Shield size={24} className="" />
            Product Safety Information
          </CardTitle>
          <CardDescription className="">
            Manufacturer details and contact information
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Manufacturer Information */}
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg">
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
            <Card className="">
              <CardHeader>
                <CardTitle className="text-lg">
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
                        className="text-muted-foreground underline transition-colors"
                      >
                        {safetyInfo.website}
                      </a>
                    } 
                  />
                )}
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-muted-foreground space-y-1">
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
          <div className="pt-6 border-t">
            <p className="text-muted-foreground text-xs leading-relaxed">
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
      <span className=" text-sm font-medium min-w-[100px]">{label}:</span>
      <span className="text-muted-foreground text-sm">
        {value}
      </span>
    </div>
  );
}