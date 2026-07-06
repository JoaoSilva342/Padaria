import { db, showToast, auth, getUserRole, onAuthStateChanged } from "./firebase-config.js"
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  query,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

let allOrders = []
let currentUserRole = "customer"
let currentUserEmail = ""

// (no-op)
let autoStatusTimer = null
let currentStatsPeriod = "today"

// Super admin email - has ultimate control over all users
const SUPER_ADMIN_EMAIL = "pedrowhat20@gmail.com"

const PENDING_WINDOW_MS = 5 * 60 * 1000
const READY_BEFORE_PICKUP_MS = 10 * 60 * 1000
const statsPeriodEl = document.getElementById("stats-period")
const statsScopeLabelEl = document.getElementById("stats-scope-label")
const statsCustomDateWrapEl = document.getElementById("stats-custom-date-wrap")
const statsCustomDateEl = document.getElementById("stats-custom-date")

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

function getPeriodStart(period, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (period === "today") return start

  if (period === "weekly") {
    const weekday = start.getDay()
    const diffToMonday = (weekday + 6) % 7
    start.setDate(start.getDate() - diffToMonday)
    return start
  }

  if (period === "monthly") {
    start.setDate(1)
    return start
  }

  return null
}

function getDayBounds(isoDate) {
  if (!isoDate) return null
  const start = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function getScopedOrders(period = currentStatsPeriod) {
  if (period === "custom") {
    const bounds = getDayBounds(statsCustomDateEl?.value)
    if (!bounds) return []
    return allOrders.filter((order) => {
      const ts = parseCreatedAt(order).getTime()
      return ts >= bounds.start.getTime() && ts < bounds.end.getTime()
    })
  }

  const periodStart = getPeriodStart(period)
  if (!periodStart) return [...allOrders]
  return allOrders.filter((order) => parseCreatedAt(order).getTime() >= periodStart.getTime())
}

function getStatsScopeLabel(period = currentStatsPeriod) {
  if (period === "today") return "Hoje"
  if (period === "weekly") return "Esta semana"
  if (period === "monthly") return "Este mês"
  if (period === "custom") {
    const bounds = getDayBounds(statsCustomDateEl?.value)
    if (!bounds) return "Dia específico"
    return bounds.start.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }
  return "Sempre"
}

function setupStatsPeriodFilter() {
  if (statsCustomDateEl && !statsCustomDateEl.value) {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    statsCustomDateEl.value = `${yyyy}-${mm}-${dd}`
  }

  if (!statsPeriodEl) return

  const toggleCustomDate = () => {
    if (!statsCustomDateWrapEl) return
    statsCustomDateWrapEl.style.display = currentStatsPeriod === "custom" ? "inline-flex" : "none"
  }

  statsPeriodEl.value = currentStatsPeriod
  toggleCustomDate()
  statsPeriodEl.onchange = () => {
    currentStatsPeriod = statsPeriodEl.value || "today"
    toggleCustomDate()
    updateStats()
    displayOrders()
  }

  if (statsCustomDateEl) {
    statsCustomDateEl.onchange = () => {
      if (currentStatsPeriod !== "custom") return
      updateStats()
      displayOrders()
    }
  }
}

onAuthStateChanged(auth, async (user) => {
  const accessDenied = document.getElementById("access-denied")
  const adminContent = document.getElementById("admin-content")
  const loading = document.getElementById("loading")

  if (!user) {
    loading.style.display = "none"
    accessDenied.style.display = "block"
    return
  }

  const role = await getUserRole(user.uid)
  currentUserRole = role
  currentUserEmail = user.email || ""

  if (role !== "admin" && role !== "staff") {
    loading.style.display = "none"
    accessDenied.style.display = "block"
    return
  }

  // Show admin content
  accessDenied.style.display = "none"
  adminContent.style.display = "block"

  // Check if current user is super admin
  const isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL

  // Show user management only for admins, but products/recipes for both admin and staff
  if (role === "admin") {
    // Show all tabs for admin
    document.querySelector('.admin-tab[data-tab="utilizadores"]').style.display = "flex"
    
    // Show users list only for super admin
    if (isSuperAdmin) {
      document.getElementById("users-list-section").style.display = "block"
      loadUsersAdmin()
    }
  } else {
    // Hide user management for staff
    document.querySelector('.admin-tab[data-tab="utilizadores"]').style.display = "none"
  }
  // Show products and recipes tabs for both admin and staff
  document.querySelector('.admin-tab[data-tab="produtos"]').style.display = "flex"
  document.querySelector('.admin-tab[data-tab="receitas"]').style.display = "flex"
  // Show descontos tab only for admin
  const descontosTab = document.querySelector('.admin-tab[data-tab="descontos"]')
  if (descontosTab) descontosTab.style.display = role === 'admin' ? 'flex' : 'none'

  setupStatsPeriodFilter()
  loadOrders()
  // Load products and recipes for both admin and staff
  loadRecipesAdmin()
  loadProductsAdmin()
  if (role === 'admin') loadDiscountsAdmin()

  if (autoStatusTimer) clearInterval(autoStatusTimer)
  autoStatusTimer = setInterval(async () => {
    await applyAutomaticStatusUpdates()
    updateStats()
    displayOrders()
  }, 30 * 1000)
})

// --- Receitas ---
const createRecipeForm = document.getElementById("create-recipe-form")
const recipeImageUrlInput = document.getElementById("recipe-image-url")
const recipeImageFileInput = document.getElementById("recipe-image-file")
const recipePreviewEl = document.getElementById("recipe-image-preview")

let recipeImageData = ""

function linesToArray(value) {
  return (value || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
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
    {
      keywords: ["pão de centeio"],
      details: "Unidade. Ingredientes: farinha de centeio, farinha de trigo, água, fermento e sal.",
    },
    {
      keywords: ["pão alentejano"],
      details: "Unidade. Ingredientes: farinha de trigo, água, fermento natural e sal.",
    },
    {
      keywords: ["broa"],
      details: "Unidade. Ingredientes: farinha de milho, farinha de trigo, água, fermento e sal.",
    },
    {
      keywords: ["papo seco"],
      details: "Unidade. Ingredientes: farinha de trigo, água, fermento, sal e um toque de açúcar.",
    },
    {
      keywords: ["pastel de nata"],
      details: "Unidade. Ingredientes: massa folhada, leite, ovos, açúcar, farinha e canela.",
    },
    {
      keywords: ["croissant"],
      details: "Unidade. Ingredientes: farinha de trigo, manteiga, leite, fermento, açúcar e sal.",
    },
    {
      keywords: ["bola de berlim"],
      details: "Unidade. Ingredientes: farinha, ovos, leite, açúcar, fermento e creme de ovos.",
    },
    {
      keywords: ["queijada"],
      details: "Unidade. Ingredientes: queijo fresco, açúcar, ovos, farinha de trigo e manteiga.",
    },
    {
      keywords: ["bolo de chocolate"],
      details: "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, chocolate em pó, manteiga e leite.",
    },
    {
      keywords: ["bolo de ananás"],
      details: "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, ananás, manteiga e fermento.",
    },
    {
      keywords: ["tarte de maçã"],
      details: "Bolo inteiro. Ingredientes: massa quebrada, maçã, açúcar, canela, manteiga e ovos.",
    },
    {
      keywords: ["bolo rei"],
      details: "Bolo inteiro. Ingredientes: farinha, ovos, açúcar, manteiga, fermento e frutas cristalizadas.",
    },
    {
      keywords: ["sumo de laranja"],
      details: "Copo 300ml. Ingredientes: laranja fresca espremida, sem adição de açúcar.",
    },
    {
      keywords: ["limonada"],
      details: "Copo 300ml. Ingredientes: água, sumo de limão, açúcar e gelo.",
    },
  ]

  for (const rule of keywordRules) {
    const matches = rule.keywords.every((keyword) => name.includes(keyword))
    if (matches) return rule.details
  }

  if (category === "bread") {
    return "Unidade. Ingredientes principais: farinha de trigo, água, fermento e sal."
  }
  if (category === "pastry") {
    return "Unidade. Ingredientes principais: farinha de trigo, ovos, açúcar e manteiga."
  }
  if (category === "cake") {
    return "Bolo inteiro. Ingredientes principais: farinha, ovos, açúcar, manteiga e fermento."
  }
  if (category === "snacks") {
    return "Unidade. Pode conter pão ou massa base, proteína, vegetais e molho."
  }
  if (category === "drinks") {
    return "Copo 300ml. Bebida preparada com ingredientes frescos."
  }

  return "Produto artesanal. Consulte os ingredientes no balcão."
}

async function backfillMissingProductDetails(products = []) {
  const missingDetails = products.filter((p) => !String(p?.details || "").trim())
  if (!missingDetails.length) return 0

  let updatedCount = 0
  for (const product of missingDetails) {
    const autoDetails = buildAutoProductDetails(product)
    if (!autoDetails) continue

    const updatePayload = { details: autoDetails }
    if (!String(product?.description || "").trim()) {
      updatePayload.description = autoDetails
    }

    try {
      await updateDoc(doc(db, "products", product.id), updatePayload)
      product.details = autoDetails
      if (!String(product?.description || "").trim()) {
        product.description = autoDetails
      }
      updatedCount += 1
    } catch (error) {
      console.error("Erro ao preencher detalhes do produto:", product?.name, error)
    }
  }

  return updatedCount
}

async function fileToBase64Compressed(file, options = {}) {
  const {
    maxWidth = 1400,
    quality = 0.9,
    maxBytes = 480 * 1024,
    minLongSide = 900,
    minShortSide = 500,
  } = options

  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Ficheiro inválido")
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro"))
    reader.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error("Imagem inválida"))
    i.src = dataUrl
  })

  const longSide = Math.max(img.width, img.height)
  const shortSide = Math.min(img.width, img.height)
  // Accept images that meet the configured long/short side requirement,
  // or accept square-ish images with at least 800x800 as a special-case.
  const meetsConfigured = longSide >= minLongSide && shortSide >= minShortSide
  const meets800Square = img.width >= 800 && img.height >= 800
  if (!(meetsConfigured || meets800Square)) {
    throw new Error(
      `Imagem com baixa resolucao (${img.width}x${img.height}). Use pelo menos ${minLongSide}x${minShortSide} ou 800x800.`,
    )
  }

  const ratio = img.width > maxWidth ? maxWidth / img.width : 1
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0, w, h)

  const out = canvas.toDataURL("image/jpeg", quality)

  // tamanho aproximado do base64
  const bytes = Math.ceil(((out.length - "data:image/jpeg;base64,".length) * 3) / 4)
  if (bytes > maxBytes) {
    throw new Error("Imagem demasiado grande apos compressao. Tenta uma imagem mais leve.")
  }

  return out
}

