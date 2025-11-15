import "server-only"

import { headers } from 'next/headers';

import { createClient } from "@/database/supabase/server";



export async function getSignedInUser() {
  const supabase = await createClient();
  const { 
    data: { user },
    error,
  } = await supabase.auth.getUser();

	return {data: { user }, error}
} 

export async function getUserLocation() {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 
             headersList.get('x-real-ip') || 
             'unknown';
  
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'unknown') {
    console.log('Local development detected, using default location');
    return {
      country: 'Denmark',
      countryCode: 'DK',
      city: 'Copenhagen',
      currency: 'DKK'
    };
  }
  
  // Production/deployed: use real IP
  const response = await fetch(`https://ipapi.co/${ip}/json/`);
  const data = await response.json();
  
  return {
    country: data.country_name,
    countryCode: data.country_code,
    city: data.city,
    currency: data.currency
  };
}
