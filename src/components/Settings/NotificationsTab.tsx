import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function NotificationsTab() {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage your notification preferences here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="inline-flex gap-3">
          <Switch id="email-notifications" />
            <Label htmlFor="email-notifications">Email Notifications</Label>
            </div>
          <div className="inline-flex gap-3">
          <Switch id="message-notifications" />
          <Label htmlFor="message-notifications">Message Notifications</Label>
          </div>
          <div className="inline-flex gap-3">
          <Switch id="newsletter-subscriptions" />
          <Label htmlFor="newsletter-subscriptions">Newsletter Subscriptions</Label>
          </div>

        </CardContent>
        
        <CardFooter>
          <Button>Save changes</Button>
        </CardFooter>
      </Card>
    </div>
  )
}