recipeImageFileInput?.addEventListener("change", async () => {
  const file = recipeImageFileInput.files?.[0]
  if (!file) {
    recipeImageData = ""
    if (recipePreviewEl) recipePreviewEl.style.display = "none"
    return
  }

  try {
    recipeImageData = await fileToBase64Compressed(file)
    if (recipePreviewEl) {
      recipePreviewEl.src = recipeImageData
      recipePreviewEl.style.display = "block"
    }
  } catch (error) {
    console.error(error)
    recipeImageData = ""
    if (recipePreviewEl) recipePreviewEl.style.display = "none"
    showToast("Erro", error.message || "Não foi possível processar a imagem", "error")
    recipeImageFileInput.value = ""
  }
})

createRecipeForm?.addEventListener("submit", async (e) => {
  e.preventDefault()

  if (currentUserRole !== "admin" && currentUserRole !== "staff") {
    showToast("Erro", "Apenas administradores e funcionários podem criar receitas", "error")
    return
  }

  const title = document.getElementById("recipe-title").value.trim()
  const description = document.getElementById("recipe-description").value.trim()
  const ingredients = linesToArray(document.getElementById("recipe-ingredients").value)
  const steps = linesToArray(document.getElementById("recipe-steps").value)

  const imageUrl = (recipeImageUrlInput?.value || "").trim()
  const imageData = recipeImageData

  const btn = document.getElementById("create-recipe-btn")
  if (btn) {
    btn.disabled = true
    btn.textContent = "A criar..."
  }

  try {
    await addDoc(collection(db, "recipes"), {
      title,
      description,
      ingredients,
      steps,
      imageUrl: imageData ? "" : imageUrl,
      imageData: imageData || "",
      createdAt: serverTimestamp(),
    })

    showToast("Sucesso", "Receita criada com sucesso", "success")
    createRecipeForm.reset()
    recipeImageData = ""
    if (recipePreviewEl) {
      recipePreviewEl.removeAttribute("src")
      recipePreviewEl.style.display = "none"
    }
    resetRecipePreview()
    loadRecipesAdmin()
  } catch (error) {
    console.error("Erro ao criar receita:", error)
    showToast("Erro", "Não foi possível criar a receita", "error")
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = "Criar Receita"
    }
  }
})

// --- Produtos (imagem por URL ou ficheiro do PC, guardada como base64 no Firestore) ---
const createProductForm = document.getElementById("create-product-form")
const productImageUrlInput = document.getElementById("product-image-url")
const productImageFileInput = document.getElementById("product-image-file")
const productPreviewEl = document.getElementById("product-image-preview")
const productOutOfStockEl = document.getElementById("product-out-of-stock")
const productRestockWrapEl = document.getElementById("product-restock-wrap")
const productRestockEstimateEl = document.getElementById("product-restock-estimate")

let productImageData = ""

function toggleCreateRestockField() {
  if (!productRestockWrapEl || !productOutOfStockEl) return
  const show = productOutOfStockEl.checked
  productRestockWrapEl.style.display = show ? "block" : "none"
  if (!show && productRestockEstimateEl) {
    productRestockEstimateEl.value = ""
  }
}

productOutOfStockEl?.addEventListener("change", toggleCreateRestockField)

productImageFileInput?.addEventListener("change", async () => {
  const file = productImageFileInput.files?.[0]
  if (!file) {
    productImageData = ""
    if (productPreviewEl) productPreviewEl.style.display = "none"
    return
  }

  try {
    productImageData = await fileToBase64Compressed(file)
    if (productPreviewEl) {
      productPreviewEl.src = productImageData
      productPreviewEl.style.display = "block"
    }
  } catch (error) {
    console.error(error)
    productImageData = ""
    if (productPreviewEl) productPreviewEl.style.display = "none"
    showToast("Erro", error.message || "Não foi possível processar a imagem", "error")
    productImageFileInput.value = ""
  }
})

