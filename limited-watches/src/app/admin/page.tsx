import { Package, ShoppingCart, Users, DollarSign, TrendingUp, Clock, AlertCircle, Settings, CreditCard, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { getAllDeliveredOrders, getAllPendingOrders, getAllTimeRevenueDkk } from '@/services/orderService';
import { getAllProducts, getTotalProductStock } from '@/services/productService';
import { getAllUniqueCustomers } from '@/services/userService';
import OrdersTable from '@/components/Admin/Dashboard/OrdersTable';

export default async function AdminLayout() {
  const allTimeRevenue = await getAllTimeRevenueDkk();
  
  const totalOrders = (await getAllDeliveredOrders()).length;
  
  const totalProducts = (await getAllProducts()).length;
  const totalStock = await getTotalProductStock();
  
  const uniqueCustomers = await getAllUniqueCustomers();
  const allPendingOrders = await getAllPendingOrders();




  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <h1 className="font-bold text-xl mb-4">All time analytics</h1>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue
              </CardTitle>
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <Landmark className="w-5 h-5 text-accent-foreground" />
              </div>
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold">{allTimeRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Delivered Orders
              </CardTitle>
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Customers
              </CardTitle>
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueCustomers}</div>
            </CardContent>
          </Card>

           <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Products
              </CardTitle>
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground mt-1">In stock • {totalStock}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <OrdersTable allPendingOrders={allPendingOrders} />

          {/* Quick Actions & Alerts */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                   <div className="flex flex-col gap-3">

                    <Link href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full justify-start gap-3" size="lg">
                        <CreditCard className="w-5 h-5" />
                        Stripe - Payments
                      </Button>
                    </Link>

                    <Link href="https://eu.posthog.com/" target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full justify-start gap-3" size="lg">
                        <TrendingUp className="w-5 h-5" />
                        PostHog - Analytics 
                      </Button>
                    </Link>
                   </div>

              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
