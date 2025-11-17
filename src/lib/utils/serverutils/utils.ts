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
    console.log('Local development detected, using default location (Denmark/Copenhagen)');
    return {
      country: 'Denmark',
      countryCode: 'DK',
      city: 'Copenhagen',
      currency: 'DKK'
    };
  }
  
  // Production/deployed: use real IP
  const response = await fetch(`https://ipapi.co/${ip}/json/`); // 1000 free request per day per public ip: https://ipapi.co/?utm_source=google&utm_term=ipapi&utm_campaign=10918574075&adgroupid=105679548365&device=c&utm_medium=cpc&utm_content=458785383333&gad_source=1&gad_campaignid=10918574075&gbraid=0AAAAADN_zd-6dfND-l92DzNZAeF87pSBK&gclid=Cj0KCQiA5uDIBhDAARIsAOxj0CGdbtyDVvay8FWqMGaW0ei7hdeWFw71SVt3em_mF1jkzYJnjnKOqOcaAtTvEALw_wcB#pricing
  const data = await response.json();
  
  return {
    country: data.country_name as string,
    countryCode: data.country_code as string,
    city: data.city as string,
    currency: data.currency as string
  };
}