createProductForm?.addEventListener("submit", async (e) => {
  e.preventDefault()

  if (currentUserRole !== "admin" && currentUserRole !== "staff") {
    showToast("Erro", "Apenas administradores e funcionários podem criar produtos", "error")
    return
  }

  const name = document.getElementById("product-name").value
  const price = Number.parseFloat(document.getElementById("product-price").value)
  const category = document.getElementById("product-category").value
  const details = document.getElementById("product-details").value.trim()
  const imageUrl = (productImageUrlInput?.value || "").trim()
  const isOutOfStock = Boolean(productOutOfStockEl?.checked)
  const restockEstimate = (productRestockEstimateEl?.value || "").trim()

  const imageFinal = productImageData || imageUrl
  if (!imageFinal) {
    showToast("Erro", "Escolhe uma imagem (URL ou ficheiro)", "error")
    return
  }

  const createBtn = document.getElementById("create-product-btn")
  if (createBtn) {
    createBtn.disabled = true
    createBtn.textContent = "A criar..."
  }

  try {
    await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      details,
      description: details,
      available: !isOutOfStock,
      restockEstimate: isOutOfStock ? restockEstimate : "",
      // compatibilidade com o resto do site
      image: imageFinal,
      imageUrl: imageUrl || "",
      imageData: productImageData || "",
      createdAt: serverTimestamp(),
    })

    showToast("Sucesso", "Produto criado com sucesso", "success")
    createProductForm.reset()
    productImageData = ""
    toggleCreateRestockField()
    if (productPreviewEl) productPreviewEl.style.display = "none"
    resetProductPreview()
    loadProductsAdmin()
  } catch (error) {
    console.error("Error creating product:", error)
    showToast("Erro", "Não foi possível criar o produto: " + error.message, "error")
  } finally {
    if (createBtn) {
      createBtn.disabled = false
      createBtn.textContent = "Criar Produto"
    }
  }
})

// ========================================
// LIVE PREVIEW - Product
// ========================================

const categoryLabels = {
  bread: "Pão",
  pastry: "Pastelaria",
  cake: "Bolos",
  snacks: "Snacks",
  drinks: "Bebidas",
}

function updateProductPreview() {
  const name = document.getElementById("product-name")?.value || ""
  const price = document.getElementById("product-price")?.value || ""
  const category = document.getElementById("product-category")?.value || ""
  const details = document.getElementById("product-details")?.value || ""
  const imageUrl = document.getElementById("product-image-url")?.value || ""

  // Update preview elements
  const previewName = document.getElementById("preview-product-name")
  const previewPrice = document.getElementById("preview-product-price")
  const previewCategory = document.getElementById("preview-product-category")
  const previewDescription = document.getElementById("preview-product-description")
  const previewImage = document.getElementById("preview-product-image")
  const previewCard = document.getElementById("product-live-preview")

  if (previewName) {
    previewName.textContent = name || "Nome do Produto"
    previewName.classList.add("preview-updating")
    setTimeout(() => previewName.classList.remove("preview-updating"), 300)
  }

  if (previewPrice) {
    const priceValue = parseFloat(price) || 0
    previewPrice.textContent = `€${priceValue.toFixed(2)}`
  }

  if (previewCategory) {
    previewCategory.textContent = categoryLabels[category] || "Categoria"
  }

  if (previewDescription) {
    previewDescription.textContent =
      details.trim() || "Receita artesanal preparada diariamente."
  }

  if (previewImage) {
    // Use file preview if available, otherwise URL
    if (productImageData) {
      previewImage.src = productImageData
    } else if (imageUrl) {
      previewImage.src = imageUrl
    } else {
      previewImage.src = "https://via.placeholder.com/300x200?text=Imagem+do+Produto"
    }
  }
}

// Attach event listeners for product preview
document.getElementById("product-name")?.addEventListener("input", updateProductPreview)
document.getElementById("product-price")?.addEventListener("input", updateProductPreview)
document.getElementById("product-category")?.addEventListener("change", updateProductPreview)
document.getElementById("product-details")?.addEventListener("input", updateProductPreview)
document.getElementById("product-image-url")?.addEventListener("input", updateProductPreview)

// Update preview when file is selected (the existing listener sets productImageData)
const originalProductFileHandler = productImageFileInput?.onchange
productImageFileInput?.addEventListener("change", () => {
  setTimeout(updateProductPreview, 100) // Wait for base64 processing
})

// ========================================
// LIVE PREVIEW - Recipe
// ========================================

function updateRecipePreview() {
  const title = document.getElementById("recipe-title")?.value || ""
  const description = document.getElementById("recipe-description")?.value || ""
  const ingredients = document.getElementById("recipe-ingredients")?.value || ""
  const steps = document.getElementById("recipe-steps")?.value || ""
  const imageUrl = document.getElementById("recipe-image-url")?.value || ""

  // Update preview elements
  const previewTitle = document.getElementById("preview-recipe-title")
  const previewDescription = document.getElementById("preview-recipe-description")
  const previewImage = document.getElementById("preview-recipe-image")
  const previewIngredients = document.getElementById("preview-recipe-ingredients")
  const previewSteps = document.getElementById("preview-recipe-steps")

  if (previewTitle) {
    previewTitle.textContent = title || "Título da Receita"
  }

  if (previewDescription) {
    previewDescription.textContent = description || "Descrição da receita..."
  }

  if (previewImage) {
    // Use file preview if available, otherwise URL
    if (recipeImageData) {
      previewImage.src = recipeImageData
    } else if (imageUrl) {
      previewImage.src = imageUrl
    } else {
      previewImage.src = "https://via.placeholder.com/300x200?text=Imagem+da+Receita"
    }
  }

  if (previewIngredients) {
    const ingredientsList = ingredients.split("\n").filter(line => line.trim())
    if (ingredientsList.length > 0) {
      previewIngredients.innerHTML = ingredientsList
        .map(ing => `<li>${escapeHtmlPreview(ing.trim())}</li>`)
        .join("")
    } else {
      previewIngredients.innerHTML = '<li class="preview-placeholder">Os ingredientes vão aparecer aqui...</li>'
    }
  }

  if (previewSteps) {
    const stepsList = steps.split("\n").filter(line => line.trim())
    if (stepsList.length > 0) {
      previewSteps.innerHTML = stepsList
        .map(step => `<li>${escapeHtmlPreview(step.trim())}</li>`)
        .join("")
    } else {
      previewSteps.innerHTML = '<li class="preview-placeholder">Os passos vão aparecer aqui...</li>'
    }
  }
}

