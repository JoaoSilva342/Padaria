import { showToast, updateCartCount, auth } from "./firebase-config.js"

const MAX_LAYERS = 30
const MAX_VISUAL_INGREDIENTS = 6

// Real cake images by base type (Unsplash - hotlink allowed)
const cakeBaseImages = {
  vanilla: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop",
  chocolate: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=400&h=400&fit=crop",
  red_velvet: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=400&h=400&fit=crop",
  carrot: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4p6mcKQDW2z2cH7xBpAouCfPt96X6nSUVrBL3FR6y3QMaywVIKrBy1blIsguc0GDJGPLBQRiU-JCq9aCAe4G9SoQKecwgnAYkeVif-7OEmQ&s=10",
  lemon: "https://images.unsplash.com/photo-1635712506253-13f4b902f0f0?w=400&h=400&fit=crop",
  almond: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=400&h=400&fit=crop",
  orange: "https://images.unsplash.com/photo-1557925923-cd4648e211a0?w=400&h=400&fit=crop"
}

// Real ingredient overlay images (transparent or composable)
const ingredientOverlays = {
  // Fillings - small images that appear on the side
  strawberry: { img: "https://images.pexels.com/photos/46174/strawberries-berries-fruit-freshness-46174.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Morango" },
  choco_cream: { img: "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Chocolate" },
  dulce: { img: "https://images.pexels.com/photos/4109998/pexels-photo-4109998.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Doce de Leite" },
  pastry_cream: { img: "https://images.pexels.com/photos/4553031/pexels-photo-4553031.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Creme" },
  berries: { img: "https://images.pexels.com/photos/1253041/pexels-photo-1253041.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Frutos Vermelhos" },
  oreo: { img: "https://images.pexels.com/photos/6509051/pexels-photo-6509051.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Oreo" },
  cream_cheese: { img: "https://images.pexels.com/photos/4198020/pexels-photo-4198020.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Cream Cheese" },
  nutella: { img: "https://images.pexels.com/photos/4110003/pexels-photo-4110003.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Nutella" },
  passion_fruit: { img: "https://images.pexels.com/photos/2907428/pexels-photo-2907428.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Maracujá" },
  lemon_curd: { img: "https://images.pexels.com/photos/1414110/pexels-photo-1414110.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Limão" },
  caramel: { img: "https://images.pexels.com/photos/4198019/pexels-photo-4198019.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Caramelo" },
  mango: { img: "https://images.pexels.com/photos/918643/pexels-photo-918643.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Manga" },
  banana: { img: "https://images.pexels.com/photos/2116020/pexels-photo-2116020.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Banana" },
  raspberry: { img: "https://images.pexels.com/photos/52536/raspberry-berry-fruit-berry-fruit-red-52536.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Framboesa" },
  peanut_butter: { img: "https://images.pexels.com/photos/5591589/pexels-photo-5591589.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Amendoim" },
  kinder: { img: "https://images.pexels.com/photos/4110003/pexels-photo-4110003.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Kinder" },
  coconut_cream: { img: "https://images.pexels.com/photos/557814/pexels-photo-557814.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Côco" },
  pistachio_cream: { img: "https://images.pexels.com/photos/4110541/pexels-photo-4110541.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Pistácio" },
  
  // Toppings
  ganache: { img: "https://images.pexels.com/photos/4109998/pexels-photo-4109998.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Ganache", type: "frosting" },
  fresh_fruit: { img: "https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Frutas", type: "topping" },
  chantilly: { img: "https://images.pexels.com/photos/4553031/pexels-photo-4553031.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Chantilly", type: "frosting" },
  crunch: { img: "https://images.pexels.com/photos/1295572/pexels-photo-1295572.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Crocante", type: "topping" },
  sugar_flowers: { img: "https://images.pexels.com/photos/1070850/pexels-photo-1070850.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Flores", type: "topping" },
  topper: { img: "https://images.pexels.com/photos/1729797/pexels-photo-1729797.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Topper", type: "topping" },
  drip: { img: "https://images.pexels.com/photos/4109998/pexels-photo-4109998.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Drip", type: "frosting" },
  macarons: { img: "https://images.pexels.com/photos/3776950/pexels-photo-3776950.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Macarons", type: "topping" },
  chocolate_shards: { img: "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Chocolate", type: "topping" },
  meringue: { img: "https://images.pexels.com/photos/4553031/pexels-photo-4553031.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Suspiros", type: "topping" },
  edible_gold: { img: "https://images.pexels.com/photos/4553184/pexels-photo-4553184.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Ouro", type: "topping" },
  sprinkles: { img: "https://images.pexels.com/photos/4686960/pexels-photo-4686960.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Confetis", type: "topping" },
  fondant: { img: "https://images.pexels.com/photos/1070850/pexels-photo-1070850.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Fondant", type: "frosting" },
  fresh_flowers: { img: "https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Flores", type: "topping" },
  chocolate_balls: { img: "https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Bolas", type: "topping" },
  oreo_crumbs: { img: "https://images.pexels.com/photos/6509051/pexels-photo-6509051.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Oreo", type: "topping" },
  caramel_drizzle: { img: "https://images.pexels.com/photos/4198019/pexels-photo-4198019.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Caramelo", type: "topping" },
  nuts: { img: "https://images.pexels.com/photos/1295572/pexels-photo-1295572.jpeg?auto=compress&cs=tinysrgb&w=80", label: "Frutos Secos", type: "topping" }
}

