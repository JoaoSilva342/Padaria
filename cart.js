import { db, showToast, observeAuthState, auth, updateCartCount } from "./firebase-config.js"
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

let cart = []
let currentUser = null
let productsCache = []
let captchaToken = null

// --- Agendamento (dia/hora) ---
const pickupDateEl = document.getElementById("pickup-date")
const pickupTimeEl = document.getElementById("pickup-time")
const pickupSlotsEl = document.getElementById("pickup-slots")
const slotStatusEl = document.getElementById("slot-status")
const checkoutBtnEl = document.getElementById("checkout-btn")
const pickupDateHintEl = document.getElementById("pickup-date-hint")
const pickupSlotHintEl = document.getElementById("slot-hint")
const paymentCardNameEl = document.getElementById("payment-card-name")
const paymentCardNumberEl = document.getElementById("payment-card-number")
const paymentCardExpiryEl = document.getElementById("payment-card-expiry")
const paymentCardCvvEl = document.getElementById("payment-card-cvv")
// Modal elements for splitting cake orders
const splitModalEl = document.getElementById("split-cake-modal")
const splitConfirmBtn = document.getElementById("split-confirm-btn")
const splitCancelBtn = document.getElementById("split-cancel-btn")

const CATEGORY_PREP_RULES = {
  // lead times expressed as minutes or business days
  bread: { minMinutes: 30, minBusinessDays: 0, label: "Pão" },
  drinks: { minMinutes: 0, minBusinessDays: 0, label: "Bebidas" },
  snacks: { minMinutes: 90, minBusinessDays: 0, label: "Snacks" },
  pastry: { minMinutes: 60, minBusinessDays: 0, label: "Pastelaria" },
  // generic site cakes default to 1 business day; custom cakes handled per-item
  cake: { minMinutes: 0, minBusinessDays: 1, label: "Bolos" },
}

function toISODate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return toISODate(d)
}

function normalizeCategory(rawCategory) {
  const cat = String(rawCategory || "")
    .trim()
    .toLowerCase()

  if (["bread", "pao", "pão", "paes", "pães"].includes(cat)) return "bread"
  if (["drink", "drinks", "bebida", "bebidas"].includes(cat)) return "drinks"
  if (["snack", "snacks"].includes(cat)) return "snacks"
  if (["pastry", "pastelaria"].includes(cat)) return "pastry"
  if (["cake", "bolo", "bolos"].includes(cat)) return "cake"
  return "other"
}

function addBusinessDays(baseDate, businessDays) {
  const d = new Date(baseDate)
  d.setHours(0, 0, 0, 0)
  let added = 0

  while (added < businessDays) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      added += 1
    }
  }

  return d
}

function getCartPreparationRequirement(items = cart) {
  const requirement = {
    minMinutes: 0,
    minBusinessDays: 0,
    categories: new Set(),
  }

  ;(items || []).forEach((item) => {
    // Ignore postponed items when calculating preparation requirements
    if (item?.postponed) return
    const rawCategory = item?.product?.category ?? item?.category
    const normalized = normalizeCategory(rawCategory)
    const rule = CATEGORY_PREP_RULES[normalized]
    if (!rule) return

    // Special case: custom cakes created by the customer require 2 business days
    if (normalized === "cake" && item?.product?.isCustomCake) {
      requirement.minBusinessDays = Math.max(requirement.minBusinessDays, 2)
    } else {
      requirement.minMinutes = Math.max(requirement.minMinutes, rule.minMinutes)
      requirement.minBusinessDays = Math.max(requirement.minBusinessDays, rule.minBusinessDays)
    }

    requirement.categories.add(normalized)
  })

  return requirement
}

function buildPreparationRuleText(requirement) {
  const hasCake = requirement.categories.has("cake")
  const hasSnacks = requirement.categories.has("snacks")
  const hasPastry = requirement.categories.has("pastry")
  const hasBread = requirement.categories.has("bread")
  const hasDrinks = requirement.categories.has("drinks")

  if (requirement.minBusinessDays >= 2) {
    return "Existem bolos personalizados no carrinho: reserva mínima de 2 dias úteis."
  }
  if (requirement.minBusinessDays === 1 && hasCake) {
    return "Existem bolos no carrinho: reserva mínima de 1 dia útil."
  }
  if (hasSnacks && requirement.minMinutes >= 90) {
    return "Existem snacks no carrinho: mínimo 1h30 de antecedência."
  }
  if (hasPastry && requirement.minMinutes >= 60) {
    return "Existem produtos de pastelaria no carrinho: mínimo 1 hora de antecedência."
  }
  if (hasBread && requirement.minMinutes >= 30) {
    return "Existem pães no carrinho: mínimo 30 minutos de antecedência."
  }
  if (hasBread || hasDrinks) {
    return "Bebidas são imediatas; pão pode ter antecedência mínima conforme selecionado."
  }
  return "Escolha uma data e hora adequadas; as regras de antecedência dependem das categorias no carrinho."
}