function escapeHtmlPreview(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

// Reset preview functions (called after form submission)
function resetProductPreview() {
  const previewName = document.getElementById("preview-product-name")
  const previewPrice = document.getElementById("preview-product-price")
  const previewCategory = document.getElementById("preview-product-category")
  const previewDescription = document.getElementById("preview-product-description")
  const previewImage = document.getElementById("preview-product-image")

  if (previewName) previewName.textContent = "Nome do Produto"
  if (previewPrice) previewPrice.textContent = "€0.00"
  if (previewCategory) previewCategory.textContent = "Categoria"
  if (previewDescription) previewDescription.textContent = "Receita artesanal preparada diariamente."
  if (previewImage) previewImage.src = "https://via.placeholder.com/300x200?text=Imagem+do+Produto"
}

function resetRecipePreview() {
  const previewTitle = document.getElementById("preview-recipe-title")
  const previewDescription = document.getElementById("preview-recipe-description")
  const previewImage = document.getElementById("preview-recipe-image")
  const previewIngredients = document.getElementById("preview-recipe-ingredients")
  const previewSteps = document.getElementById("preview-recipe-steps")

  if (previewTitle) previewTitle.textContent = "Título da Receita"
  if (previewDescription) previewDescription.textContent = "Descrição da receita..."
  if (previewImage) previewImage.src = "https://via.placeholder.com/300x200?text=Imagem+da+Receita"
  if (previewIngredients) previewIngredients.innerHTML = '<li class="preview-placeholder">Os ingredientes vão aparecer aqui...</li>'
  if (previewSteps) previewSteps.innerHTML = '<li class="preview-placeholder">Os passos vão aparecer aqui...</li>'
}

// Attach event listeners for recipe preview
document.getElementById("recipe-title")?.addEventListener("input", updateRecipePreview)
document.getElementById("recipe-description")?.addEventListener("input", updateRecipePreview)
document.getElementById("recipe-ingredients")?.addEventListener("input", updateRecipePreview)
document.getElementById("recipe-steps")?.addEventListener("input", updateRecipePreview)
document.getElementById("recipe-image-url")?.addEventListener("input", updateRecipePreview)

// Update preview when file is selected
recipeImageFileInput?.addEventListener("change", () => {
  setTimeout(updateRecipePreview, 100) // Wait for base64 processing
})

async function loadRecipesAdmin() {
  const listEl = document.getElementById("admin-recipes-list")
  if (!listEl) return

  listEl.innerHTML = "<p style=\"color: var(--text-secondary);\">A carregar...</p>"
  try {
    const q = query(collection(db, "recipes"), orderBy("createdAt", "desc"))
    const snap = await getDocs(q)
    const recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    if (!recipes.length) {
      listEl.innerHTML = "<p style=\"color: var(--text-secondary);\">Sem receitas.</p>"
      return
    }

    listEl.innerHTML = recipes
      .map((r) => {
        const subtitle = (r.description || "").slice(0, 80)
        return `
          <div class="admin-list-item">
            <div>
              <h5>${(r.title || "Receita").replace(/</g, "&lt;")}</h5>
              <p>${subtitle.replace(/</g, "&lt;")}${subtitle.length === 80 ? "..." : ""}</p>
            </div>
            <div class="item-actions">
              <button class="btn-edit" data-recipe-edit="${r.id}">Editar</button>
              <button class="btn-danger" data-recipe-delete="${r.id}">Apagar</button>
            </div>
          </div>
        `
      })
      .join("")

    // Store recipes for editing
    window._adminRecipes = recipes

    listEl.querySelectorAll("[data-recipe-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-recipe-edit")
        openEditRecipeModal(id)
      })
    })

    listEl.querySelectorAll("[data-recipe-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-recipe-delete")
        if (!id) return
        const ok = confirm("Tens a certeza que queres apagar esta receita?")
        if (!ok) return
        try {
          await deleteDoc(doc(db, "recipes", id))
          showToast("Sucesso", "Receita apagada", "success")
          loadRecipesAdmin()
        } catch (error) {
          console.error("Erro ao apagar receita:", error)
          showToast("Erro", "Não foi possível apagar a receita", "error")
        }
      })
    })
  } catch (error) {
    console.error("Erro ao carregar receitas:", error)
    listEl.innerHTML = "<p style=\"color: var(--text-secondary);\">Erro ao carregar receitas.</p>"
  }
}

// --- Produtos (listagem e remoção) ---
async function loadProductsAdmin() {
  const listEl = document.getElementById("admin-products-list")
  if (!listEl) return

  listEl.innerHTML = "<p style=\"color: var(--text-secondary);\">A carregar...</p>"
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"))
    const snap = await getDocs(q)
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    const autoUpdated = await backfillMissingProductDetails(products)
    if (autoUpdated > 0) {
      showToast("Detalhes atualizados", `${autoUpdated} produto(s) foram preenchidos automaticamente.`, "success")
    }

    if (!products.length) {
      listEl.innerHTML = "<p style=\"color: var(--text-secondary);\">Sem produtos.</p>"
      return
    }

    const categoryLabelsAdmin = {
      bread: "Pão",
      pastry: "Pastelaria",
      cake: "Bolos",
      snacks: "Snacks",
      drinks: "Bebidas",
    }

    listEl.innerHTML = products
      .map((p) => {
        const name = (p.name || "Produto").replace(/</g, "&lt;")
        const category = categoryLabelsAdmin[p.category] || p.category || "Outro"
        const details = (p.details || p.description || "").replace(/</g, "&lt;")
        const restockEstimate = String(p.restockEstimate || "").replace(/</g, "&lt;")
        const stockState = p.available === false ? "Fora de stock" : "Em stock"
        const price = typeof p.price === "number" ? p.price.toFixed(2) + " €" : "-"
        const imgSrc = p.imageData || p.image || p.imageUrl || ""
        const imgHtml = imgSrc 
          ? `<img src="${imgSrc}" alt="${name}" class="item-image" />`
          : `<div class="item-image" style="display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--text-muted);">Sem img</div>`
        
        return `
          <div class="admin-list-item">
            <div class="item-info">
              ${imgHtml}
              <div class="item-details">
                <h5>${name}</h5>
                <p>${category}</p>
                ${details ? `<p class="item-subtitle">${details}</p>` : ""}
                <p class="item-subtitle"><strong>Stock:</strong> ${stockState}</p>
                ${p.available === false && restockEstimate ? `<p class="item-subtitle"><strong>Volta em:</strong> aproximadamente ${restockEstimate} dia${restockEstimate !== '1' ? 's' : ''}</p>` : ""}
                <p class="item-price">${price}</p>
              </div>
            </div>
            <div class="item-actions">
              <button class="btn-edit" data-product-edit="${p.id}">Editar</button>
              <button class="btn-danger" data-product-delete="${p.id}">Remover</button>
              <button class="btn-stock" data-product-stock="${p.id}" style="margin-left:8px;${p.available === false ? 'display:none;' : ''}">Tirar do stock</button>
              <button class="btn-stock-in" data-product-stock-in="${p.id}" style="margin-left:8px;${p.available === false ? '' : 'display:none;'}">Colocar no stock</button>
            </div>
          </div>
        `
      })
      .join("")

    // Store products for editing
    window._adminProducts = products

    listEl.querySelectorAll("[data-product-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-product-edit")
        openEditProductModal(id)
      })
    })

    listEl.querySelectorAll("[data-product-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-product-delete")
        if (!id) return
        const ok = confirm("Tens a certeza que queres remover este produto?")
        if (!ok) return
        try {
          await deleteDoc(doc(db, "products", id))
          showToast("Sucesso", "Produto removido com sucesso", "success")
          loadProductsAdmin()
        } catch (error) {
          console.error("Erro ao remover produto:", error)
          showToast("Erro", "Não foi possível remover o produto", "error")
        }
      })
    })

    // Botões de stock
    listEl.querySelectorAll("[data-product-stock]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-product-stock")
        if (!id) return
        const restockInput = prompt("Número de dias para voltar ao stock (Ex: 2):", "")
        if (restockInput === null) return
        const restockDays = String(restockInput || "").trim()
        if (!restockDays || isNaN(Number(restockDays)) || Number(restockDays) < 1) {
          showToast("Erro", "Por favor, escreva um número válido (mínimo 1 dia)", "error")
          return
        }
        try {
          await updateDoc(doc(db, "products", id), {
            available: false,
            restockEstimate: restockDays,
          })
          showToast("Sucesso", "Produto retirado do stock", "success")
          loadProductsAdmin()
        } catch (err) {
          showToast("Erro", "Não foi possível tirar do stock", "error")
        }
      })
    })
    listEl.querySelectorAll("[data-product-stock-in]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-product-stock-in")
        if (!id) return
        try {
          await updateDoc(doc(db, "products", id), { available: true, restockEstimate: "" })
          showToast("Sucesso", "Produto colocado no stock", "success")
          loadProductsAdmin()
        } catch (err) {
          showToast("Erro", "Não foi possível colocar no stock", "error")
        }
      })
    })
  } catch (error) {
    console.error("Erro ao carregar produtos:", error)
    listEl.innerHTML = "<p style=\"color: var(--text-secondary);\">Erro ao carregar produtos.</p>"
  }
}

