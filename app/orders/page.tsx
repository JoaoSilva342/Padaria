"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { pt } from "date-fns/locale"
import { Package, Clock, CheckCircle, XCircle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useCart } from "@/contexts/cart-context"
import { getUserOrders } from "@/lib/firebase-data"
import type { Order } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

const statusConfig = {
  pending: {
    label: "Pendente",
    icon: Clock,
    variant: "secondary" as const,
  },
  confirmed: {
    label: "Confirmada",
    icon: Package,
    variant: "default" as const,
  },
  completed: {
    label: "Concluída",
    icon: CheckCircle,
    variant: "default" as const,
  },
  cancelled: {
    label: "Cancelada",
    icon: XCircle,
    variant: "destructive" as const,
  },
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const { setCartItems } = useCart()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
      return
    }

    if (user) {
      loadOrders()
    }
  }, [user, authLoading, router])

  const loadOrders = async () => {
    if (!user) return

    try {
      const data = await getUserOrders(user.uid)
      setOrders(data)
    } catch (error) {
      console.error("Error loading orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRepeatOrder = (order: Order) => {
    setCartItems(order.items)
    router.push("/cart")
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-serif text-2xl font-bold mb-2">Ainda não tem encomendas</h2>
            <p className="text-muted-foreground mb-6">Faça a sua primeira encomenda agora</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2">As Minhas Encomendas</h1>
        <p className="text-muted-foreground">Histórico e estado das suas encomendas</p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const statusInfo = statusConfig[order.status]
          const StatusIcon = statusInfo.icon

          return (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Encomenda #{order.id.slice(0, 8)}
                      <Badge variant={statusInfo.variant}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {format(order.createdAt, "PPP 'às' HH:mm", { locale: pt })}
                      {order.pickupAt ? (
                        <span className="block">Levantamento: {format(order.pickupAt, "PPP 'às' HH:mm", { locale: pt })}</span>
                      ) : null}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{order.total.toFixed(2)} €</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity}x {item.product.price.toFixed(2)} €
                          </p>
                        </div>
                        <p className="font-medium">{(item.quantity * item.product.price).toFixed(2)} €</p>
                      </div>
                      {index < order.items.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Pagamento */}
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">Pagamento</p>
                  <p className="text-muted-foreground mt-1">
                    Método: {order.paymentMethod === "online" ? "Na aplicação" : "No levantamento"}
                    {order.paymentStatus ? ` • Estado: ${
                      order.paymentStatus === "paid" ? "Pago" : order.paymentStatus === "deposit_paid" ? "Sinal pago" : "Por pagar"
                    }` : ""}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Pago: {(order.amountPaid ?? 0).toFixed(2)} € • Em falta: {(order.amountDue ?? Math.max(order.total - (order.amountPaid ?? 0), 0)).toFixed(2)} €
                  </p>
                  {order.depositRequired ? (
                    <p className="text-muted-foreground mt-1">
                      Regra dos 20€: sinal de 50% ({(order.depositAmount ?? 0).toFixed(2)} €).
                    </p>
                  ) : null}
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium">Cliente:</span> {order.customerName}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {order.customerEmail}
                  </p>
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                      {typeof order.amountPaid === "number" && (
                        <>
                          {" "}(pago {order.amountPaid.toFixed(2)} €)
                        </>
                      )}
                      {typeof order.amountDue === "number" && order.amountDue > 0 && (
                        <>
                          {" "}- falta {order.amountDue.toFixed(2)} €
                        </>
                      )}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleRepeatOrder(order)}
                  >
                    Repetir encomenda
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
