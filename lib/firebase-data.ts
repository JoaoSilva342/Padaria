import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import type { Product, Order } from "./types"

// Products
export async function getProducts() {
  const productsCol = collection(db, "products")
  const productSnapshot = await getDocs(productsCol)
  return productSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)
}

export async function getProductsByCategory(category: string) {
  const productsCol = collection(db, "products")
  const q = query(productsCol, where("category", "==", category))
  const productSnapshot = await getDocs(q)
  return productSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)
}

// Orders
export async function createOrder(orderData: Omit<Order, "id" | "createdAt">) {
  const ordersCol = collection(db, "orders")
  const docRef = await addDoc(ordersCol, {
    ...orderData,
    createdAt: new Date(),
  })
  return docRef.id
}

export async function updateOrderPayment(orderId: string, data: Partial<Pick<Order, "paymentStatus" | "amountPaid" | "amountDue">>) {
  const orderRef = doc(db, "orders", orderId)
  await updateDoc(orderRef, data)
}

function toDateMaybe(value: any): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  // Firestore Timestamp
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value?.toDate === "function") return value.toDate()
  // ISO string
  if (typeof value === "string") {
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

export async function getUserOrders(userId: string) {
  const ordersCol = collection(db, "orders")
  const q = query(ordersCol, where("userId", "==", userId), orderBy("createdAt", "desc"))
  const orderSnapshot = await getDocs(q)
  return orderSnapshot.docs.map((d) => {
    const data: any = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: toDateMaybe(data.createdAt) || new Date(),
      pickupAt: toDateMaybe(data.pickupAt),
    } as Order
  })
}

export async function getAllOrders() {
  const ordersCol = collection(db, "orders")
  const q = query(ordersCol, orderBy("createdAt", "desc"))
  const orderSnapshot = await getDocs(q)
  return orderSnapshot.docs.map((d) => {
    const data: any = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: toDateMaybe(data.createdAt) || new Date(),
      pickupAt: toDateMaybe(data.pickupAt),
    } as Order
  })
}

export async function updateOrderStatus(orderId: string, status: Order["status"]) {
  const orderRef = doc(db, "orders", orderId)
  await updateDoc(orderRef, { status })
}
