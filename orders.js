import { db, updateCartCount, observeAuthState, showToast } from "./firebase-config.js"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

const PENDING_WINDOW_MS = 5 * 60 * 1000
const READY_BEFORE_PICKUP_MS = 10 * 60 * 1000

let refreshTimer = null
let currentOrders = []
const invoiceModalEl = document.getElementById("invoice-modal")
const invoiceContentEl = document.getElementById("invoice-content")
const invoiceCloseBtnEl = document.getElementById("invoice-close-btn")
const invoicePrintBtnEl = document.getElementById("invoice-print-btn")

function toSafeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatCurrency(value) {
  return `${toSafeNumber(value, 0).toFixed(2)} €`
}

function closeInvoiceModal() {
  if (!invoiceModalEl) return
  invoiceModalEl.style.display = "none"
}

function buildInvoiceMarkup(order) {
  const createdAt = parseCreatedAt(order)
  const invoiceDate = createdAt.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const invoiceTime = createdAt.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  })
  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + toSafeNumber(item.price, 0) * Math.max(1, Number(item.quantity) || 1),
    0,
  )
  const total = toSafeNumber(order.total, subtotal)
  const vatRate = 0.06
  const vatAmount = total - total / (1 + vatRate)
  const pickup = order.pickupDate && order.pickupTime ? `${order.pickupDate} • ${order.pickupTime}` : "Não definido"
  const paymentMethod = order.paymentMethod === "card" ? "Cartão" : order.paymentMethod || "Não definido"
  const paidText = order.paymentStatus === "paid" ? "Pago" : "Por confirmar"
  const customerName = escapeHtml(order.customerName || "Cliente")
  const customerEmail = escapeHtml(order.customerEmail || "N/D")

  return `
    <div class="invoice-cover">
      <div>
        <p class="invoice-kicker">Padaria Portuguesa</p>
        <h3 class="invoice-title">Fatura</h3>
        <p class="invoice-meta">Compra concluída com sucesso</p>
      </div>
      <div class="invoice-number-chip">N.º ${escapeHtml(order.id.slice(0, 8).toUpperCase())}</div>
    </div>

    <div class="invoice-header">
      <div>
        <p class="invoice-section-label">Fornecedor</p>
        <p class="invoice-meta">Padaria Portuguesa</p>
        <p class="invoice-meta">Loja Online</p>
      </div>
      <div class="invoice-meta-right">
        <p><strong>Data:</strong> ${invoiceDate}</p>
        <p><strong>Hora:</strong> ${invoiceTime}</p>
      </div>
    </div>

    <div class="invoice-summary-strip">
      <div class="invoice-summary-chip"><span>Levantamento</span><strong>${pickup}</strong></div>
      <div class="invoice-summary-chip"><span>Pagamento</span><strong>${paymentMethod}${order.cardLast4 ? ` • **** ${escapeHtml(order.cardLast4)}` : ""}</strong></div>
      <div class="invoice-summary-chip"><span>Estado</span><strong>${paidText}</strong></div>
    </div>

    <div class="invoice-blocks">
      <div class="invoice-block">
        <h4>Fornecedor</h4>
        <p>Padaria Portuguesa</p>
        <p>Loja Online</p>
      </div>
      <div class="invoice-block">
        <h4>Cliente</h4>
        <p>${customerName}</p>
        <p>${customerEmail}</p>
      </div>
      <div class="invoice-block">
        <h4>Encomenda</h4>
        <p><strong>Levantamento:</strong> ${pickup}</p>
        <p><strong>Pagamento:</strong> ${paymentMethod}${order.cardLast4 ? ` • **** ${escapeHtml(order.cardLast4)}` : ""}</p>
        <p><strong>Estado:</strong> ${paidText}</p>
      </div>
    </div>

    <div class="invoice-lines">
      <div class="invoice-line invoice-line-head">
        <span>Descrição</span>
        <span>Qtd.</span>
        <span>Preço</span>
        <span>Total</span>
      </div>
      ${(order.items || [])
        .map((item) => {
          const qty = Math.max(1, Number(item.quantity) || 1)
          const price = toSafeNumber(item.price, 0)
          const lineTotal = price * qty
          return `
            <div class="invoice-line">
              <span>${escapeHtml(item.name || "Produto")}</span>
              <span>${qty}</span>
              <span>${formatCurrency(price)}</span>
              <span>${formatCurrency(lineTotal)}</span>
            </div>
          `
        })
        .join("")}
    </div>

    <div class="invoice-totals">
      <p><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></p>
      <p><span>IVA (incluído, 6%)</span><strong>${formatCurrency(vatAmount)}</strong></p>
      <p><span>Levantamento</span><strong>Em loja</strong></p>
      <p class="invoice-total"><span>Total</span><strong>${formatCurrency(total)}</strong></p>
    </div>
  `
}