const customCakeOptions = {
  bases: [
    { value: "vanilla", label: "Baunilha", pricePerKg: 16 },
    { value: "chocolate", label: "Chocolate", pricePerKg: 17.5 },
    { value: "red_velvet", label: "Red Velvet", pricePerKg: 18.5 },
    { value: "carrot", label: "Cenoura", pricePerKg: 15.5 },
    { value: "lemon", label: "Limão", pricePerKg: 16.5 },
    { value: "almond", label: "Amêndoa", pricePerKg: 18 },
    { value: "orange", label: "Laranja", pricePerKg: 16.5 },
  ],
  shapes: [
    { value: "round", label: "Redondo", addFixed: 0 },
    { value: "square", label: "Quadrado", addFixed: 1.5 },
    { value: "heart", label: "Coração", addFixed: 2.5 },
    { value: "number", label: "Número", addFixed: 3.5 },
    { value: "rectangle", label: "Retangular", addFixed: 2 },
    { value: "star", label: "Estrela", addFixed: 4 },
    { value: "hexagon", label: "Hexágono", addFixed: 3 },
  ],
  fillings: [
    { value: "strawberry", label: "Morango", addPerKg: 1.8 },
    { value: "choco_cream", label: "Creme de Chocolate", addPerKg: 2.2 },
    { value: "dulce", label: "Doce de Leite", addPerKg: 2 },
    { value: "pastry_cream", label: "Creme Pasteleiro", addPerKg: 1.5 },
    { value: "berries", label: "Frutos Vermelhos", addPerKg: 2.5 },
    { value: "oreo", label: "Oreo", addPerKg: 2.2 },
    { value: "cream_cheese", label: "Creme de Queijo", addPerKg: 2.6 },
    { value: "nutella", label: "Nutella", addPerKg: 2.8 },
    { value: "passion_fruit", label: "Maracujá", addPerKg: 2.3 },
    { value: "lemon_curd", label: "Curd de Limão", addPerKg: 2.4 },
    { value: "caramel", label: "Caramelo Salgado", addPerKg: 2.5 },
    { value: "mango", label: "Manga", addPerKg: 2.4 },
    { value: "banana", label: "Banana", addPerKg: 1.8 },
    { value: "raspberry", label: "Framboesa", addPerKg: 2.7 },
    { value: "peanut_butter", label: "Manteiga de Amendoim", addPerKg: 2.5 },
    { value: "kinder", label: "Kinder", addPerKg: 3 },
    { value: "coconut_cream", label: "Creme de Côco", addPerKg: 2.3 },
    { value: "pistachio_cream", label: "Creme de Pistácio", addPerKg: 3.2 },
  ],
  toppings: [
    { value: "ganache", label: "Ganache", addFixed: 2.5 },
    { value: "fresh_fruit", label: "Fruta Fresca", addFixed: 3 },
    { value: "chantilly", label: "Chantilly", addFixed: 2 },
    { value: "crunch", label: "Crocante", addFixed: 1.5 },
    { value: "sugar_flowers", label: "Flores de Açúcar", addFixed: 3.5 },
    { value: "topper", label: "Cake Topper Personalizado", addFixed: 4 },
    { value: "drip", label: "Drip Cake", addFixed: 2 },
    { value: "macarons", label: "Macarons", addFixed: 3.5 },
    { value: "chocolate_shards", label: "Lascas de Chocolate", addFixed: 2.5 },
    { value: "meringue", label: "Suspiros", addFixed: 2 },
    { value: "edible_gold", label: "Folha de Ouro Comestível", addFixed: 6 },
    { value: "sprinkles", label: "Confetis Coloridos", addFixed: 1.5 },
    { value: "fondant", label: "Pasta de Açúcar", addFixed: 4.5 },
    { value: "fresh_flowers", label: "Flores Naturais", addFixed: 5 },
    { value: "chocolate_balls", label: "Bolas de Chocolate", addFixed: 2.5 },
    { value: "oreo_crumbs", label: "Migalhas de Oreo", addFixed: 2 },
    { value: "caramel_drizzle", label: "Fio de Caramelo", addFixed: 2 },
    { value: "nuts", label: "Frutos Secos", addFixed: 3 },
  ],
}