// --- Descontos (admin only) ---
async function loadDiscountsAdmin() {
  const listEl = document.getElementById('discounts-list')
  if (!listEl) return

  listEl.innerHTML = '<p style="color: var(--text-secondary);">A carregar produtos...</p>'

  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    if (!products.length) {
      listEl.innerHTML = '<p style="color: var(--text-secondary);">Sem produtos.</p>'
      return
    }

    listEl.innerHTML = products
      .map((p) => {
        const name = (p.name || 'Produto').replace(/</g, '&lt;')
        const imgSrc = p.imageData || p.image || p.imageUrl || ''
        const current = typeof p.discountPercent === 'number' ? String(p.discountPercent) : ''
        // compute remaining days if discountExpires exists
        let currentDays = ''
        if (p.discountExpires) {
          try {
            const expDate = typeof p.discountExpires.toDate === 'function' ? p.discountExpires.toDate() : new Date(p.discountExpires)
            const diff = Math.ceil((expDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            currentDays = diff > 0 ? String(diff) : '0'
          } catch (e) {
            currentDays = ''
          }
        }

        return `
          <div class="admin-list-item">
            <div class="item-info">
              ${imgSrc ? `<img src="${imgSrc}" alt="${name}" class="item-image" />` : `<div class="item-image" style="display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--text-muted);">Sem img</div>`}
              <div class="item-details">
                <h5>${name}</h5>
                <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
                  <label style="font-size:0.85rem; color:var(--text-secondary);">Desconto %</label>
                  <input type="number" min="0" max="100" class="discount-input" data-product-id="${p.id}" value="${current}" style="width:80px; padding:6px;" />
                  <label style="font-size:0.85rem; color:var(--text-secondary);">Dias</label>
                  <input type="number" min="0" max="3650" class="discount-days-input" data-product-id="${p.id}" value="${currentDays}" style="width:80px; padding:6px;" />
                  <button class="btn-primary btn-small" data-save-discount="${p.id}">Guardar</button>
                </div>
                <div style="margin-top:6px; font-size:0.9rem; color:var(--text-secondary);">Tempo restante: <span class="discount-remaining" data-discount-expires="${p.discountExpires ? (typeof p.discountExpires.toDate === 'function' ? p.discountExpires.toDate().toISOString() : new Date(p.discountExpires).toISOString()) : ''}">-</span></div>
              </div>
            </div>
          </div>
        `
      })
      .join('')

    // Attach handlers
    listEl.querySelectorAll('[data-save-discount]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-save-discount')
        const input = listEl.querySelector(`.discount-input[data-product-id="${pid}"]`)
        const daysInput = listEl.querySelector(`.discount-days-input[data-product-id="${pid}"]`)
        if (!input) return
        const val = input.value.trim()
        const daysVal = daysInput ? daysInput.value.trim() : ''
        let percent = Number(val)
        if (!val) percent = 0
        if (Number.isNaN(percent) || percent < 0 || percent > 100) {
          showToast('Erro', 'Percentagem inválida (0-100)', 'error')
          return
        }

        // parse days: empty => permanent, 0 => remove discount, positive => days
        let expires = null
        if (percent > 0 && daysVal) {
          const days = Number(daysVal)
          if (Number.isNaN(days) || days < 0 || days > 3650) {
            showToast('Erro', 'Dias inválidos (0-3650)', 'error')
            return
          }
          if (days > 0) {
            expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
          }
        }

        try {
          const docRef = doc(db, 'products', pid)
          if (percent === 0) {
            await updateDoc(docRef, { discountPercent: 0, discountExpires: null })
            showToast('Sucesso', 'Desconto removido', 'success')
          } else {
            const payload = { discountPercent: percent }
            if (expires) payload.discountExpires = expires
            else payload.discountExpires = null
            await updateDoc(docRef, payload)
            showToast('Sucesso', 'Desconto atualizado', 'success')
          }
          // refresh list
          loadDiscountsAdmin()
        } catch (error) {
          console.error('Erro ao guardar desconto:', error)
          showToast('Erro', 'Não foi possível guardar o desconto', 'error')
        }
      })
    })
    // Setup a single interval to update remaining time displays (hours:minutes:seconds)
    if (window._discountAdminTimer) {
      clearInterval(window._discountAdminTimer)
    }
    function updateAdminRemaining() {
      const nodes = listEl.querySelectorAll('[data-discount-expires]')
      nodes.forEach((n) => {
        const ts = n.getAttribute('data-discount-expires')
        if (!ts) {
          n.textContent = 'Permanente'
          return
        }
        const exp = new Date(ts)
        const diff = exp.getTime() - Date.now()
        if (diff <= 0) {
          n.textContent = 'Expirado'
          return
        }
        const days = Math.floor(diff / (24*60*60*1000))
        const hours = Math.floor((diff % (24*60*60*1000)) / (60*60*1000))
        const mins = Math.floor((diff % (60*60*1000)) / (60*1000))
        const secs = Math.floor((diff % (60*1000)) / 1000)
        n.textContent = `${days}d ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
      })
    }
    updateAdminRemaining()
    window._discountAdminTimer = setInterval(updateAdminRemaining, 1000)
  } catch (error) {
    console.error('Erro ao carregar descontos:', error)
    listEl.innerHTML = '<p style="color: var(--text-secondary);">Erro ao carregar produtos.</p>'
  }
}

const createUserForm = document.getElementById("create-user-form")
if (createUserForm) {
  createUserForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    if (currentUserRole !== "admin") {
      showToast("Erro", "Apenas administradores podem criar utilizadores", "error")
      return
    }

    const email = document.getElementById("new-user-email").value
    const password = document.getElementById("new-user-password").value
    const name = document.getElementById("new-user-name").value
    const role = document.getElementById("new-user-role").value

    try {
      // Create user account
      const { user } = await createUserWithEmailAndPassword(auth, email, password)

      // Store user data with role
      await setDoc(doc(db, "users", user.uid), {
        email,
        name,
        role,
        createdAt: new Date(),
      })

      showToast("Sucesso", `${role === "admin" ? "Administrador" : "Funcionário"} criado com sucesso`, "success")
      createUserForm.reset()

      // Re-login the admin (creating user logs us in as that user)
      window.location.reload()
    } catch (error) {
      console.error("Error creating user:", error)
      showToast("Erro", error.message, "error")
    }
  })
}

// --- Gestão de Utilizadores (Super Admin) ---
async function loadUsersAdmin() {
  const listEl = document.getElementById("users-list")
  if (!listEl) return
  
  // Only super admin can see this
  if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
    listEl.innerHTML = "<p>Sem permissão para ver utilizadores.</p>"
    return
  }
  
  listEl.innerHTML = "<p>A carregar utilizadores...</p>"
  
  try {
    const snapshot = await getDocs(collection(db, "users"))
    const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    
    // Filter only admins and staff (not customers)
    const staffUsers = users.filter(u => u.role === "admin" || u.role === "staff")
    
    if (staffUsers.length === 0) {
      listEl.innerHTML = "<p style='color: var(--text-secondary);'>Nenhum funcionário ou administrador encontrado.</p>"
      return
    }
    
    listEl.innerHTML = staffUsers.map(u => {
      const isSuperAdmin = u.email === SUPER_ADMIN_EMAIL
      const roleLabel = u.role === "admin" ? "Administrador" : "Funcionário"
      const roleClass = u.role === "admin" ? "badge-admin" : "badge-staff"
      
      return `
        <div class="admin-item user-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.5rem;">
          <div>
            <strong>${u.name || "Sem nome"}</strong>
            <span class="badge ${roleClass}" style="margin-left: 0.5rem; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: ${u.role === 'admin' ? 'var(--primary)' : 'var(--secondary)'}; color: white;">${roleLabel}</span>
            ${isSuperAdmin ? '<span style="margin-left: 0.5rem; color: gold; font-size: 0.75rem;">\u2b50 Dono</span>' : ''}
            <br><small style="color: var(--text-secondary);">${u.email}</small>
          </div>
          ${!isSuperAdmin ? `
            <div style="display: flex; gap: 0.5rem;">
              <select class="user-role-select" data-user-id="${u.id}" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border);">
                <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Funcionário</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
                <option value="customer">Remover Acesso</option>
              </select>
              <button class="btn-primary btn-small" data-save-user="${u.id}" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">Guardar</button>
            </div>
          ` : '<span style="color: var(--text-secondary); font-size: 0.85rem;">Não editável</span>'}
        </div>
      `
    }).join("")
    
    // Add event listeners for save buttons
    listEl.querySelectorAll("[data-save-user]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-save-user")
        const select = listEl.querySelector(`select[data-user-id="${userId}"]`)
        if (!select) return
        
        const newRole = select.value
        await updateUserRole(userId, newRole)
      })
    })
    
  } catch (error) {
    console.error("Erro ao carregar utilizadores:", error)
    listEl.innerHTML = "<p style='color: var(--error);'>Erro ao carregar utilizadores.</p>"
  }
}

async function updateUserRole(userId, newRole) {
  if (currentUserEmail !== SUPER_ADMIN_EMAIL) {
    showToast("Erro", "Apenas o super admin pode alterar permissões", "error")
    return
  }
  
  try {
    await updateDoc(doc(db, "users", userId), { role: newRole })
    
    const roleLabels = {
      admin: "Administrador",
      staff: "Funcionário",
      customer: "Cliente (sem acesso admin)"
    }
    
    showToast("Sucesso", `Permissão alterada para: ${roleLabels[newRole] || newRole}`, "success")
    loadUsersAdmin() // Refresh the list
  } catch (error) {
    console.error("Erro ao atualizar permissão:", error)
    showToast("Erro", "Não foi possível atualizar a permissão", "error")
  }
}

async function applyAutomaticStatusUpdates() {
  if (!allOrders.length) return

  const now = new Date()
  const updates = []

  allOrders.forEach((order) => {
    const nextStatus = computeAutoStatus(order, now)
    if (nextStatus !== order.status) {
      updates.push(
        updateDoc(doc(db, "orders", order.id), { status: nextStatus }).then(() => {
          order.status = nextStatus
        }),
      )
    }
  })

  if (updates.length) {
    await Promise.all(updates)
  }
}

// Load orders
async function loadOrders() {
  const loading = document.getElementById("loading")
  const ordersList = document.getElementById("admin-orders-list")

  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)

    allOrders = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    await applyAutomaticStatusUpdates()

    loading.style.display = "none"
    ordersList.style.display = "block"

    updateStats()
    displayOrders()
  } catch (error) {
    console.error("[v0] Error loading orders:", error)
    loading.innerHTML = "<p>Erro ao carregar encomendas.</p>"
  }
}

// Update stats
function updateStats() {
  const scopedOrders = getScopedOrders()
  const totalOrders = scopedOrders.length
  const totalRevenue = scopedOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
  const pendingOrders = scopedOrders.filter((o) => o.status === "pending" || o.status === "preparing").length
  const completedOrders = scopedOrders.filter((o) => o.status === "completed").length

  document.getElementById("total-orders").textContent = totalOrders
  document.getElementById("total-revenue").textContent = `${totalRevenue.toFixed(2)} €`
  document.getElementById("pending-orders").textContent = pendingOrders
  document.getElementById("completed-orders").textContent = completedOrders
  if (statsScopeLabelEl) {
    statsScopeLabelEl.textContent = getStatsScopeLabel()
  }
  
  // Update charts
  updateCharts()
}

// Display orders
function displayOrders() {
  const ordersList = document.getElementById("admin-orders-list")
  const visibleOrders = getScopedOrders()

  if (!visibleOrders.length) {
    ordersList.innerHTML = '<p style="color: var(--text-secondary);">Sem encomendas para o período selecionado.</p>'
    return
  }

  ordersList.innerHTML = visibleOrders
    .map((order) => {
      const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date()
      const dateStr = date.toLocaleDateString("pt-PT", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      const pickupStr =
        order.pickupDate && order.pickupTime ? `${order.pickupDate} • ${order.pickupTime}` : "Não definido"
      const paymentStr = order.paymentMethod === "card" ? "Cartão" : order.paymentMethod || "Não definido"
      const notes = String(order.internalNotes || "").replace(/</g, "&lt;")

      return `
      <div class="admin-order-item">
        <div class="admin-order-header">
          <div class="admin-order-info">
            <h4>Encomenda #${order.id.slice(0, 8)}</h4>
            <p class="admin-order-customer">${order.customerName} · ${order.customerEmail}</p>
            <p class="order-date">${dateStr}</p>
          </div>
          <select class="status-select" data-order-id="${order.id}">
            <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pendente</option>
            <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>A preparar</option>
            <option value="ready" ${order.status === "ready" ? "selected" : ""}>Pronto</option>
            <option value="completed" ${order.status === "completed" ? "selected" : ""}>Concluída</option>
            <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>Cancelada</option>
          </select>
        </div>

        <div class="admin-order-actions">
          <button type="button" class="btn-secondary admin-order-details-toggle" data-order-id="${order.id}">
            Ver detalhe
          </button>
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
          <span><strong>Total</strong></span>
          <span class="order-total">${order.total.toFixed(2)} €</span>
        </div>

        <div class="admin-order-details" id="admin-order-details-${order.id}" style="display:none;">
          <div class="admin-order-details-grid">
            <p><strong>Levantamento:</strong> ${pickupStr}</p>
            <p><strong>Pagamento:</strong> ${paymentStr}${order.cardLast4 ? ` • **** ${order.cardLast4}` : ""}</p>
            <p><strong>ID do cliente:</strong> ${order.userId || "N/D"}</p>
          </div>
          <div class="form-group" style="margin-top: 0.6rem;">
            <label for="internal-notes-${order.id}">Notas internas</label>
            <textarea id="internal-notes-${order.id}" class="admin-order-notes" rows="3" placeholder="Ex.: cliente pediu sem açúcar...">${notes}</textarea>
          </div>
          <div class="admin-order-notes-actions">
            <button type="button" class="btn-primary admin-save-notes-btn" data-order-id="${order.id}">Guardar notas</button>
          </div>
        </div>
      </div>
    `
    })
    .join("")

  document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const orderId = e.target.dataset.orderId
      const newStatus = e.target.value
      await updateOrderStatus(orderId, newStatus)
    })
  })

  document.querySelectorAll(".admin-order-details-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order-id")
      if (!orderId) return
      const detailsEl = document.getElementById(`admin-order-details-${orderId}`)
      if (!detailsEl) return
      const isOpen = detailsEl.style.display !== "none"
      detailsEl.style.display = isOpen ? "none" : "block"
      btn.textContent = isOpen ? "Ver detalhe" : "Fechar detalhe"
    })
  })

  document.querySelectorAll(".admin-save-notes-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.getAttribute("data-order-id")
      if (!orderId) return
      const notesEl = document.getElementById(`internal-notes-${orderId}`)
      if (!notesEl) return
      await saveInternalNotes(orderId, notesEl.value || "")
    })
  })
}
// Update order status
async function updateOrderStatus(orderId, newStatus) {
  try {
    const orderRef = doc(db, "orders", orderId)
    await updateDoc(orderRef, { status: newStatus })

    // Update local data
    const order = allOrders.find((o) => o.id === orderId)
    if (order) {
      order.status = newStatus
    }

    updateStats()
    showToast("Estado atualizado", `Encomenda #${orderId.slice(0, 8)} atualizada para ${newStatus}`, "success")
  } catch (error) {
    console.error("[v0] Error updating order:", error)
    showToast("Erro", "Não foi possível atualizar o estado da encomenda", "error")
  }
}

async function saveInternalNotes(orderId, notesText) {
  try {
    const notes = String(notesText || "").trim()
    await updateDoc(doc(db, "orders", orderId), { internalNotes: notes })

    const order = allOrders.find((o) => o.id === orderId)
    if (order) {
      order.internalNotes = notes
    }

    showToast("Notas guardadas", `Notas internas da encomenda #${orderId.slice(0, 8)} atualizadas.`, "success")
  } catch (error) {
    console.error("[v0] Error saving internal notes:", error)
    showToast("Erro", "Não foi possível guardar as notas internas.", "error")
  }
}

// Initialize
// loadOrders() // This is now called within onAuthStateChanged

// ========================================
// EDIT PRODUCT MODAL
// ========================================
const editProductModal = document.getElementById("edit-product-modal")
const editProductForm = document.getElementById("edit-product-form")
const editProductClose = document.getElementById("edit-product-close")
const editProductCancel = document.getElementById("edit-product-cancel")
const editProductImageFile = document.getElementById("edit-product-image-file")
const editProductImagePreview = document.getElementById("edit-product-image-preview")
const editProductOutOfStockEl = document.getElementById("edit-product-out-of-stock")
const editProductRestockWrapEl = document.getElementById("edit-product-restock-wrap")
const editProductRestockEstimateEl = document.getElementById("edit-product-restock-estimate")
let editProductImageData = ""

function toggleEditRestockField() {
  if (!editProductRestockWrapEl || !editProductOutOfStockEl) return
  const show = editProductOutOfStockEl.checked
  editProductRestockWrapEl.style.display = show ? "block" : "none"
  if (!show && editProductRestockEstimateEl) {
    editProductRestockEstimateEl.value = ""
  }
}

editProductOutOfStockEl?.addEventListener("change", toggleEditRestockField)

function openEditProductModal(productId) {
  const product = (window._adminProducts || []).find(p => p.id === productId)
  if (!product) return

  document.getElementById("edit-product-id").value = productId
  document.getElementById("edit-product-name").value = product.name || ""
  document.getElementById("edit-product-price").value = product.price || ""
  document.getElementById("edit-product-category").value = product.category || "bread"
  document.getElementById("edit-product-details").value = product.details || product.description || ""
  document.getElementById("edit-product-image-url").value = product.imageUrl || ""
  if (editProductOutOfStockEl) {
    editProductOutOfStockEl.checked = product.available === false
  }
  if (editProductRestockEstimateEl) {
    editProductRestockEstimateEl.value = product.restockEstimate || ""
  }
  toggleEditRestockField()
  
  const imgSrc = product.imageData || product.image || product.imageUrl || ""
  if (imgSrc) {
    editProductImagePreview.src = imgSrc
    editProductImagePreview.style.display = "block"
  } else {
    editProductImagePreview.style.display = "none"
  }
  
  editProductImageData = product.imageData || ""
  editProductModal.style.display = "flex"
  document.body.style.overflow = "hidden"
}

function closeEditProductModal() {
  editProductModal.style.display = "none"
  document.body.style.overflow = ""
  editProductImageData = ""
  editProductForm.reset()
  editProductImagePreview.style.display = "none"
}

editProductClose?.addEventListener("click", closeEditProductModal)
editProductCancel?.addEventListener("click", closeEditProductModal)
editProductModal?.addEventListener("click", (e) => {
  if (e.target === editProductModal) closeEditProductModal()
})

editProductImageFile?.addEventListener("change", async () => {
  const file = editProductImageFile.files?.[0]
  if (!file) return
  try {
    editProductImageData = await fileToBase64Compressed(file)
    editProductImagePreview.src = editProductImageData
    editProductImagePreview.style.display = "block"
  } catch (error) {
    showToast("Erro", error.message || "Não foi possível processar a imagem", "error")
  }
})

editProductForm?.addEventListener("submit", async (e) => {
  e.preventDefault()
  
  const productId = document.getElementById("edit-product-id").value
  const name = document.getElementById("edit-product-name").value.trim()
  const price = parseFloat(document.getElementById("edit-product-price").value)
  const category = document.getElementById("edit-product-category").value
  const details = document.getElementById("edit-product-details").value.trim()
  const imageUrl = document.getElementById("edit-product-image-url").value.trim()
  const isOutOfStock = Boolean(editProductOutOfStockEl?.checked)
  const restockEstimate = (editProductRestockEstimateEl?.value || "").trim()
  
  const saveBtn = document.getElementById("edit-product-save")
  saveBtn.disabled = true
  saveBtn.textContent = "A guardar..."

  try {
    const updateData = {
      name,
      price,
      category,
      details,
      description: details,
      available: !isOutOfStock,
      restockEstimate: isOutOfStock ? restockEstimate : "",
    }
    
    if (editProductImageData) {
      updateData.imageData = editProductImageData
      updateData.image = editProductImageData
      updateData.imageUrl = ""
    } else if (imageUrl) {
      updateData.imageUrl = imageUrl
      updateData.image = imageUrl
      updateData.imageData = ""
    }

    await updateDoc(doc(db, "products", productId), updateData)
    showToast("Sucesso", "Produto atualizado com sucesso", "success")
    closeEditProductModal()
    loadProductsAdmin()
  } catch (error) {
    console.error("Erro ao atualizar produto:", error)
    showToast("Erro", "Não foi possível atualizar o produto", "error")
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = "Guardar Alterações"
  }
})

// ========================================
// EDIT RECIPE MODAL
// ========================================
const editRecipeModal = document.getElementById("edit-recipe-modal")
const editRecipeForm = document.getElementById("edit-recipe-form")
const editRecipeClose = document.getElementById("edit-recipe-close")
const editRecipeCancel = document.getElementById("edit-recipe-cancel")
const editRecipeImageFile = document.getElementById("edit-recipe-image-file")
const editRecipeImagePreview = document.getElementById("edit-recipe-image-preview")
let editRecipeImageData = ""

function openEditRecipeModal(recipeId) {
  const recipe = (window._adminRecipes || []).find(r => r.id === recipeId)
  if (!recipe) return

  document.getElementById("edit-recipe-id").value = recipeId
  document.getElementById("edit-recipe-title").value = recipe.title || ""
  document.getElementById("edit-recipe-description").value = recipe.description || ""
  
  const ingredients = Array.isArray(recipe.ingredients) 
    ? recipe.ingredients.join("\n") 
    : recipe.ingredients || ""
  document.getElementById("edit-recipe-ingredients").value = ingredients
  
  const steps = Array.isArray(recipe.steps) 
    ? recipe.steps.join("\n") 
    : recipe.steps || ""
  document.getElementById("edit-recipe-steps").value = steps
  
  document.getElementById("edit-recipe-image-url").value = recipe.imageUrl || ""
  
  const imgSrc = recipe.imageData || recipe.image || recipe.imageUrl || ""
  if (imgSrc) {
    editRecipeImagePreview.src = imgSrc
    editRecipeImagePreview.style.display = "block"
  } else {
    editRecipeImagePreview.style.display = "none"
  }
  
  editRecipeImageData = recipe.imageData || ""
  editRecipeModal.style.display = "flex"
  document.body.style.overflow = "hidden"
}

function closeEditRecipeModal() {
  editRecipeModal.style.display = "none"
  document.body.style.overflow = ""
  editRecipeImageData = ""
  editRecipeForm.reset()
  editRecipeImagePreview.style.display = "none"
}

editRecipeClose?.addEventListener("click", closeEditRecipeModal)
editRecipeCancel?.addEventListener("click", closeEditRecipeModal)
editRecipeModal?.addEventListener("click", (e) => {
  if (e.target === editRecipeModal) closeEditRecipeModal()
})

editRecipeImageFile?.addEventListener("change", async () => {
  const file = editRecipeImageFile.files?.[0]
  if (!file) return
  try {
    editRecipeImageData = await fileToBase64Compressed(file)
    editRecipeImagePreview.src = editRecipeImageData
    editRecipeImagePreview.style.display = "block"
  } catch (error) {
    showToast("Erro", error.message || "Não foi possível processar a imagem", "error")
  }
})

editRecipeForm?.addEventListener("submit", async (e) => {
  e.preventDefault()
  
  const recipeId = document.getElementById("edit-recipe-id").value
  const title = document.getElementById("edit-recipe-title").value.trim()
  const description = document.getElementById("edit-recipe-description").value.trim()
  const ingredients = linesToArray(document.getElementById("edit-recipe-ingredients").value)
  const steps = linesToArray(document.getElementById("edit-recipe-steps").value)
  const imageUrl = document.getElementById("edit-recipe-image-url").value.trim()
  
  const saveBtn = document.getElementById("edit-recipe-save")
  saveBtn.disabled = true
  saveBtn.textContent = "A guardar..."

  try {
    const updateData = { title, description, ingredients, steps }
    
    if (editRecipeImageData) {
      updateData.imageData = editRecipeImageData
      updateData.imageUrl = ""
    } else if (imageUrl) {
      updateData.imageUrl = imageUrl
      updateData.imageData = ""
    }

    await updateDoc(doc(db, "recipes", recipeId), updateData)
    showToast("Sucesso", "Receita atualizada com sucesso", "success")
    closeEditRecipeModal()
    loadRecipesAdmin()
  } catch (error) {
    console.error("Erro ao atualizar receita:", error)
    showToast("Erro", "Não foi possível atualizar a receita", "error")
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = "Guardar Alterações"
  }
})

// ========================================
// CHARTS - Dashboard Analytics
// ========================================
let salesChart = null
let categoryChart = null

function initCharts() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not loaded")
    return
  }

  const salesCanvas = document.getElementById("sales-chart")
  const categoryCanvas = document.getElementById("category-chart")

  if (!salesCanvas || !categoryCanvas) return

  // Theme colors
  const chartColors = {
    primary: "#8b5a3c",
    accent: "#c17b3a",
    success: "#4a7c59",
    warning: "#d97706",
    light: "rgba(139, 90, 60, 0.1)",
    borders: ["#8b5a3c", "#c17b3a", "#4a7c59", "#d97706", "#6b5d4f"],
    backgrounds: [
      "rgba(139, 90, 60, 0.7)",
      "rgba(193, 123, 58, 0.7)",
      "rgba(74, 124, 89, 0.7)",
      "rgba(217, 119, 6, 0.7)",
      "rgba(107, 93, 79, 0.7)"
    ]
  }

  // Sales Line Chart
  salesChart = new Chart(salesCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Vendas (€)",
        data: [],
        borderColor: chartColors.primary,
        backgroundColor: chartColors.light,
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: chartColors.primary,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0, 0, 0, 0.05)" },
          ticks: {
            callback: (value) => `${value} €`
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  })

  // Category Doughnut Chart
  categoryChart = new Chart(categoryCanvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Pão", "Pastelaria", "Bolos", "Snacks", "Bebidas", "Outros"],
      datasets: [{
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: chartColors.backgrounds,
        borderColor: chartColors.borders,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 15,
            usePointStyle: true
          }
        }
      },
      cutout: "65%"
    }
  })
}