function openInvoiceModal(orderId) {
  const order = currentOrders.find((o) => o.id === orderId)
  if (!order || !invoiceModalEl || !invoiceContentEl) return
  invoiceContentEl.innerHTML = buildInvoiceMarkup(order)
  invoiceModalEl.style.display = "flex"
}

function setupInvoiceModal() {
  invoiceCloseBtnEl?.addEventListener("click", closeInvoiceModal)
  invoiceModalEl?.addEventListener("click", (e) => {
    if (e.target === invoiceModalEl) {
      closeInvoiceModal()
    }
  })
  invoicePrintBtnEl?.addEventListener("click", () => {
    window.print()
  })
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && invoiceModalEl?.style.display !== "none") {
      closeInvoiceModal()
    }
  })
}

function repeatOrder(orderId) {
  const order = currentOrders.find((o) => o.id === orderId)
  if (!order) return

  const existingCart = JSON.parse(localStorage.getItem("cart") || "[]")
  const existingMap = new Map(existingCart.map((item) => [item?.product?.id, item]))

  ;(order.items || []).forEach((item, index) => {
    const productId = item.productId || `order-${order.id}-${index}`
    const normalizedItem = {
      product: {
        id: productId,
        name: item.name || "Produto",
        price: toSafeNumber(item.price, 0),
        description: item.description || "",
        image: item.image || item.imageUrl || item.imageData || "",
      },
      quantity: Math.max(1, Number(item.quantity) || 1),
    }

    if (existingMap.has(productId)) {
      const current = existingMap.get(productId)
      current.quantity = Math.max(1, Number(current.quantity) || 1) + normalizedItem.quantity
      return
    }

    existingMap.set(productId, normalizedItem)
  })

  const finalCart = Array.from(existingMap.values())
  if (!finalCart.length) {
    showToast("Sem itens", "Esta encomenda não tem itens para repetir.", "error")
    return
  }

  localStorage.setItem("cart", JSON.stringify(finalCart))
  updateCartCount()
  showToast("Comprado novamente", "Os itens foram adicionados ao carrinho.", "success")
  setTimeout(() => {
    window.location.href = "cart.html"
  }, 450)
}