let lastValidLayers = 3

function formatPrice(value) {
  return `${Number(value).toFixed(2)} €`
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function parseLayers(rawValue) {
  const digits = String(rawValue ?? "").replace(/[^\d]/g, "")
  if (!digits) return null
  const n = Number(digits)
  if (!Number.isFinite(n)) return null
  return Math.min(MAX_LAYERS, Math.max(1, Math.floor(n)))
}

function getCheckedValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter((el) => el.checked)
    .map((el) => el.value)
}

function getSelection() {
  const layerInputValue = document.getElementById("custom-cake-layers")?.value || ""
  const parsedLayers = parseLayers(layerInputValue)
  const layers = parsedLayers ?? lastValidLayers

  return {
    weight: Number(document.getElementById("custom-cake-weight")?.value || 1),
    layers,
    base: document.getElementById("custom-cake-base")?.value || customCakeOptions.bases[0].value,
    shape: document.getElementById("custom-cake-shape")?.value || customCakeOptions.shapes[0].value,
    fillings: getCheckedValues(".custom-cake-filling"),
    toppings: getCheckedValues(".custom-cake-topping"),
    message: (document.getElementById("custom-cake-message")?.value || "").trim(),
    notes: (document.getElementById("custom-cake-notes")?.value || "").trim(),
  }
}

function calculatePricing(selection) {
  const baseOption = customCakeOptions.bases.find((b) => b.value === selection.base) || customCakeOptions.bases[0]
  const shapeOption = customCakeOptions.shapes.find((s) => s.value === selection.shape) || customCakeOptions.shapes[0]

  const baseTotal = selection.weight * baseOption.pricePerKg
  const fillingsPerKg = selection.fillings.reduce((sum, value) => {
    const opt = customCakeOptions.fillings.find((f) => f.value === value)
    return sum + (opt?.addPerKg || 0)
  }, 0)
  const fillingsTotal = selection.weight * fillingsPerKg

  const toppingsTotal = selection.toppings.reduce((sum, value) => {
    const opt = customCakeOptions.toppings.find((t) => t.value === value)
    return sum + (opt?.addFixed || 0)
  }, 0)

  const layersTotal = selection.layers * 2.5
  const shapeTotal = shapeOption.addFixed
  const messageTotal = selection.message ? 1.5 : 0

  const total = Math.round((baseTotal + fillingsTotal + toppingsTotal + layersTotal + shapeTotal + messageTotal) * 100) / 100

  return { baseTotal, fillingsTotal, toppingsTotal, layersTotal, shapeTotal, messageTotal, total }
}

