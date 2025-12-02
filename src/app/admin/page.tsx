import { Package, ShoppingCart, Users, DollarSign, TrendingUp, Clock, AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">AD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$2,847,392</div>
              <p className="text-xs text-chart-1 mt-1">+12.5% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Orders
              </CardTitle>
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-xs text-chart-1 mt-1">+8.2% from last month</p>
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
              <div className="text-2xl font-bold">289</div>
              <p className="text-xs text-muted-foreground mt-1">In stock • 342 total</p>
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
              <div className="text-2xl font-bold">8,432</div>
              <p className="text-xs text-chart-1 mt-1">+24 new today</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Orders */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest transactions from your store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: '#ORD-2847', customer: 'James Mitchell', watch: 'Rolex Submariner', amount: '$12,450', status: 'completed' },
                  { id: '#ORD-2846', customer: 'Sarah Chen', watch: 'Patek Philippe Nautilus', amount: '$48,900', status: 'processing' },
                  { id: '#ORD-2845', customer: 'Robert Anderson', watch: 'Omega Speedmaster', amount: '$6,200', status: 'completed' },
                  { id: '#ORD-2844', customer: 'Emily Davis', watch: 'Cartier Santos', amount: '$7,850', status: 'pending' },
                  { id: '#ORD-2843', customer: 'Michael Brown', watch: 'Audemars Piguet Royal Oak', amount: '$35,600', status: 'completed' },
                ].map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{order.customer}</p>
                      <p className="text-xs text-muted-foreground">{order.id} • {order.watch}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-semibold text-foreground">{order.amount}</p>
                      <Badge 
                        variant={order.status === 'completed' ? 'default' : 'secondary'}
                        className={
                          order.status === 'completed' ? 'bg-chart-1/20 text-chart-1 hover:bg-chart-1/30' :
                          order.status === 'processing' ? 'bg-chart-2/20 text-chart-2 hover:bg-chart-2/30' :
                          'bg-chart-4/20 text-chart-4 hover:bg-chart-4/30'
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions & Alerts */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start gap-3" size="lg">
                  <Package className="w-5 h-5" />
                  Add New Product
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" size="lg">
                  <ShoppingCart className="w-5 h-5" />
                  View All Orders
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" size="lg">
                  <TrendingUp className="w-5 h-5" />
                  Analytics
                </Button>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Low Stock Alert</p>
                    <p className="text-xs text-muted-foreground mt-1">5 products below threshold</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 bg-chart-4/10 border border-chart-4/20 rounded-lg">
                  <Clock className="w-5 h-5 text-chart-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Pending Reviews</p>
                    <p className="text-xs text-muted-foreground mt-1">12 customer reviews awaiting approval</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
