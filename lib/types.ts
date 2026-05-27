export type ProductCategory = "bread" | "pastry" | "cake"

export interface Product {
  id: string
  name: string
  description: string
  price: number
  category: ProductCategory
  image: string
  available: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  total: number
  status: "pending" | "confirmed" | "completed" | "cancelled"
  createdAt: Date
  // Data/hora prevista para levantamento
  pickupAt?: Date
  customerName: string
  customerEmail: string

  // Pagamentos (simulação)
  paymentMethod?: "online" | "pickup"
  paymentStatus?: "unpaid" | "deposit_paid" | "paid"
  depositRequired?: boolean
  depositAmount?: number
  amountPaid?: number
  amountDue?: number
}

export interface User {
  uid: string
  email: string
  displayName: string
  isAdmin: boolean
}