function getMinPickupISO(items = cart, now = new Date()) {
  const requirement = getCartPreparationRequirement(items)
  if (requirement.minBusinessDays > 0) {
    return toISODate(addBusinessDays(now, requirement.minBusinessDays))
  }
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  return toISODate(base)
}

function pickupDateTimeFromValues(isoDate, hhmm) {
  if (!isoDate || !hhmm) return null
  const d = new Date(`${isoDate}T${hhmm}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function meetsLeadTime(isoDate, hhmm, now = new Date(), items = cart) {
  const pickupAt = pickupDateTimeFromValues(isoDate, hhmm)
  if (!pickupAt) return false

  const requirement = getCartPreparationRequirement(items)
  if (requirement.minBusinessDays > 0) {
    const minDate = addBusinessDays(now, requirement.minBusinessDays)
    return pickupAt.getTime() >= minDate.getTime()
  }

  const minMs = requirement.minMinutes * 60 * 1000
  return pickupAt.getTime() - now.getTime() >= minMs
}

function getLeadTimeBlockReason(items = cart) {
  const requirement = getCartPreparationRequirement(items)
  if (requirement.minBusinessDays > 0) {
    return "Horário bloqueado: bolos exigem reserva mínima de 2 dias úteis."
  }
  if (requirement.minMinutes > 0) {
    return `Horário bloqueado: é necessário pelo menos ${requirement.minMinutes} minutos de antecedência.`
  }
  return ""
}

function updateSchedulingHints() {
  const requirement = getCartPreparationRequirement(cart)
  const ruleText = buildPreparationRuleText(requirement)
  const baseSlotText = "Horário: 09:00-13:00 e 14:30-19:00 (intervalos de 30 min)."

  if (pickupDateHintEl) {
    pickupDateHintEl.textContent = ruleText
  }

  if (pickupSlotHintEl) {
    pickupSlotHintEl.textContent = `${baseSlotText} ${ruleText}`
  }
}

function getItemPreparationBadge(item) {
  const rawCategory = item?.product?.category ?? item?.category
  const normalized = normalizeCategory(rawCategory)
  // Custom cake badge
  if (normalized === "cake" && item?.product?.isCustomCake) {
    return { text: "2 dias úteis", className: "prep-badge-cake" }
  }
  if (normalized === "cake") {
    return { text: "1 dia útil", className: "prep-badge-cake" }
  }
  if (normalized === "snacks") {
    return { text: "1h30", className: "prep-badge-90min" }
  }
  if (normalized === "pastry") {
    return { text: "1h", className: "prep-badge-60min" }
  }
  if (normalized === "bread") {
    return { text: "30 min", className: "prep-badge-30min" }
  }
  return { text: "Imediato", className: "prep-badge-now" }
}

// --- Split cake helpers ---
function cartHasCakeAndOther(items = cart) {
  let hasCake = false
  let hasOther = false
  ;(items || []).forEach((it) => {
    const cat = normalizeCategory(it?.product?.category ?? it?.category)
    if (cat === "cake") hasCake = true
    else if (cat !== "other") hasOther = true
  })
  return hasCake && hasOther
}

function openSplitCakeModal() {
  if (!splitModalEl) return
  splitModalEl.style.display = "flex"
}

function closeSplitCakeModal() {
  if (!splitModalEl) return
  splitModalEl.style.display = "none"
}

function performSplitCakes() {
  // Move cake items to a separate session cart and keep others in the current cart
  const cakes = cart.filter((it) => normalizeCategory(it?.product?.category ?? it?.category) === "cake")
  const others = cart.filter((it) => normalizeCategory(it?.product?.category ?? it?.category) !== "cake")

  if (cakes.length === 0) return

  try {
    sessionStorage.setItem("separatedCakeCart", JSON.stringify(cakes))
    localStorage.setItem("cart", JSON.stringify(others))
    cart = others
    updateCartCount()
    displayCart()
    showToast("Bolos separados", "Os bolos foram movidos para uma encomenda separada. Finalize esta encomenda e depois finalize os bolos (ver Carrinho).", "success")
  } catch (e) {
    console.error("Erro ao separar bolos:", e)
    showToast("Erro", "Não foi possível separar os bolos. Tente novamente.", "error")
  }
}

// Attach modal button handlers
if (splitConfirmBtn) {
  splitConfirmBtn.addEventListener("click", (e) => {
    e.preventDefault()
    performSplitCakes()
    closeSplitCakeModal()
  })
}
if (splitCancelBtn) {
  splitCancelBtn.addEventListener("click", (e) => {
    e.preventDefault()
    closeSplitCakeModal()
  })
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "")
}

function formatCardNumber(value) {
  return digitsOnly(value)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
}

function formatExpiry(value) {
  const raw = digitsOnly(value).slice(0, 4)
  if (raw.length <= 2) return raw
  return `${raw.slice(0, 2)}/${raw.slice(2)}`
}

function isValidExpiry(expiry) {
  const [mm, yy] = String(expiry || "").split("/")
  const month = Number(mm)
  const year = Number(yy)
  if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) return false

  const now = new Date()
  const cardYear = 2000 + year
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  return cardYear > currentYear || (cardYear === currentYear && month >= currentMonth)
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

function setupPaymentInputs() {
  paymentCardNumberEl?.addEventListener("input", () => {
    paymentCardNumberEl.value = formatCardNumber(paymentCardNumberEl.value)
  })

  const expiryErrorEl = document.getElementById("payment-card-expiry-error")
  function showExpiryError(show, msg) {
    if (!expiryErrorEl) return
    expiryErrorEl.style.display = show ? "block" : "none"
    expiryErrorEl.textContent = msg || "Validade inválida"
  }

  paymentCardExpiryEl?.addEventListener("input", () => {
    paymentCardExpiryEl.value = formatExpiry(paymentCardExpiryEl.value)
    const val = paymentCardExpiryEl.value.trim()
    if (!val) {
      showExpiryError(false)
      return
    }
    if (!isValidExpiry(val)) {
      showExpiryError(true, "Validade inválida ou expirada")
    } else {
      showExpiryError(false)
    }
  })

  paymentCardCvvEl?.addEventListener("input", () => {
    paymentCardCvvEl.value = digitsOnly(paymentCardCvvEl.value).slice(0, 4)
  })
}

function validateCardPayment() {
  const cardName = paymentCardNameEl?.value?.trim() || ""
  const cardNumber = digitsOnly(paymentCardNumberEl?.value || "")
  const cardExpiry = paymentCardExpiryEl?.value?.trim() || ""
  const cardCvv = digitsOnly(paymentCardCvvEl?.value || "")

  if (!cardName || cardName.length < 3) {
    showToast("Pagamento inválido", "Introduza o nome no cartão.", "error")
    return null
  }
  if (/[0-9]/.test(cardName)) {
    showToast("Pagamento inválido", "O nome do cartão não pode conter números.", "error")
    if (paymentCardNameErrorEl) paymentCardNameErrorEl.style.display = "block"
    return null
  }

  if (cardNumber.length !== 16) {
    showToast("Pagamento inválido", "O número do cartão deve ter 16 dígitos.", "error")
    return null
  }

  if (!isValidExpiry(cardExpiry)) {
    showToast("Pagamento inválido", "A validade do cartão é inválida ou expirada.", "error")
    return null
  }

  if (cardCvv.length < 3 || cardCvv.length > 4) {
    showToast("Pagamento inválido", "O CVV deve ter 3 ou 4 dígitos.", "error")
    return null
  }

  return {
    cardHolderName: cardName,
    cardLast4: cardNumber.slice(-4),
  }
}

function buildTimeSlots() {
  // 30 em 30 min: 09:00-13:00 e 14:30-19:00
  const pad = (n) => String(n).padStart(2, "0")
  const out = []

  for (let h = 9; h <= 12; h++) {
    out.push(`${pad(h)}:00`)
    out.push(`${pad(h)}:30`)
  }
  out.push("13:00")

  out.push("14:30")
  for (let h = 15; h <= 18; h++) {
    out.push(`${pad(h)}:00`)
    out.push(`${pad(h)}:30`)
  }
  out.push("19:00")

  return Array.from(new Set(out))
}

const SLOTS = buildTimeSlots()

function selectSlot(time) {
  if (!pickupTimeEl || !pickupSlotsEl) return
  pickupTimeEl.value = time
  pickupSlotsEl.querySelectorAll(".time-slot-btn").forEach((btn) => {
    const isSelected = btn.dataset.value === time
    btn.classList.toggle("selected", isSelected)
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false")
  })
}

function renderSlotButtons(slotStates) {
  if (!pickupSlotsEl || !pickupTimeEl) return

  pickupSlotsEl.innerHTML = ""
  pickupTimeEl.value = ""
  const fragment = document.createDocumentFragment()
  let firstAvailable = ""

  slotStates.forEach(({ time, blocked, reason }) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = `time-slot-btn${blocked ? " blocked" : ""}`
    btn.textContent = time
    btn.dataset.value = time
    btn.setAttribute("aria-pressed", "false")

    if (blocked) {
      btn.disabled = true
      btn.setAttribute("aria-disabled", "true")
      btn.title = reason || "Horário bloqueado"
    } else {
      if (!firstAvailable) firstAvailable = time
      btn.addEventListener("click", () => selectSlot(time))
    }

    fragment.appendChild(btn)
  })

  pickupSlotsEl.appendChild(fragment)
  if (firstAvailable) {
    selectSlot(firstAvailable)
  }
}

async function refreshTimeSlots() {
  if (!pickupDateEl || !pickupTimeEl || !pickupSlotsEl) return

  updateSchedulingHints()

  const selectedDate = pickupDateEl.value
  if (!selectedDate) return

  pickupSlotsEl.innerHTML = ""
  pickupTimeEl.value = ""
  if (slotStatusEl) slotStatusEl.style.display = "none"

  const now = new Date()
  const slotStates = SLOTS.map((time) => {
    if (!meetsLeadTime(selectedDate, time, now, cart)) {
      return {
        time,
        blocked: true,
        reason: getLeadTimeBlockReason(cart),
      }
    }

    return { time, blocked: false, reason: "" }
  })

  renderSlotButtons(slotStates)

  const hasAvailable = slotStates.some((s) => !s.blocked)
  if (!hasAvailable) {
    if (slotStatusEl) {
      slotStatusEl.textContent = "Sem horários disponíveis para esta data."
      slotStatusEl.style.display = "block"
    }
    if (checkoutBtnEl) checkoutBtnEl.disabled = true
    return
  }

  if (checkoutBtnEl) checkoutBtnEl.disabled = false
}

function setupSchedulingUI() {
  if (!pickupDateEl || !pickupTimeEl || !pickupSlotsEl) return
  updateSchedulingHints()
  const min = getMinPickupISO(cart)
  pickupDateEl.min = min
  if (!pickupDateEl.value || pickupDateEl.value < min) pickupDateEl.value = min
  pickupDateEl.addEventListener("change", refreshTimeSlots)
  refreshTimeSlots()
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

async function ensureProductsCache() {
  if (productsCache.length) return productsCache
  const snap = await getDocs(collection(db, "products"))
  productsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return productsCache
}

function getSuggestionCandidates(products) {
  const cartIds = new Set(cart.map((item) => item?.product?.id).filter(Boolean))
  const cartCategories = new Set(
    cart.map((item) => String(item?.product?.category || "").trim()).filter(Boolean),
  )

  const relatedCategories = {
    bread: ["pastry", "cake", "drinks"],
    pastry: ["bread", "cake", "drinks"],
    cake: ["pastry", "bread", "drinks"],
    snacks: ["drinks", "bread"],
    drinks: ["snacks", "pastry"],
  }

  const preferredCategories = new Set()
  cartCategories.forEach((cat) => {
    ;(relatedCategories[cat] || []).forEach((targetCat) => preferredCategories.add(targetCat))
  })

  const avgPrice =
    cart.length > 0
      ? cart.reduce((sum, item) => sum + Number(item?.product?.price || 0), 0) / cart.length
      : 0

  return products
    .filter((p) => p?.id && !cartIds.has(p.id))
    .map((product) => {
      const price = Number(product.price) || 0
      let score = 0
      if (preferredCategories.has(product.category)) score += 3
      if (cartCategories.has(product.category)) score += 1
      if (avgPrice > 0 && price <= avgPrice * 1.2) score += 0.35
      return { product, score, price }
    })
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, 3)
    .map((entry) => entry.product)
}

function addSuggestedProduct(productId) {
  const product = productsCache.find((p) => p.id === productId)
  if (!product) return

  const existing = cart.find((item) => item.product.id === productId)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({ product, quantity: 1 })
  }

  localStorage.setItem("cart", JSON.stringify(cart))
  updateCartCount()
  showToast("Adicionado", `${product.name} foi adicionado ao carrinho.`, "success")
  displayCart()
}

async function renderSuggestions() {
  const suggestionsWrap = document.getElementById("cart-suggestions")
  const suggestionsGrid = document.getElementById("suggestions-grid")
  if (!suggestionsWrap || !suggestionsGrid) return

  if (!cart.length) {
    suggestionsWrap.style.display = "none"
    suggestionsGrid.innerHTML = ""
    return
  }

  try {
    const products = await ensureProductsCache()
    const suggestions = getSuggestionCandidates(products)

    if (!suggestions.length) {
      suggestionsWrap.style.display = "none"
      suggestionsGrid.innerHTML = ""
      return
    }

    suggestionsWrap.style.display = "block"
    // Default images per category
      const defaultImages = {
        bread: "https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=280&h=250&dpr=1",
        pastry: "https://images.pexels.com/photos/2135/food-france-morning-breakfast.jpg?auto=compress&cs=tinysrgb&w=280&h=250&dpr=1",
        cake: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=280&h=250&dpr=1",
        snacks: "https://images.pexels.com/photos/3590401/pexels-photo-3590401.jpeg?auto=compress&cs=tinysrgb&w=280&h=250&dpr=1",
        drinks: "https://images.pexels.com/photos/5938/food-salad-healthy-lunch.jpg?auto=compress&cs=tinysrgb&w=280&h=250&dpr=1",
        default: "https://images.pexels.com/photos/1070946/pexels-photo-1070946.jpeg?auto=compress&cs=tinysrgb&w=280&h=250&dpr=1"
      }
      
      // Build suggestion nodes safely
      suggestionsGrid.textContent = ''
      const sugFrag = document.createDocumentFragment()
      suggestions.forEach((product) => {
        const imageSrcRaw =
          product.imageData ||
          product.image ||
          product.imageUrl ||
          defaultImages[product.category] || defaultImages.default
        const imageSrc = escapeHtml(imageSrcRaw)
        const name = escapeHtml(product.name || "Produto")
        const categoryMap = { bread: "Pão", pastry: "Pastelaria", cake: "Bolos", snacks: "Snacks", drinks: "Bebidas" }
        const category = categoryMap[product.category] || "Especialidade"
        const price = Number(product.price) || 0

        const art = document.createElement('article')
        art.className = 'suggestion-item'

        const img = document.createElement('img')
        img.className = 'suggestion-image'
        img.src = imageSrc
        img.alt = name

        const content = document.createElement('div')
        content.className = 'suggestion-content'

        const pCat = document.createElement('p')
        pCat.className = 'suggestion-category'
        pCat.textContent = category

        const h4 = document.createElement('h4')
        h4.className = 'suggestion-name'
        h4.textContent = name

        const footer = document.createElement('div')
        footer.className = 'suggestion-footer'

        const strong = document.createElement('strong')
        strong.className = 'suggestion-price'
        strong.textContent = `${price.toFixed(2)} €`

        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'btn-secondary suggestion-add-btn'
        btn.setAttribute('data-product-id', escapeHtml(product.id))
        btn.textContent = 'Adicionar'
        btn.addEventListener('click', () => addSuggestedProduct(product.id))

        footer.appendChild(strong)
        footer.appendChild(btn)

        content.appendChild(pCat)
        content.appendChild(h4)
        content.appendChild(footer)

        art.appendChild(img)
        art.appendChild(content)

        sugFrag.appendChild(art)
      })

      suggestionsGrid.appendChild(sugFrag)
  } catch (error) {
    console.error("[v0] Error loading suggestions:", error)
    suggestionsWrap.style.display = "none"
  }
}

// Observe auth state
observeAuthState((user) => {
  currentUser = user
  if (user) {
    document.getElementById("customer-name").value = user.displayName || ""
    document.getElementById("customer-email").value = user.email || ""
  }
})

// Load cart
function loadCart() {
  cart = JSON.parse(localStorage.getItem("cart") || "[]")
  displayCart()
}

// Display cart
function displayCart() {
  const emptyCart = document.getElementById("empty-cart")
  const cartContent = document.getElementById("cart-content")

  if (cart.length === 0) {
    emptyCart.style.display = "flex"
    cartContent.style.display = "none"
    return
  }

  emptyCart.style.display = "none"
  cartContent.style.display = "grid"

  // Default images per category
  const defaultImgs = {
    bread: "https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1",
    pastry: "https://images.pexels.com/photos/2135/food-france-morning-breakfast.jpg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1",
    cake: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1",
    snacks: "https://images.pexels.com/photos/3590401/pexels-photo-3590401.jpeg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1",
    drinks: "https://images.pexels.com/photos/5938/food-salad-healthy-lunch.jpg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1",
    default: "https://images.pexels.com/photos/1070946/pexels-photo-1070946.jpeg?auto=compress&cs=tinysrgb&w=96&h=96&dpr=1"
  }

  const cartItems = document.getElementById("cart-items")
  cartItems.textContent = ''
  const frag = document.createDocumentFragment()
  cart.forEach((item) => {
    const prep = getItemPreparationBadge(item)
    const imgSrcRaw = (item.product.imageData || item.product.image || item.product.imageUrl) || defaultImgs[item.product.category] || defaultImgs.default
    const imgSrc = escapeHtml(imgSrcRaw)
    const price = Number(item.product.price) || 0
    const discount = getActiveDiscount(item.product)
    const unit = discount > 0 ? Number((price * (1 - discount / 100)).toFixed(2)) : price
    const isPostponed = Boolean(item.postponed)

    const itemDiv = document.createElement('div')
    itemDiv.className = `cart-item${isPostponed ? ' postponed' : ''}`

    const img = document.createElement('img')
    img.className = 'cart-item-image'
    img.src = imgSrc
    img.alt = escapeHtml(item.product.name)

    const content = document.createElement('div')
    content.className = 'cart-item-content'

    const h3 = document.createElement('h3')
    h3.className = 'cart-item-name'
    h3.textContent = escapeHtml(item.product.name)

    const pPrep = document.createElement('p')
    pPrep.className = 'cart-item-prep'
    const prepSpan = document.createElement('span')
    prepSpan.className = `prep-badge ${prep.className}`
    prepSpan.textContent = escapeHtml(prep.text)
    pPrep.appendChild(prepSpan)
    if (isPostponed) {
      const muted = document.createElement('span')
      muted.className = 'prep-badge prep-badge-muted'
      muted.textContent = 'Adiado'
      pPrep.appendChild(document.createTextNode(' '))
      pPrep.appendChild(muted)
    }

    const pDesc = document.createElement('p')
    pDesc.className = 'cart-item-description'
    pDesc.textContent = escapeHtml(item.product.details || item.product.description || 'Sem descrição.')

    const pPrice = document.createElement('p')
    pPrice.className = 'cart-item-price'
    if (discount > 0) {
      const discSpan = document.createElement('span')
      discSpan.className = 'cart-item-price-discounted'
      discSpan.textContent = `${unit.toFixed(2)} €`
      const origSpan = document.createElement('span')
      origSpan.className = 'cart-item-price-original'
      origSpan.textContent = `${price.toFixed(2)} €`
      pPrice.appendChild(discSpan)
      pPrice.appendChild(document.createTextNode(' '))
      pPrice.appendChild(origSpan)
    } else {
      pPrice.textContent = `${unit.toFixed(2)} €`
    }

    content.appendChild(h3)
    content.appendChild(pPrep)
    content.appendChild(pDesc)
    content.appendChild(pPrice)

    const actions = document.createElement('div')
    actions.className = 'cart-item-actions'

    const removeBtn = document.createElement('button')
    removeBtn.className = 'remove-btn'
    removeBtn.setAttribute('data-id', escapeHtml(item.product.id))
    if (isPostponed) removeBtn.disabled = true
    removeBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`

    const qtyControls = document.createElement('div')
    qtyControls.className = 'quantity-controls'

    const decBtn = document.createElement('button')
    decBtn.className = 'btn-secondary quantity-btn'
    decBtn.setAttribute('data-id', escapeHtml(item.product.id))
    decBtn.setAttribute('data-action', 'decrease')
    if (isPostponed) decBtn.disabled = true
    decBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`

    const qtyVal = document.createElement('span')
    qtyVal.className = 'quantity-value'
    qtyVal.textContent = String(item.quantity)

    const incBtn = document.createElement('button')
    incBtn.className = 'btn-secondary quantity-btn'
    incBtn.setAttribute('data-id', escapeHtml(item.product.id))
    incBtn.setAttribute('data-action', 'increase')
    if (isPostponed) incBtn.disabled = true
    incBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`

    qtyControls.appendChild(decBtn)
    qtyControls.appendChild(qtyVal)
    qtyControls.appendChild(incBtn)

    actions.appendChild(removeBtn)
    actions.appendChild(qtyControls)

    if (normalizeCategory(item.product.category) === 'cake') {
      const postponeBtn = document.createElement('button')
      postponeBtn.type = 'button'
      postponeBtn.className = 'btn-secondary postpone-btn'
      postponeBtn.setAttribute('data-id', escapeHtml(item.product.id))
      postponeBtn.textContent = isPostponed ? 'Retomar' : 'Deixar para mais tarde'
      actions.appendChild(postponeBtn)
    }

    itemDiv.appendChild(img)
    itemDiv.appendChild(content)
    itemDiv.appendChild(actions)

    frag.appendChild(itemDiv)
  })

  cartItems.appendChild(frag)

  updateSummary()
  attachEventHandlers()
  setupSchedulingUI()
  renderSuggestions()
}