// Get visual layers for realistic cake preview
function getCakeVisualLayers(selection) {
  const layers = {
    baseImg: cakeBaseImages[selection.base] || cakeBaseImages.vanilla,
    baseLabel: customCakeOptions.bases.find(b => b.value === selection.base)?.label || 'Baunilha',
    fillings: [],
    toppings: []
  }
  
  // Get fillings (max 4 visual thumbnails)
  selection.fillings.forEach(fillVal => {
    if (ingredientOverlays[fillVal] && layers.fillings.length < 4) {
      layers.fillings.push({
        value: fillVal,
        ...ingredientOverlays[fillVal]
      })
    }
  })
  
  // Get toppings (max 4 visual thumbnails)
  selection.toppings.forEach(topVal => {
    if (ingredientOverlays[topVal] && layers.toppings.length < 4) {
      layers.toppings.push({
        value: topVal,
        ...ingredientOverlays[topVal]
      })
    }
  })
  
  // Count hidden ingredients
  const totalSelected = selection.fillings.length + selection.toppings.length
  const totalVisible = layers.fillings.length + layers.toppings.length
  const hiddenCount = Math.max(0, totalSelected - totalVisible)
  
  return { layers, hiddenCount, totalSelected }
}

// Render realistic cake preview (only cake image, no ingredient thumbnails)
function renderVisualPreview(selection) {
  const previewStack = document.getElementById("cake-preview-stack")
  const previewInfo = document.getElementById("cake-preview-info")
  
  if (!previewStack) return
  
  const { layers } = getCakeVisualLayers(selection)
  const numLayers = Math.min(selection.layers || 1, 3)
  
  // Build layers indicator
  let layersIndicator = ''
  if (numLayers > 1) {
    layersIndicator = `<div class="layers-badge">${numLayers} camadas</div>`
  }
  
  // Count selected extras
  const fillingsCount = selection.fillings.length
  const toppingsCount = selection.toppings.length
  
  previewStack.innerHTML = `
    <div class="realistic-cake-preview">
      <div class="cake-image-container">
        <img 
          src="${escapeHtml(layers.baseImg)}" 
          alt="Bolo de ${escapeHtml(layers.baseLabel)}" 
          class="cake-main-image"
          loading="lazy"
        >
        ${layersIndicator}
        <div class="cake-label">${escapeHtml(layers.baseLabel)}</div>
      </div>
    </div>
  `
  
  // Show count info
  const parts = []
  if (fillingsCount > 0) parts.push(`${fillingsCount} recheio${fillingsCount > 1 ? 's' : ''}`)
  if (toppingsCount > 0) parts.push(`${toppingsCount} cobertura${toppingsCount > 1 ? 's' : ''}`)
  
  if (parts.length > 0) {
    previewInfo.innerHTML = `<small>${escapeHtml(parts.join(' • '))}</small>`
  } else {
    previewInfo.innerHTML = `<small>${escapeHtml('Personaliza o teu bolo')}</small>`
  }
}

function renderOptions() {
  const baseSelect = document.getElementById("custom-cake-base")
  const shapeSelect = document.getElementById("custom-cake-shape")
  const fillingsEl = document.getElementById("custom-fillings")
  const toppingsEl = document.getElementById("custom-toppings")

  baseSelect.innerHTML = customCakeOptions.bases
    .map((base) => `<option value="${escapeHtml(base.value)}">${escapeHtml(base.label)} (${formatPrice(base.pricePerKg)}/kg)</option>`)
    .join("")

  shapeSelect.innerHTML = customCakeOptions.shapes
    .map((shape) => `<option value="${escapeHtml(shape.value)}">${escapeHtml(shape.label)} ${shape.addFixed ? `( +${formatPrice(shape.addFixed)} )` : "(incluído)"}</option>`)
    .join("")

  fillingsEl.innerHTML = customCakeOptions.fillings
    .map(
      (item) => `
      <label class="custom-check">
        <input type="checkbox" class="custom-cake-filling" value="${escapeHtml(item.value)}">
        <span>${escapeHtml(item.label)}</span>
        <small>+${formatPrice(item.addPerKg)}/kg</small>
      </label>
    `,
    )
    .join("")

  // Add limit enforcement for fillings (max 3)
  fillingsEl.querySelectorAll('.custom-cake-filling').forEach(checkbox => {
    checkbox.addEventListener('change', () => enforceCheckboxLimit('.custom-cake-filling', 3))
  })

  toppingsEl.innerHTML = customCakeOptions.toppings
    .map(
      (item) => `
      <label class="custom-check">
        <input type="checkbox" class="custom-cake-topping" value="${escapeHtml(item.value)}">
        <span>${escapeHtml(item.label)}</span>
        <small>+${formatPrice(item.addFixed)}</small>
      </label>
    `,
    )
    .join("")
  
  // Add limit enforcement for toppings (max 3)
  toppingsEl.querySelectorAll('.custom-cake-topping').forEach(checkbox => {
    checkbox.addEventListener('change', () => enforceCheckboxLimit('.custom-cake-topping', 3))
  })
}

