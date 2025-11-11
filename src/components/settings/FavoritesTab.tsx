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
import { Button } from "@/components/ui/button"

export default function FavoritesTab() {
  return (
    <div>
      <Card>
            <CardHeader>
              <CardTitle>Favorites</CardTitle>
              <CardDescription>
                Manage your favorite items here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="tabs-demo-favorite-item">Favorite Item</Label>
                <Input id="tabs-demo-favorite-item" defaultValue="Item 1" />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save changes</Button>
            </CardFooter>
          </Card>
    </div>
  );
}