function parseCreatedAt(order) {
  if (order?.createdAt?.toDate) return order.createdAt.toDate()
  const d = new Date(order?.createdAt || 0)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

function parsePickupAt(order) {
  if (!order?.pickupDate || !order?.pickupTime) return null
  const d = new Date(`${order.pickupDate}T${order.pickupTime}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function computeAutoStatus(order, now = new Date()) {
  const current = order.status || "pending"
  if (current === "cancelled" || current === "completed") return current

  const createdAt = parseCreatedAt(order)
  let status = now.getTime() - createdAt.getTime() >= PENDING_WINDOW_MS ? "preparing" : "pending"

  const pickupAt = parsePickupAt(order)
  if (pickupAt && now.getTime() >= pickupAt.getTime() - READY_BEFORE_PICKUP_MS) {
    status = "ready"
  }

  return status
}

function canCancel(order, now = new Date()) {
  if (!order) return false
  if (order.status === "cancelled" || order.status === "completed") return false
  const createdAt = parseCreatedAt(order)
  return now.getTime() - createdAt.getTime() < PENDING_WINDOW_MS
}

observeAuthState(async (user) => {
  const loading = document.getElementById("loading")
  const authRequired = document.getElementById("auth-required")
  const ordersList = document.getElementById("orders-list")
  const emptyOrders = document.getElementById("empty-orders")

  if (!user) {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    loading.style.display = "none"
    authRequired.style.display = "flex"
    ordersList.style.display = "none"
    emptyOrders.style.display = "none"
    return
  }

  authRequired.style.display = "none"
  await loadOrders(user.uid)
})

async function loadOrders(userId) {
  const loading = document.getElementById("loading")
  const ordersList = document.getElementById("orders-list")
  const emptyOrders = document.getElementById("empty-orders")

  try {
    const q = query(collection(db, "orders"), where("userId", "==", userId))
    const querySnapshot = await getDocs(q)

    currentOrders = querySnapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      .sort((a, b) => parseCreatedAt(b).getTime() - parseCreatedAt(a).getTime())

    loading.style.display = "none"

    if (currentOrders.length === 0) {
      emptyOrders.style.display = "flex"
      ordersList.style.display = "none"
      if (refreshTimer) {
        clearInterval(refreshTimer)
        refreshTimer = null
      }
      return
    }

    emptyOrders.style.display = "none"
    ordersList.style.display = "flex"
    renderOrders()

    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(renderOrders, 30 * 1000)
  } catch (error) {
    console.error("[v0] Error loading orders:", error)
    loading.style.display = "none"
    loading.innerHTML = "<p>Erro ao carregar encomendas.</p>"
  }
}

function renderOrders() {
  const ordersList = document.getElementById("orders-list")

  const statusLabels = {
    pending: "Pendente",
    preparing: "Em preparação",
    ready: "Pronta",
    completed: "Concluída",
    cancelled: "Cancelada",
  }

  const statusIcons = {
    pending:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    preparing:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    ready:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    completed:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    cancelled:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  }

  ordersList.innerHTML = currentOrders
    .map((order) => {
      const date = parseCreatedAt(order)
      const effectiveStatus = computeAutoStatus(order)
      const dateStr = date.toLocaleDateString("pt-PT", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

      const pickupStr =
        order.pickupDate && order.pickupTime ? `${order.pickupDate} • ${order.pickupTime}` : null
      const showCancel = canCancel(order) && effectiveStatus === "pending"

      return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">Encomenda #${order.id.slice(0, 8)}</div>
            <div class="order-date">${dateStr}</div>
            ${pickupStr ? `<div class="order-date"><strong>Levantamento:</strong> ${pickupStr}</div>` : ""}
          </div>
          <div class="order-status ${effectiveStatus}">
            ${statusIcons[effectiveStatus] || ""}
            ${statusLabels[effectiveStatus] || effectiveStatus}
          </div>
        </div>
        
        <div class="order-items">
          ${order.items
            .map(
              (item) => `
            <div class="order-item">
              <span>${item.quantity}x ${item.name}</span>
              <span>${(item.price * item.quantity).toFixed(2)} €</span>
            </div>
          `,
            )
            .join("")}
        </div>
        
        <div class="order-footer">
          <span>Total</span>
          <span class="order-total">${order.total.toFixed(2)} €</span>
        </div>

        <div class="order-actions">
          <button class="btn-secondary view-invoice-btn" data-order-id="${order.id}">Ver fatura</button>
          <button class="btn-secondary repeat-order-btn" data-order-id="${order.id}">Comprar novamente</button>
          ${
            showCancel
              ? `<button class="btn-secondary cancel-order-btn" data-order-id="${order.id}">Cancelar encomenda</button>`
              : ""
          }
        </div>
      </div>
    `
    })
    .join("")

  ordersList.querySelectorAll(".view-invoice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id")
      if (!orderId) return
      openInvoiceModal(orderId)
    })
  })

  ordersList.querySelectorAll(".repeat-order-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id")
      if (!orderId) return
      repeatOrder(orderId)
    })
  })

  ordersList.querySelectorAll(".cancel-order-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.getAttribute("data-order-id")
      if (!orderId) return
      await cancelOrder(orderId)
    })
  })
}

async function cancelOrder(orderId) {
  const order = currentOrders.find((o) => o.id === orderId)
  if (!order) return

  if (!canCancel(order)) {
    showToast("Tempo esgotado", "Já não é possível cancelar esta encomenda.", "error")
    renderOrders()
    return
  }

  try {
    await updateDoc(doc(db, "orders", orderId), { status: "cancelled" })
    order.status = "cancelled"
    showToast("Encomenda cancelada", "A sua encomenda foi cancelada com sucesso.", "success")
    renderOrders()
  } catch (error) {
    console.error("[v0] Error cancelling order:", error)
    showToast("Erro", "Não foi possível cancelar a encomenda.", "error")
  }
}

updateCartCount()
setupInvoiceModal()