// Enforce maximum number of checkboxes selected
function enforceCheckboxLimit(selector, maxCount) {
  const checkboxes = document.querySelectorAll(selector)
  const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked)
  
  if (checkedBoxes.length >= maxCount) {
    // Disable unchecked checkboxes
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        cb.disabled = true
        cb.closest('.custom-check')?.classList.add('disabled')
      }
    })
  } else {
    // Re-enable all checkboxes
    checkboxes.forEach(cb => {
      cb.disabled = false
      cb.closest('.custom-check')?.classList.remove('disabled')
    })
  }
}

function updateSummary() {
  const selection = getSelection()
  const pricing = calculatePricing(selection)
  const summaryEl = document.getElementById("custom-cake-summary-lines")
  const priceEl = document.getElementById("custom-cake-price")
  const layersInput = document.getElementById("custom-cake-layers")
  if (layersInput) {
    const parsedLayers = parseLayers(layersInput.value)
    if (parsedLayers !== null) {
      lastValidLayers = parsedLayers
    }
  }

  const baseLabel = customCakeOptions.bases.find((b) => b.value === selection.base)?.label || "-"
  const shapeLabel = customCakeOptions.shapes.find((s) => s.value === selection.shape)?.label || "-"
  const fillingsLabels = selection.fillings
    .map((v) => customCakeOptions.fillings.find((f) => f.value === v)?.label)
    .filter(Boolean)
  const toppingsLabels = selection.toppings
    .map((v) => customCakeOptions.toppings.find((t) => t.value === v)?.label)
    .filter(Boolean)

  summaryEl.innerHTML = `
    <div class="summary-row-item"><span>Massa</span><strong>${escapeHtml(baseLabel)}</strong></div>
    <div class="summary-row-item"><span>Peso</span><strong>${escapeHtml(selection.weight.toFixed(1) + ' kg')}</strong></div>
    <div class="summary-row-item"><span>Camadas</span><strong>${escapeHtml(String(selection.layers))}</strong></div>
    <div class="summary-row-item"><span>Formato</span><strong>${escapeHtml(shapeLabel)}</strong></div>
    <div class="summary-row-item"><span>Recheios</span><strong>${escapeHtml(fillingsLabels.length ? fillingsLabels.join(", ") : "Nenhum extra")}</strong></div>
    <div class="summary-row-item"><span>Coberturas</span><strong>${escapeHtml(toppingsLabels.length ? toppingsLabels.join(", ") : "Nenhuma extra")}</strong></div>
    <div class="summary-divider"></div>
    <div class="summary-row-item"><span>Base</span><strong>${formatPrice(pricing.baseTotal)}</strong></div>
    <div class="summary-row-item"><span>Recheios</span><strong>${formatPrice(pricing.fillingsTotal)}</strong></div>
    <div class="summary-row-item"><span>Coberturas</span><strong>${formatPrice(pricing.toppingsTotal)}</strong></div>
    <div class="summary-row-item"><span>Camadas</span><strong>${formatPrice(pricing.layersTotal)}</strong></div>
    <div class="summary-row-item"><span>Formato</span><strong>${formatPrice(pricing.shapeTotal)}</strong></div>
    <div class="summary-row-item"><span>Mensagem</span><strong>${formatPrice(pricing.messageTotal)}</strong></div>
  `
  priceEl.textContent = formatPrice(pricing.total)
  
  // Update visual preview
  renderVisualPreview(selection)
}

