import { AppWindowIcon, CodeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import AccountTab from "./AccountTab"
import FavoritesTab from "./FavoritesTab"
import PasswordTab from "./PasswordTab"
import NotificationsTab from "./NotificationsTab"

export function SettingsTabs() {
  return (
    <div>
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger className="font-bold" value="account">Account</TabsTrigger>
          <TabsTrigger className="font-bold" value="favorites">Favorites</TabsTrigger>
          <TabsTrigger className="font-bold" value="password">Password</TabsTrigger>
          <TabsTrigger className="font-bold" value="notifications">Notifications</TabsTrigger>
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
  )
}
