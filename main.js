import { db, showToast, updateCartCount, auth } from "./firebase-config.js"
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

let allProducts = []
let currentCategory = "all"
let currentSearchQuery = ""
let currentSortOption = "default"

// DOM Elements
const searchInput = document.getElementById("search-input")
const clearSearchBtn = document.getElementById("clear-search")
const sortSelect = document.getElementById("sort-select")
const resultsCounter = document.getElementById("results-counter")
const productModalEl = document.getElementById("product-details-modal")
const productModalCloseEl = document.getElementById("product-modal-close")
const productModalImageEl = document.getElementById("product-modal-image")
const productModalCategoryEl = document.getElementById("product-modal-category")
const productModalTitleEl = document.getElementById("product-modal-title")
const productModalPriceEl = document.getElementById("product-modal-price")
const productModalDetailsEl = document.getElementById("product-modal-details")
const productModalAddBtn = document.getElementById("product-modal-add-btn")
let selectedProductId = null
let selectedProductUnitPrice = 0

const categoryLabels = {
  bread: "Pão",
  pastry: "Pastelaria",
  cake: "Bolos",
  snacks: "Snacks",
  drinks: "Bebidas",
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatPrice(value) {
  return `${Number(value).toFixed(2)} €`
}

function getActiveDiscount(product) {
  const pct = Number(product?.discountPercent) || 0
  if (pct <= 0) return 0
  const expires = product?.discountExpires
  if (!expires) return pct
  try {
    const expDate = typeof expires.toDate === 'function' ? expires.toDate() : new Date(expires)
    if (expDate.getTime() <= Date.now()) return 0
    return pct
  } catch (e) {
    return pct
  }
}

function getRemainingMs(product) {
  const expires = product?.discountExpires
  if (!expires) return null
  try {
    const expDate = typeof expires.toDate === 'function' ? expires.toDate() : new Date(expires)
    const diff = expDate.getTime() - Date.now()
    return diff > 0 ? diff : 0
  } catch (e) {
    return null
  }
}

function getRemainingHoursLabel(product) {
  const ms = getRemainingMs(product)
  if (!ms) return null
  if (ms < 60 * 60 * 1000) return '<1h'
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  return `${hours}h`
}

function buildAutoProductDetails(product) {
  const name = String(product?.name || "").toLowerCase()
  const category = String(product?.category || "").toLowerCase()

  const keywordRules = [
    {
      keywords: ["baguete", "delicia do mar"],
      details:
        "Unidade. Exemplo de ingredientes: baguete integral, delícias do mar desfiadas, cenoura ralada, ovo cozido, maionese, ketchup, pimenta preta e alface.",
    },
    {
      keywords: ["baguete", "delícias do mar"],
      details:
        "Unidade. Exemplo de ingredientes: baguete integral, delícias do mar desfiadas, cenoura ralada, ovo cozido, maionese, ketchup, pimenta preta e alface.",
    },
    { keywords: ["pastel de nata"], details: "Unidade. Ingredientes: massa folhada, leite, ovos, açúcar, farinha e canela." },
    { keywords: ["croissant"], details: "Unidade. Ingredientes: farinha, manteiga, leite, fermento, açúcar e sal." },
    { keywords: ["bolo de chocolate"], details: "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, chocolate em pó, manteiga e leite." },
    { keywords: ["sumo de laranja"], details: "Copo 300ml. Ingredientes: laranja fresca espremida, sem adição de açúcar." },
    { keywords: ["limonada"], details: "Copo 300ml. Ingredientes: água, sumo de limão, açúcar e gelo." },
  ]

  for (const rule of keywordRules) {
    if (rule.keywords.every((keyword) => name.includes(keyword))) {
      return rule.details
    }
  }

  if (category === "bread") return "Unidade. Ingredientes principais: farinha de trigo, água, fermento e sal."
  if (category === "pastry") return "Unidade. Ingredientes principais: farinha de trigo, ovos, açúcar e manteiga."
  if (category === "cake") return "Bolo inteiro. Ingredientes principais: farinha, ovos, açúcar, manteiga e fermento."
  if (category === "snacks") return "Unidade. Pode conter pão, proteína, vegetais e molho."
  if (category === "drinks") return "Copo 300ml. Bebida preparada com ingredientes frescos."

  return "Produto artesanal. Consulte os ingredientes no balcão."
}

// Imagens reais por categoria para quando o produto não tem imagem
const defaultImages = {
  bread: "https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=400",
  pastry: "https://images.pexels.com/photos/2135/food-france-morning-breakfast.jpg?auto=compress&cs=tinysrgb&w=400",
  cake: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=400",
  snacks: "https://images.pexels.com/photos/3590401/pexels-photo-3590401.jpeg?auto=compress&cs=tinysrgb&w=400",
  drinks: "https://images.pexels.com/photos/5938/food-salad-healthy-lunch.jpg?auto=compress&cs=tinysrgb&w=400",
  default: "https://images.pexels.com/photos/1387070/pexels-photo-1387070.jpeg?auto=compress&cs=tinysrgb&w=400"
}

function buildProductCard(product, categoryLabels) {
  const imageSrc =
    (product.imageData || product.image || product.imageUrl) ||
    defaultImages[product.category] || defaultImages.default
  const category = categoryLabels[product.category] || "Especialidade"
  const name = escapeHtml(product.name || "Produto sem nome")
  const description = escapeHtml(getProductDetailsText(product))
  const price = Number(product.price) || 0
  const discount = getActiveDiscount(product)
  let priceHtml = formatPrice(price)
  if (discount > 0) {
    const discounted = Number((price * (1 - discount / 100)).toFixed(2))
    priceHtml = `<span class="product-price-discounted">${formatPrice(discounted)}</span> <span class="product-price-original">${formatPrice(price)}</span>`
  }

  // Fora de stock
  const isOutOfStock = product.available === false
  const restockEstimate = String(product.restockEstimate || "").trim()
  return `
    <article class="product-card${isOutOfStock ? ' out-of-stock' : ''}" data-product-id="${product.id}" role="button" tabindex="0" aria-label="Ver detalhes de ${name}">
      <div class="product-image-wrapper" style="position:relative;">
        <img src="${imageSrc}" 
             alt="${name}" 
             class="product-image" style="${isOutOfStock ? 'filter: grayscale(1) brightness(0.8); opacity:0.7;' : ''}">
        ${isOutOfStock ? '<span class="stock-badge" style="position:absolute;top:10px;left:10px;background:#ccc;color:#fff;padding:0.3em 0.8em;border-radius:8px;font-weight:bold;font-size:1em;z-index:2;">Fora de stock</span>' : ''}
      </div>
      <div class="product-content">
        <span class="product-category">${category}</span>
        <h3 class="product-name">${name}</h3>
        <p class="product-description">${description}</p>
        ${isOutOfStock && restockEstimate ? `<p style="color:#8b4513;font-size:1rem;margin:6px 0 0 0;"><strong>Volta:</strong> aproximadamente ${escapeHtml(restockEstimate)} <span style="font-size:0.75rem;">Dias</span></p>` : ""}
        <div class="product-footer">
          <span class="product-price">${priceHtml}</span>
          ${discount > 0 ? `<span class="product-discount-hours">${getRemainingHoursLabel(product) || ''}</span>` : ''}
          <button class="btn-primary add-to-cart-btn" data-id="${product.id}" ${isOutOfStock ? 'disabled style="background:#ccc;cursor:not-allowed;"' : ''}>
            ${isOutOfStock ? 'Indisponível' : 'Adicionar'}
          </button>
        </div>
      </div>
    </article>
  `
}

function getProductDetailsText(product) {
  const raw = product?.details || product?.description || buildAutoProductDetails(product) || ""
  return String(raw).replace(/^\s*Fatia[\.:]?\s*/i, "Bolo inteiro. ")
}

function openProductModal(productId) {
  const product = allProducts.find((p) => p.id === productId)
  if (!product || !productModalEl) return
  if (product.available === false) {
    const restockEstimate = String(product.restockEstimate || "").trim()
    const restockMsg = restockEstimate ? ` Volta em aproximadamente ${restockEstimate} dia${restockEstimate !== '1' ? 's' : ''} (pode ser mais cedo ou mais tarde).` : ""
    showToast("Indisponível", `Este produto está fora de stock e não pode ser adicionado ao carrinho.${restockMsg}`, "error")
    return
  }

  selectedProductId = productId
  const rawPrice = Number(product.price) || 0
  const discountPct = getActiveDiscount(product)
  selectedProductUnitPrice = discountPct > 0 ? Number((rawPrice * (1 - discountPct / 100)).toFixed(2)) : rawPrice

  const imageSrc =
    (product.imageData || product.image || product.imageUrl) ||
    defaultImages[product.category] || defaultImages.default

  if (productModalImageEl) {
    productModalImageEl.src = imageSrc
    productModalImageEl.alt = product.name || "Produto"
  }

  if (productModalCategoryEl) {
    productModalCategoryEl.textContent = categoryLabels[product.category] || "Especialidade"
  }

  if (productModalTitleEl) {
    productModalTitleEl.textContent = product.name || "Produto"
  }

  // Preencher preço inicial
  if (productModalPriceEl) {
    const rawPrice = Number(product.price) || 0
    const activeDiscount = getActiveDiscount(product)
    if (activeDiscount > 0) {
      const discounted = Number((rawPrice * (1 - activeDiscount / 100)).toFixed(2))
      const hoursLabel = getRemainingHoursLabel(product)
      productModalPriceEl.innerHTML = `<span class="product-modal-price-discounted">${formatPrice(discounted)}</span> <span class="product-modal-price-original">${formatPrice(rawPrice)}</span> <span class="product-modal-discount-badge">${activeDiscount}% desconto</span>${hoursLabel ? `<span class="product-modal-hours">${hoursLabel} restantes</span>` : ''}`
    } else {
      productModalPriceEl.textContent = formatPrice(selectedProductUnitPrice)
    }
  }

  if (productModalDetailsEl) {
    productModalDetailsEl.textContent = getProductDetailsText(product)
  }

  // Resetar quantidade para 1
  const qtyInput = document.getElementById("product-modal-qty")
  if (qtyInput) {
    qtyInput.value = 1
    qtyInput.addEventListener("input", updateProductModalPrice)
  }

  // --- Avaliação ---
  const reviewSection = document.getElementById("product-review-section")
  const reviewEligibility = document.getElementById("product-review-eligibility")
  const reviewForm = document.getElementById("product-review-form")
  const reviewSuccess = document.getElementById("product-review-success")
  const reviewStars = document.getElementById("product-review-stars")
  const reviewRatingLabel = document.getElementById("product-review-rating-label")
  const reviewComment = document.getElementById("product-review-comment")
  if (reviewSection && reviewEligibility && reviewForm && reviewStars && reviewRatingLabel && reviewComment && reviewSuccess) {
    reviewForm.style.display = "none"
    reviewSuccess.style.display = "none"
    reviewEligibility.textContent = ""
    reviewComment.value = ""
    let rating = 0

    // Verificar se já comprou o produto (carrinho local)
    let hasBought = false
    try {
      const orders = JSON.parse(localStorage.getItem("orders") || "[]")
      hasBought = orders.some(order => (order?.items || []).some(item => item.product?.id === productId))
    } catch {}
    // fallback: permitir se já adicionou ao carrinho alguma vez
    if (!hasBought) {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]")
      hasBought = cart.some(item => item.product?.id === productId && item.quantity > 0)
    }

    if (hasBought) {
      reviewEligibility.textContent = "Já comprou este produto. Pode avaliar!"
      reviewForm.style.display = "flex"
      renderStars(0)
    } else {
      reviewEligibility.textContent = "Só pode avaliar produtos que já comprou."
      reviewForm.style.display = "none"
    }

    function renderStars(selected) {
      rating = selected
      reviewStars.innerHTML = ""
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement("span")
        star.textContent = i <= rating ? "★" : "☆"
        star.style.fontSize = "1.5rem"
        star.style.cursor = "pointer"
        star.style.color = i <= rating ? "#b77b4b" : "#ccc"
        star.title = `${i} estrela${i > 1 ? 's' : ''}`
        star.onclick = () => {
          renderStars(i)
          reviewRatingLabel.textContent = i === 1 ? "Muito mau" : i === 2 ? "Mau" : i === 3 ? "Razoável" : i === 4 ? "Bom" : "Excelente"
        }
        reviewStars.appendChild(star)
      }
      reviewRatingLabel.textContent = rating === 0 ? "" : rating === 1 ? "Muito mau" : rating === 2 ? "Mau" : rating === 3 ? "Razoável" : rating === 4 ? "Bom" : "Excelente"
    }

    reviewForm.onsubmit = (e) => {
      e.preventDefault()
      if (rating < 1) {
        showToast("Avaliação", "Por favor selecione o número de estrelas.", "error")
        return false
      }
      if (!reviewComment.value.trim()) {
        showToast("Avaliação", "Por favor escreva um comentário.", "error")
        return false
      }
      // Aqui pode guardar no Firestore ou localStorage
      // Exemplo: guardar local
      const reviews = JSON.parse(localStorage.getItem("productReviews") || "[]")
      reviews.push({ productId, rating, comment: reviewComment.value.trim(), date: new Date().toISOString() })
      localStorage.setItem("productReviews", JSON.stringify(reviews))
      reviewForm.style.display = "none"
      reviewSuccess.style.display = "block"
      showToast("Avaliação", "Avaliação enviada! Obrigado pelo seu feedback.", "success")
      return false
    }
  }

  productModalEl.style.display = "flex"
  document.body.style.overflow = "hidden"
  updateProductModalPrice()
}

