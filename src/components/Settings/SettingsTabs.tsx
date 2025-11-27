"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccountTab from "./AccountTab";
import FavoritesTab from "./FavoritesTab";
import PasswordTab from "./PasswordTab";
import NotificationsTab from "./NotificationsTab";

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (
        ["account", "favorites", "password", "notifications"].includes(hash)
      ) {
        setActiveTab(hash);
      }
    };

    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  const onTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger className="font-bold" value="account">
            Account
          </TabsTrigger>
          <TabsTrigger className="font-bold" value="favorites">
            Favorites
          </TabsTrigger>
          <TabsTrigger className="font-bold" value="password">
            Password
          </TabsTrigger>
          <TabsTrigger className="font-bold" value="notifications">
            Notifications
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
        <TabsContent value="favorites">
          <FavoritesTab />
        </TabsContent>
        <TabsContent value="password">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