function updateCharts() {
  if (!salesChart || !categoryChart) return

  // Last 7 days sales data
  const now = new Date()
  const labels = []
  const salesData = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dayLabel = date.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric" })
    labels.push(dayLabel)

    const dayOrders = allOrders.filter((order) => {
      const orderDate = parseCreatedAt(order)
      return orderDate >= date && orderDate < nextDate
    })

    const dayTotal = dayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
    salesData.push(Math.round(dayTotal * 100) / 100)
  }

  salesChart.data.labels = labels
  salesChart.data.datasets[0].data = salesData
  salesChart.update()

  // Category distribution - ONLY for selected period
  const scopedOrders = getScopedOrders()
  const categoryCount = { bread: 0, pastry: 0, cake: 0, snacks: 0, drinks: 0, other: 0 }

  scopedOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const catRaw = item.category;
      const cat = (catRaw || "other").toLowerCase();
      if (categoryCount[cat] !== undefined) {
        categoryCount[cat] += item.quantity || 1;
      } else {
        categoryCount.other += item.quantity || 1;
      }
    })
  })

  // If no items have category, estimate from product names
  if (Object.values(categoryCount).every(v => v === 0)) {
    scopedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = (item.name || "").toLowerCase()
        if (name.includes("pão") || name.includes("broa") || name.includes("bola")) {
          categoryCount.bread += item.quantity || 1
        } else if (name.includes("pastel") || name.includes("croissant") || name.includes("nata")) {
          categoryCount.pastry += item.quantity || 1
        } else if (name.includes("bolo") || name.includes("tarte") || name.includes("cheesecake")) {
          categoryCount.cake += item.quantity || 1
        } else if (name.includes("snack") || name.includes("salgado") || name.includes("sandes")) {
          categoryCount.snacks += item.quantity || 1
        } else if (name.includes("sumo") || name.includes("bebida") || name.includes("limonada") || name.includes("café") || name.includes("chá")) {
          categoryCount.drinks += item.quantity || 1
        } else {
          categoryCount.other += item.quantity || 1
        }
      })
    })
  }

  const totalCategoryItems = Object.values(categoryCount).reduce((a, b) => a + b, 0)
  const categoryChartCard = document.getElementById("category-chart-card")

  // Hide chart if no data for the selected period
  if (totalCategoryItems === 0) {
    if (categoryChartCard) {
      categoryChartCard.style.display = "none"
    }
  } else {
    if (categoryChartCard) {
      categoryChartCard.style.display = "block"
    }
    categoryChart.data.datasets[0].data = [
      categoryCount.bread,
      categoryCount.pastry,
      categoryCount.cake,
      categoryCount.snacks,
      categoryCount.drinks,
      categoryCount.other
    ]
    categoryChart.update()
  }
}

// Initialize charts when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initCharts, 100)
  setupAdminTabs()
})

// Admin Tabs switching functionality
function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab')
  const tabContents = document.querySelectorAll('.admin-tab-content')
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab')
      
      // Remove active from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'))
      tabContents.forEach(c => c.classList.remove('active'))
      
      // Add active to clicked tab and corresponding content
      tab.classList.add('active')
      const targetContent = document.getElementById(`admin-tab-${targetTab}`)
      if (targetContent) {
        targetContent.classList.add('active')
      }
    })
  })
}