function updateProductModalPrice() {
  const qtyInput = document.getElementById("product-modal-qty")
  let qty = 1
  if (qtyInput) {
    qty = Math.max(1, Math.min(99, Number(qtyInput.value) || 1))
    qtyInput.value = qty
  }
  if (productModalPriceEl) {
    productModalPriceEl.textContent = formatPrice(selectedProductUnitPrice * qty)
  }
}

function closeProductModal() {
  if (!productModalEl) return
  productModalEl.style.display = "none"
  document.body.style.overflow = ""
  selectedProductId = null
}

function buildCustomCakeOptionCard() {
  return `
    <article class="product-card custom-cake-option-card">
      <div class="custom-cake-option-banner">
        <span class="custom-cake-badge">Bolo Personalizado</span>
        <h3>Crie o seu próprio bolo</h3>
        <p>Defina massa, recheios, coberturas e peso numa página dedicada.</p>
      </div>
      <div class="product-content">
        <p class="custom-cake-option-text">
          Ideal para aniversários e ocasiões especiais, com preço ajustado às opções escolhidas.
        </p>
        <a href="bolo-personalizado.html" class="btn-primary custom-cake-option-btn">
          Personalizar bolo
        </a>
      </div>
    </article>
  `
}

async function loadProducts() {
  const loading = document.getElementById("loading")
  const grid = document.getElementById("products-grid")

  try {
    const querySnapshot = await getDocs(collection(db, "products"))

    allProducts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Guardar só os campos essenciais no localStorage
    const productsForCache = allProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image || p.imageUrl || "",
      category: p.category,
      details: p.details || p.description || ""
    }))
    localStorage.setItem("productsCache", JSON.stringify(productsForCache))

    loading.style.display = "none"
    grid.style.display = "grid"
    filterAndDisplayProducts()
  } catch (error) {
    console.error("[v0] Error loading products:", error)
    // Tentar fallback para cache local se disponível
    try {
      const cached = localStorage.getItem("productsCache")
      if (cached) {
        const parsed = JSON.parse(cached)
        allProducts = parsed.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image || "",
          category: p.category,
          details: p.details || ""
        }))

        loading.style.display = "none"
        grid.style.display = "grid"
        showToast("Offline", "A mostrar produtos a partir do cache local.", "info")
        filterAndDisplayProducts()
        return
      }
    } catch (e) {
      console.error("Erro a usar cache local:", e)
    }

    loading.innerHTML = "<p>Erro ao carregar produtos. Tente novamente.</p>"
  }
}

