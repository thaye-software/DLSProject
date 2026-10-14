import { redirect } from "next/navigation";
import { SettingsTabs } from "@/components/Settings/SettingsTabs";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (!user || error) {
    redirect("/login?redirect=/settings");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SettingsTabs />
    </div>
  );
}
