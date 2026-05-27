"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { pt } from "date-fns/locale"
import { Package, TrendingUp, ShoppingBag, Users } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getAllOrders, updateOrderStatus, updateOrderPayment } from "@/lib/firebase-data"
import type { Order } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const statusOptions: Array<{ value: Order["status"]; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
]

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
      return
    }

    // Check if user is admin (in a real app, check Firebase custom claims)
    if (user && !user.isAdmin) {
      router.push("/")
      return
    }

    if (user) {
      loadOrders()
    }
  }, [user, authLoading, router])

  const loadOrders = async () => {
    try {
      const data = await getAllOrders()
      setOrders(data)
    } catch (error) {
      console.error("Error loading orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: Order["status"]) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)))
      toast({
        title: "Estado atualizado",
        description: "O estado da encomenda foi atualizado com sucesso",
      })
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o estado",
        variant: "destructive",
      })
    }
  }

  const handleMarkRemainingAsPaid = async (order: Order) => {
    try {
      await updateOrderPayment(order.id, {
        paymentStatus: "paid",
        amountPaid: order.total,
        amountDue: 0,
      })
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                paymentStatus: "paid",
                amountPaid: order.total,
                amountDue: 0,
              }
            : o,
        ),
      )
      toast({
        title: "Pagamento atualizado",
        description: "O restante foi marcado como pago",
      })
    } catch (error) {
      console.error("Error updating payment:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o pagamento",
        variant: "destructive",
      })
    }
  }

  // Calculate statistics
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const pendingOrders = orders.filter((o) => o.status === "pending").length
  const completedOrders = orders.filter((o) => o.status === "completed").length

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2">Painel de Administração</h1>
        <p className="text-muted-foreground">Gerir encomendas e estatísticas</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Encomendas</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Todas as encomendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground mt-1">Valor total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">A aguardar confirmação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Já entregues</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Encomendas</CardTitle>
          <CardDescription>Gerir e atualizar o estado das encomendas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div key={order.id}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                      <Badge variant="outline" className="text-xs">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} itens
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(order.createdAt, "PPP 'às' HH:mm", { locale: pt })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.customerName} ({order.customerEmail})
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">{order.total.toFixed(2)} €</p>
                    </div>

                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value as Order["status"])}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Order Items Details */}
                <div className="mt-3 pl-4 border-l-2 border-muted space-y-1">
                  {order.items.map((item, itemIndex) => (
                    <p key={itemIndex} className="text-sm text-muted-foreground">
                      {item.quantity}x {item.product.name} - {(item.quantity * item.product.price).toFixed(2)} €
                    </p>
                  ))}
                </div>

                <div className="mt-3 pl-4 border-l-2 border-muted">
                  <div className="text-sm text-muted-foreground space-y-1">
                    {order.pickupAt && (
                      <p>
                        <span className="font-medium">Levantamento:</span> {format(order.pickupAt, "PPP 'às' HH:mm", { locale: pt })}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Pagamento:</span>{" "}
                      {order.paymentStatus === "paid"
                        ? "Pago"
                        : order.paymentStatus === "deposit_paid"
                          ? "Sinal pago"
                          : "Por pagar"}
                      {typeof order.amountPaid === "number" ? ` (pago ${order.amountPaid.toFixed(2)} €)` : ""}
                      {typeof order.amountDue === "number" && order.amountDue > 0 ? ` - falta ${order.amountDue.toFixed(2)} €` : ""}
                    </p>
                  </div>

                  {typeof order.amountDue === "number" && order.amountDue > 0 && (
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={() => handleMarkRemainingAsPaid(order)}>
                        Marcar restante como pago
                      </Button>
                    </div>
                  )}
                </div>

                {index < orders.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}

            {orders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Ainda não existem encomendas</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