function displayProducts(products) {
  const grid = document.getElementById("products-grid")
  const empty = document.getElementById("empty-state")
  const emptyTitle = document.getElementById("empty-title")
  const emptyMessage = document.getElementById("empty-message")

  // Apply sorting
  const sortedProducts = sortProducts(products, currentSortOption)

  const cards = sortedProducts.map((product) => buildProductCard(product, categoryLabels))
  if (currentCategory === "cake" && !currentSearchQuery) {
    cards.unshift(buildCustomCakeOptionCard())
  }

  // Update results counter
  updateResultsCounter(sortedProducts.length)

  if (cards.length === 0) {
    grid.style.display = "none"
    empty.style.display = "flex"
    
    if (currentSearchQuery) {
      emptyTitle.textContent = `Sem resultados para "${currentSearchQuery}"`
      emptyMessage.textContent = "Tente outra pesquisa ou limpe o filtro."
    } else {
      emptyTitle.textContent = "Nenhum produto encontrado"
      emptyMessage.textContent = "Tente ajustar a pesquisa ou categoria."
    }
    return
  }

  // Esconder mensagem de erro se houver produtos
  empty.style.display = "none"
  emptyTitle.textContent = ""
  emptyMessage.textContent = ""
  grid.style.display = "grid"
  grid.innerHTML = cards.join("")

  document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const productId = btn.dataset.id
      if (productId) openProductModal(productId)
    })
  })

  document.querySelectorAll(".product-card[data-product-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const productId = card.getAttribute("data-product-id")
      if (!productId) return
      openProductModal(productId)
    })

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      const productId = card.getAttribute("data-product-id")
      if (!productId) return
      openProductModal(productId)
    })
  })
}