// Update summary
function updateSummary() {
  // Excluir itens adiados do total
  const total = cart
    .filter((item) => !item.postponed)
    .reduce((sum, item) => {
      const price = Number(item.product.price) || 0
      const discount = getActiveDiscount(item.product)
      const unit = discount > 0 ? Number((price * (1 - discount / 100)).toFixed(2)) : price
      return sum + unit * item.quantity
    }, 0)
  document.getElementById("subtotal").textContent = `${total.toFixed(2)} €`
  document.getElementById("total").textContent = `${total.toFixed(2)} €`
}

// Attach event handlers
function attachEventHandlers() {
  document.querySelectorAll(".quantity-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.id
      const action = btn.dataset.action
      updateQuantity(productId, action)
    })
  })

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.id
      removeFromCart(productId)
    })
  })

  document.querySelectorAll(".postpone-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.id
      togglePostponeItem(productId)
    })
  })
}

// Update quantity
function updateQuantity(productId, action) {
  const item = cart.find((i) => i.product.id === productId)
  if (!item) return

  if (action === "increase") {
    item.quantity += 1
  } else if (action === "decrease") {
    item.quantity = Math.max(1, item.quantity - 1)
  }

  localStorage.setItem("cart", JSON.stringify(cart))
  updateCartCount()
  displayCart()
}