function addCustomCakeToCart() {
  const selection = getSelection()
  const pricing = calculatePricing(selection)
  const baseLabel = customCakeOptions.bases.find((b) => b.value === selection.base)?.label || "Massa personalizada"
  const shapeLabel = customCakeOptions.shapes.find((s) => s.value === selection.shape)?.label || "Formato padrão"
  const fillingLabels = selection.fillings
    .map((v) => customCakeOptions.fillings.find((f) => f.value === v)?.label)
    .filter(Boolean)
  const toppingLabels = selection.toppings
    .map((v) => customCakeOptions.toppings.find((t) => t.value === v)?.label)
    .filter(Boolean)

  const description = [
    `Massa: ${baseLabel}`,
    `Peso: ${selection.weight.toFixed(1)}kg`,
    `Camadas: ${selection.layers}`,
    `Formato: ${shapeLabel}`,
    `Recheios: ${fillingLabels.length ? fillingLabels.join(", ") : "Sem recheio extra"}`,
    `Coberturas: ${toppingLabels.length ? toppingLabels.join(", ") : "Sem cobertura extra"}`,
    selection.message ? `Mensagem: "${selection.message}"` : "",
    selection.notes ? `Observações: ${selection.notes}` : "",
  ]
    .filter(Boolean)
    .join(" | ")

  const product = {
    id: `custom-cake-${Date.now()}`,
    name: `Bolo personalizado (${selection.weight.toFixed(1)}kg)`,
    description,
    price: pricing.total,
    category: "cake",
    image: "/placeholder.svg?height=250&width=280&query=" + encodeURIComponent("bolo personalizado"),
    available: true,
    isCustomCake: true,
  }

  // Bloquear se não estiver logado
  const user = auth.currentUser
  if (!user) {
    showToast("Login obrigatório", "É necessário estar logado para adicionar produtos ao carrinho.", "error")
    return
  }
  const cart = JSON.parse(localStorage.getItem("cart") || "[]")
  cart.push({ product, quantity: 1 })
  localStorage.setItem("cart", JSON.stringify(cart))
  updateCartCount()
  showToast("Adicionado ao carrinho", "Bolo personalizado adicionado com sucesso", "success")
}

// Tab switching functionality
function setupTabs() {
  const tabs = document.querySelectorAll('.cake-tab')
  const tabContents = document.querySelectorAll('.cake-tab-content')
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab')
      
      // Remove active from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'))
      tabContents.forEach(c => c.classList.remove('active'))
      
      // Add active to clicked tab and corresponding content
      tab.classList.add('active')
      document.getElementById(`tab-${targetTab}`)?.classList.add('active')
    })
  })
}

function init() {
  renderOptions()
  updateSummary()
  setupTabs()

  const reactiveSelectors = [
    "#custom-cake-base",
    "#custom-cake-weight",
    "#custom-cake-layers",
    "#custom-cake-shape",
    "#custom-cake-message",
    "#custom-cake-notes",
  ]
  reactiveSelectors.forEach((selector) => {
    document.querySelector(selector)?.addEventListener("input", updateSummary)
    document.querySelector(selector)?.addEventListener("change", updateSummary)
  })

  const layersInput = document.getElementById("custom-cake-layers")
  const layersDecBtn = document.getElementById("custom-cake-layers-dec")
  const layersIncBtn = document.getElementById("custom-cake-layers-inc")

  layersInput?.addEventListener("blur", () => {
    const parsed = parseLayers(layersInput.value)
    if (parsed === null) {
      layersInput.value = String(lastValidLayers)
    } else {
      lastValidLayers = parsed
      layersInput.value = String(parsed)
    }
    updateSummary()
  })

  layersDecBtn?.addEventListener("click", () => {
    const parsed = parseLayers(layersInput?.value)
    const current = parsed ?? lastValidLayers
    const next = Math.max(1, current - 1)
    lastValidLayers = next
    if (layersInput) layersInput.value = String(next)
    updateSummary()
  })

  layersIncBtn?.addEventListener("click", () => {
    const parsed = parseLayers(layersInput?.value)
    const current = parsed ?? lastValidLayers
    const next = Math.min(MAX_LAYERS, current + 1)
    lastValidLayers = next
    if (layersInput) layersInput.value = String(next)
    updateSummary()
  })

  document.querySelectorAll(".custom-cake-filling, .custom-cake-topping").forEach((el) => {
    el.addEventListener("change", updateSummary)
  })

  document.getElementById("custom-cake-add-btn").addEventListener("click", addCustomCakeToCart)
}

init()
