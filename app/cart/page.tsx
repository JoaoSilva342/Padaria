"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { createOrder } from "@/lib/firebase-data"

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, total, clearCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [customerName, setCustomerName] = useState(user?.displayName || "")
  const [customerEmail, setCustomerEmail] = useState(user?.email || "")

  // Levantamento
  const [pickupDate, setPickupDate] = useState("")
  const [pickupTime, setPickupTime] = useState("")

  // Pagamento (simulado)
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pickup">("pickup")
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)

  const depositRequired = total > 20
  const depositAmount = Math.round((total / 2) * 100) / 100
  const amountPaid = depositRequired ? depositAmount : paymentMethod === "online" ? total : 0
  const amountDue = Math.round((total - amountPaid) * 100) / 100

  const needsPaymentNow = paymentMethod === "online" || depositRequired

  const handleCheckout = async () => {
    if (!customerName || !customerEmail) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      })
      return
    }

    if (!pickupDate || !pickupTime) {
      toast({
        title: "Erro",
        description: "Por favor, selecione a data e a hora de levantamento",
        variant: "destructive",
      })
      return
    }

    if (needsPaymentNow && !paymentConfirmed) {
      toast({
        title: "Pagamento em falta",
        description: depositRequired
          ? "Para encomendas acima de 20€, é necessário pagar 50% agora."
          : "Selecione e confirme o pagamento na aplicação para continuar.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      const pickupAt = new Date(`${pickupDate}T${pickupTime}`)

      const orderId = await createOrder({
        userId: user?.uid || "guest",
        items,
        total,
        status: "pending",
        pickupAt,
        customerName,
        customerEmail,

        paymentMethod,
        paymentStatus: needsPaymentNow ? (depositRequired ? "deposit_paid" : "paid") : "unpaid",
        depositRequired,
        depositAmount: depositRequired ? depositAmount : 0,
        amountPaid,
        amountDue,
      })

      toast({
        title: "Encomenda realizada!",
        description: `A sua encomenda #${orderId.slice(0, 8)} foi registada com sucesso`,
      })

      clearCart()
      if (user) {
        router.push("/orders")
      } else {
        router.push("/")
      }
    } catch (error) {
      console.error("Error creating order:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar a encomenda",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-serif text-2xl font-bold mb-2">O seu carrinho está vazio</h2>
            <p className="text-muted-foreground mb-6">Adicione produtos deliciosos ao seu carrinho</p>
            <Button onClick={() => router.push("/")} size="lg">
              Ver Produtos
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-serif text-3xl font-bold mb-8">Carrinho de Compras</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.product.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image
                      src={item.product.image || "/placeholder.svg"}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-serif text-lg font-semibold mb-1">{item.product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{item.product.description}</p>
                    <p className="text-lg font-bold text-primary">{item.product.price.toFixed(2)} €</p>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="font-serif">Resumo da Encomenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{total.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Levantamento</span>
                  <span>Em loja</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{total.toFixed(2)} €</span>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    placeholder="João Silva"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="joao@exemplo.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="font-semibold">Levantamento</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="pickup-date">Data</Label>
                      <Input id="pickup-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pickup-time">Hora</Label>
                      <Input id="pickup-time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A encomenda ficará preparada para a data e hora selecionadas.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="font-semibold">Pagamento</h3>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => {
                      setPaymentMethod(v as any)
                      setPaymentConfirmed(false)
                    }}
                    className="gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pickup" id="pay-pickup" />
                      <Label htmlFor="pay-pickup">Pagar ao levantar</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="online" id="pay-online" />
                      <Label htmlFor="pay-online">Pagar na aplicação (simulado)</Label>
                    </div>
                  </RadioGroup>

                  {depositRequired ? (
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">Encomenda acima de 20€</p>
                      <p className="text-muted-foreground mt-1">
                        É necessário pagar <span className="font-medium">50% agora</span> ({depositAmount.toFixed(2)} €).
                        O restante ({amountDue.toFixed(2)} €) é pago no levantamento.
                      </p>
                    </div>
                  ) : paymentMethod === "online" ? (
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">Pagamento na aplicação</p>
                      <p className="text-muted-foreground mt-1">Será simulado um pagamento do total ({total.toFixed(2)} €).</p>
                    </div>
                  ) : null}

                  {needsPaymentNow && (
                    <Button
                      type="button"
                      variant={paymentConfirmed ? "secondary" : "default"}
                      className="w-full"
                      onClick={() => setPaymentConfirmed(true)}
                      disabled={paymentConfirmed}
                    >
                      {paymentConfirmed ? "Pagamento confirmado" : "Pagar agora (simulação)"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={handleCheckout} disabled={isProcessing}>
                {isProcessing ? "A processar..." : "Finalizar Encomenda"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
