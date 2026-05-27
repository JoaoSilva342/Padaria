// order-summary.js
// Mostra o resumo da encomenda após checkout

document.addEventListener("DOMContentLoaded", () => {
  const orderIdEl = document.getElementById("order-id")
  const orderSummaryDetails = document.getElementById("order-summary-details")
  const orderSummaryItems = document.getElementById("order-summary-items")
  const orderSummaryTotal = document.getElementById("order-summary-total")
  const orderSummaryPickup = document.getElementById("order-summary-pickup")

  // Recuperar dados do resumo (armazenados no checkout)
  const summary = JSON.parse(sessionStorage.getItem("lastOrderSummary") || "null")
  if (!summary) {
    orderIdEl.textContent = "Não foi possível encontrar os detalhes da encomenda."
    return
  }
  orderIdEl.textContent = `Encomenda #${summary.orderId}`

  // Buscar detalhes dos produtos do localStorage (produtos podem ter imagem, categoria, etc)
  let products = []
  try {
    products = JSON.parse(localStorage.getItem("productsCache") || "[]")
  } catch {}

  // Renderizar cada item com imagem, nome, categoria, descrição, preço unitário e subtotal
  let itemsHtml = '<div class="order-items-list">'
  summary.items.forEach(item => {
    let prod = products.find(p => p.name === item.name) || {}
    let img = prod.imageData || prod.image || prod.imageUrl || prod.img || prod.photo || prod.foto || prod.url || prod.picture || "https://images.pexels.com/photos/1070946/pexels-photo-1070946.jpeg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1"
    let cat = prod.category || "-"
    let desc = prod.details || prod.description || ""
    itemsHtml += `
      <div class="order-item-card">
        <img src="${img}" alt="${item.name}" class="order-item-img">
        <div class="order-item-info">
          <div class="order-item-header">
            <span class="order-item-qty">${item.quantity}x</span>
            <span class="order-item-name">${item.name}</span>
            <span class="order-item-category">${cat}</span>
          </div>
          <div class="order-item-desc">${desc}</div>
          <div class="order-item-prices">
            <span class="order-item-unit">${item.price.toFixed(2)} € /un</span>
            <span class="order-item-subtotal">Subtotal: ${(item.price * item.quantity).toFixed(2)} €</span>
          </div>
        </div>
      </div>
    `
  })
  itemsHtml += '</div>'
  orderSummaryItems.innerHTML = itemsHtml

  // Total
  orderSummaryTotal.innerHTML = `<strong>Total da encomenda:</strong> <span class="order-total-value">${summary.total.toFixed(2)} €</span>`

  // Data de levantamento
  orderSummaryPickup.innerHTML = `<strong>Data de levantamento:</strong> ${summary.pickupDate} às ${summary.pickupTime}`

  // Limpar o resumo da sessão depois de mostrar
  sessionStorage.removeItem("lastOrderSummary")
})