function sortProducts(products, sortOption) {
  const sorted = [...products]
  
  switch (sortOption) {
    case "name-asc":
      return sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt"))
    case "name-desc":
      return sorted.sort((a, b) => (b.name || "").localeCompare(a.name || "", "pt"))
    case "price-asc":
      return sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
    case "price-desc":
      return sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
    default:
      return sorted
  }
}

function updateResultsCounter(count) {
  if (!resultsCounter) return
  
  if (currentSearchQuery || currentSortOption !== "default") {
    resultsCounter.style.display = "block"
    const categoryLabel = currentCategory === "all" ? "todos" : 
      { bread: "pão", pastry: "pastelaria", cake: "bolos", snacks: "snacks", drinks: "bebidas" }[currentCategory] || currentCategory
    
    if (count === 0) {
      resultsCounter.textContent = `Nenhum resultado encontrado`
    } else if (count === 1) {
      resultsCounter.textContent = `1 produto encontrado`
    } else {
      resultsCounter.textContent = `${count} produtos encontrados`
    }
    
    if (currentSearchQuery) {
      resultsCounter.textContent += ` para "${currentSearchQuery}"`
    }
  } else {
    resultsCounter.style.display = "none"
  }
}

function filterAndDisplayProducts() {
  let filtered = [...allProducts]
  
  // Filter by category
  if (currentCategory !== "all") {
    filtered = filtered.filter((p) => p.category === currentCategory)
  }
  
  // Filter by search query
  if (currentSearchQuery) {
    const query = currentSearchQuery.toLowerCase()
    filtered = filtered.filter((p) => {
      const name = (p.name || "").toLowerCase()
      const details = (p.details || "").toLowerCase()
      const description = (p.description || "").toLowerCase()
      return name.includes(query) || details.includes(query) || description.includes(query)
    })
  }
  
  displayProducts(filtered)
}

