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
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  const listWrap = document.createElement('div')
  listWrap.className = 'order-items-list'

  summary.items.forEach(item => {
    const prod = products.find(p => p.name === item.name) || {}
    const img = escapeHtml(prod.imageData || prod.image || prod.imageUrl || prod.img || prod.photo || prod.foto || prod.url || prod.picture || "https://images.pexels.com/photos/1070946/pexels-photo-1070946.jpeg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1")
    const cat = escapeHtml(prod.category || "-")
    const desc = escapeHtml(prod.details || prod.description || "")

    const card = document.createElement('div')
    card.className = 'order-item-card'

    const imgEl = document.createElement('img')
    imgEl.className = 'order-item-img'
    imgEl.src = img
    imgEl.alt = escapeHtml(item.name)

    const info = document.createElement('div')
    info.className = 'order-item-info'

    const header = document.createElement('div')
    header.className = 'order-item-header'
    const qty = document.createElement('span')
    qty.className = 'order-item-qty'
    qty.textContent = `${Number(item.quantity)}x`
    const nameEl = document.createElement('span')
    nameEl.className = 'order-item-name'
    nameEl.textContent = item.name
    const catEl = document.createElement('span')
    catEl.className = 'order-item-category'
    catEl.textContent = cat

    header.appendChild(qty)
    header.appendChild(nameEl)
    header.appendChild(catEl)

    const descEl = document.createElement('div')
    descEl.className = 'order-item-desc'
    descEl.textContent = desc

    const prices = document.createElement('div')
    prices.className = 'order-item-prices'
    const unit = document.createElement('span')
    unit.className = 'order-item-unit'
    unit.textContent = `${Number(item.price).toFixed(2)} € /un`
    const subtotal = document.createElement('span')
    subtotal.className = 'order-item-subtotal'
    subtotal.textContent = `Subtotal: ${(Number(item.price) * Number(item.quantity)).toFixed(2)} €`

    prices.appendChild(unit)
    prices.appendChild(subtotal)

    info.appendChild(header)
    info.appendChild(descEl)
    info.appendChild(prices)

    card.appendChild(imgEl)
    card.appendChild(info)
    listWrap.appendChild(card)
  })

  orderSummaryItems.innerHTML = ''
  orderSummaryItems.appendChild(listWrap)

  // Total
  orderSummaryTotal.textContent = ''
  const totalStrong = document.createElement('strong')
  totalStrong.textContent = 'Total da encomenda:'
  const totalSpan = document.createElement('span')
  totalSpan.className = 'order-total-value'
  totalSpan.textContent = `${Number(summary.total).toFixed(2)} €`
  orderSummaryTotal.appendChild(totalStrong)
  orderSummaryTotal.appendChild(document.createTextNode(' '))
  orderSummaryTotal.appendChild(totalSpan)

  // Data de levantamento
  orderSummaryPickup.textContent = ''
  const pickupStrong = document.createElement('strong')
  pickupStrong.textContent = 'Data de levantamento:'
  const pickupText = document.createTextNode(` ${summary.pickupDate} às ${summary.pickupTime}`)
  orderSummaryPickup.appendChild(pickupStrong)
  orderSummaryPickup.appendChild(pickupText)

  // Limpar o resumo da sessão depois de mostrar
  sessionStorage.removeItem("lastOrderSummary")
})