// Remove from cart
function removeFromCart(productId) {
  cart = cart.filter((item) => item.product.id !== productId)
  localStorage.setItem("cart", JSON.stringify(cart))
  updateCartCount()
  displayCart()
  showToast("Removido", "Produto removido do carrinho", "success")
}

function togglePostponeItem(productId) {
  const item = cart.find((i) => i.product.id === productId)
  if (!item) return
  item.postponed = !item.postponed
  localStorage.setItem("cart", JSON.stringify(cart))
  updateCartCount()
  displayCart()
  // update scheduling UI because lead times may change
  try { refreshTimeSlots() } catch (e) {}
  showToast(item.postponed ? "Adiado" : "Retomado", item.postponed ? "O produto foi adiado para mais tarde." : "O produto voltou a ser elegível para agendamento.", "success")
}

window.onCaptchaSuccess = (token) => {
  captchaToken = token || null
}

window.onCaptchaExpired = () => {
  captchaToken = null
}

function isCaptchaVerified() {
  return Boolean(captchaToken)
}

// Checkout
document.getElementById("checkout-form").addEventListener("submit", async (e) => {

  e.preventDefault()

  // Validação extra: bloquear se carrinho vazio
  if (!cart || cart.length === 0) {
    showToast("Carrinho vazio", "Adicione produtos ao carrinho antes de finalizar a encomenda.", "error")
    return
  }

  // Se existir bolo(s) e outros itens, perguntar ao utilizador se quer separar
  try {
    const alreadySeparated = sessionStorage.getItem("separatedCakeCart")
    if (!alreadySeparated && cartHasCakeAndOther(cart)) {
      openSplitCakeModal()
      return
    }
  } catch (e) {
    console.warn("Erro ao verificar separação de bolos:", e)
  }

  const customerName = document.getElementById("customer-name").value?.trim()
  const customerEmail = document.getElementById("customer-email").value?.trim()
  const pickupDate = pickupDateEl?.value
  const pickupTime = pickupTimeEl?.value
  const checkoutBtn = document.getElementById("checkout-btn")

  // Bloquear se faltar algum campo obrigatório
  if (!customerName || !customerEmail || !pickupDate || !pickupTime) {
    showToast("Campos obrigatórios", "Preencha todos os campos obrigatórios antes de finalizar.", "error")
    return
  }

  const minDate = getTodayISO()
  const scopedMinDate = getMinPickupISO(cart)
  if (!pickupDate || pickupDate < minDate || pickupDate < scopedMinDate) {
    showToast("Data inválida", `Escolha ${scopedMinDate} ou uma data futura para os produtos no carrinho.`, "error")
    if (pickupDateEl) pickupDateEl.value = scopedMinDate
    await refreshTimeSlots()
    return
  }

  if (!pickupTime) {
    showToast("Horário em falta", "Escolha um horário disponível.", "error")
    return
  }

  if (!meetsLeadTime(pickupDate, pickupTime, new Date(), cart)) {
    showToast("Antecedência insuficiente", buildPreparationRuleText(getCartPreparationRequirement(cart)), "error")
    await refreshTimeSlots()
    return
  }

  if (!isCaptchaVerified()) {
    showToast("Verificação necessária", "Confirme a proteção anti-bots antes de finalizar a encomenda.", "error")
    return
  }

  const paymentData = validateCardPayment()
  if (!paymentData) {
    return
  }

  checkoutBtn.disabled = true
  checkoutBtn.textContent = "A processar..."

    try {
      // Consider only non-postponed items for this checkout
      const itemsToPurchase = cart.filter((item) => !item.postponed)
      if (!itemsToPurchase.length) {
        showToast("Sem itens para finalizar", "Não há itens elegíveis para finalizar nesta encomenda.", "error")
        return
      }

      const total = itemsToPurchase.reduce((sum, item) => {
        const price = Number(item.product.price) || 0
        const discount = getActiveDiscount(item.product)
        const unit = discount > 0 ? Number((price * (1 - discount / 100)).toFixed(2)) : price
        return sum + unit * item.quantity
      }, 0)

      const uid = auth.currentUser?.uid || currentUser?.uid || "guest"

      const orderRef = await addDoc(collection(db, "orders"), {
        userId: uid,
        customerName,
        customerEmail,
        pickupDate,
        pickupTime,
        items: itemsToPurchase.map((item) => {
          const price = Number(item.product.price) || 0
          const discount = getActiveDiscount(item.product)
          const unit = discount > 0 ? Number((price * (1 - discount / 100)).toFixed(2)) : price
          return {
            productId: item.product.id,
            name: item.product.name,
            price: unit,
            quantity: item.quantity,
            originalPrice: price,
            discountPercent: discount || 0,
            category: item.product.category || null,
          }
        }),
        total,
        paymentMethod: "card",
        paymentStatus: "paid",
        cardLast4: paymentData.cardLast4,
        status: "pending",
        createdAt: serverTimestamp(),
      })
      const orderId = orderRef.id

      // Guardar resumo da encomenda na sessionStorage (apenas itens comprados)
      sessionStorage.setItem("lastOrderSummary", JSON.stringify({
        orderId: orderId.slice(0, 8),
        items: itemsToPurchase.map((item) => {
          const price = Number(item.product.price) || 0
          const discount = Number(item.product.discountPercent) || 0
          const unit = discount > 0 ? Number((price * (1 - discount / 100)).toFixed(2)) : price
          return {
            name: item.product.name,
            price: unit,
            quantity: item.quantity,
          }
        }),
        total,
        pickupDate,
        pickupTime
      }))

      // Guardar histórico local de encomendas para avaliações (apenas itens comprados)
      try {
        const ordersHistory = JSON.parse(localStorage.getItem("ordersHistory") || "[]")
        ordersHistory.push({
          date: new Date().toISOString(),
          items: itemsToPurchase.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity
          }))
        })
        localStorage.setItem("ordersHistory", JSON.stringify(ordersHistory))

        // Compatibility: also append a simplified record to `localStorage.orders`
        // so legacy review checks (which read `localStorage.getItem("orders")`) work.
        try {
          const legacyOrders = JSON.parse(localStorage.getItem("orders") || "[]")
          legacyOrders.push({
            date: new Date().toISOString(),
            items: itemsToPurchase.map((item) => ({
              product: { id: item.product.id },
              quantity: item.quantity
            }))
          })
          localStorage.setItem("orders", JSON.stringify(legacyOrders))
        } catch (e) {
          // ignore legacy write errors
        }
      } catch {}

      // Manter apenas os itens adiados no carrinho após finalizar os restantes
      const postponedItems = cart.filter((item) => item.postponed)

      // Se existirem bolos previamente separados (guardados em sessionStorage), restaurá-los
      let separatedFromSession = []
      try {
        separatedFromSession = JSON.parse(sessionStorage.getItem("separatedCakeCart") || "[]")
      } catch (e) {
        separatedFromSession = []
      }

      const remainingCart = [...postponedItems, ...separatedFromSession]
      if (remainingCart.length) {
        localStorage.setItem("cart", JSON.stringify(remainingCart))
      } else {
        localStorage.removeItem("cart")
      }

      // Limpar o armazenamento temporário de bolos separados (já restaurado)
      try { sessionStorage.removeItem("separatedCakeCart") } catch (e) {}

      // Redirecionar para página de resumo
      window.location.href = "order-summary.html"
  } catch (error) {
    console.error("[v0] Error creating order:", error)
    showToast("Erro", "Ocorreu um erro ao processar a encomenda", "error")
    checkoutBtn.disabled = false
    checkoutBtn.textContent = "Finalizar Encomenda"
  }
})

// Initialize
setupPaymentInputs()
loadCart()

// Synchronize cart across tabs
window.addEventListener("storage", (e) => {
  if (e.key === "cart") {
    cart = JSON.parse(e.newValue || "[]")
    updateCartCount()
    displayCart()
  }
})