function addProductObjectToCart(product, quantity = 1) {
  quantity = Math.max(1, Math.min(99, Number(quantity) || 1))
  const cart = JSON.parse(localStorage.getItem("cart") || "[]")
  const existingItem = cart.find((item) => item.product.id === product.id)

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({ product, quantity })
  }

  localStorage.setItem("cart", JSON.stringify(cart))
  updateCartCount()
  showToast("Adicionado ao carrinho", `${product.name} (${quantity}x) foi adicionado ao carrinho`, "success")
}

function addToCart(productId, quantity = 1) {
  // Bloquear se não estiver logado
  const user = auth.currentUser
  if (!user) {
    showToast("Login obrigatório", "É necessário estar logado para adicionar produtos ao carrinho.", "error")
    return
  }
  const product = allProducts.find((p) => p.id === productId)
  if (!product) return
  addProductObjectToCart(product, quantity)
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")

    currentCategory = btn.dataset.category
    filterAndDisplayProducts()
  })
})

// Search functionality
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim()
    
    if (clearSearchBtn) {
      clearSearchBtn.style.display = currentSearchQuery ? "flex" : "none"
    }
    
    filterAndDisplayProducts()
  })
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = ""
      currentSearchQuery = ""
      clearSearchBtn.style.display = "none"
      filterAndDisplayProducts()
      searchInput.focus()
    }
  })
}

// Sort functionality
if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    currentSortOption = e.target.value
    filterAndDisplayProducts()
  })
}

productModalCloseEl?.addEventListener("click", closeProductModal)

productModalEl?.addEventListener("click", (event) => {
  if (event.target === productModalEl) {
    closeProductModal()
  }
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && productModalEl?.style.display === "flex") {
    closeProductModal()
  }
})

productModalAddBtn?.addEventListener("click", () => {
  if (!selectedProductId) return
  const qtyInput = document.getElementById("product-modal-qty")
  let qty = 1
  if (qtyInput) {
    qty = Math.max(1, Math.min(99, Number(qtyInput.value) || 1))
    qtyInput.value = qty // sanitize UI
  }
  addToCart(selectedProductId, qty)
})

loadProducts()
