import { db, showToast } from "./firebase-config.js"
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"


const loadingEl = document.getElementById("loading")
const gridEl = document.getElementById("recipes-grid")
const emptyEl = document.getElementById("empty-state")

const modalOverlay = document.getElementById("recipe-modal")
const modalCloseBtn = document.getElementById("recipe-modal-close")
const modalImage = document.getElementById("recipe-modal-image")
const modalTitle = document.getElementById("recipe-modal-title")
const modalDescription = document.getElementById("recipe-modal-description")
const modalIngredients = document.getElementById("recipe-modal-ingredients")
const modalSteps = document.getElementById("recipe-modal-steps")

import { auth, observeAuthState } from "./firebase-config.js"
let isAuthenticated = false
observeAuthState((user) => {
  isAuthenticated = !!user
})

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Popup para login obrigatório
let loginPopup = null
function showLoginPopup() {
  if (!loginPopup) {
    const isDarkMode = document.documentElement.classList.contains('dark-mode')
    const popupBg = isDarkMode ? '#2a2420' : '#fff8f0'
    const popupText = isDarkMode ? '#f5f1ed' : '#222'
    const popupMutedText = isDarkMode ? '#ccc5bd' : '#555'
    const popupAccent = isDarkMode ? '#e89c50' : '#b77b4b'

    loginPopup = document.createElement('div')
    loginPopup.className = 'login-popup-overlay'

    const panel = document.createElement('div')
    panel.className = 'login-popup-panel'
    panel.style.setProperty('--login-popup-bg', popupBg)
    panel.style.setProperty('--login-popup-text', popupText)
    panel.style.setProperty('--login-popup-muted', popupMutedText)
    panel.style.setProperty('--login-popup-accent', popupAccent)
    panel.innerHTML = `
      <h3 class="login-popup-accent">Faça login para ver a receita completa</h3>
      <p class="login-popup-muted">Crie uma conta ou entre para ver ingredientes e modo de preparo.</p>
      <a href="auth.html" class="btn-primary">Fazer Login</a><br>
      <button id="close-login-popup" class="login-popup-close">Fechar</button>
    `

    loginPopup.appendChild(panel)
    document.body.appendChild(loginPopup)
    document.body.style.overflow = 'hidden'
    document.getElementById('close-login-popup').onclick = closeLoginPopup
    loginPopup.onclick = function(e) {
      if (e.target === loginPopup) closeLoginPopup()
    }
    document.addEventListener('keydown', escLoginPopup)
  }
}
function closeLoginPopup() {
  if (loginPopup) {
    loginPopup.remove()
    loginPopup = null
    document.body.style.overflow = ''
    document.removeEventListener('keydown', escLoginPopup)
  }
}
function escLoginPopup(e) {
  if (e.key === 'Escape') closeLoginPopup()
}

function normaliseLines(value) {
  return (value || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

function getRecipeImage(recipe) {
  return recipe.imageData || recipe.imageUrl || recipe.image || ""
}



function openModal(recipe) {
  if (!isAuthenticated) {
    showLoginPopup()
    return
  }
  const img = getRecipeImage(recipe)
  if (img) {
    modalImage.src = img
      modalImage.classList.remove('hidden')
    modalImage.alt = recipe.title || "Receita"
  } else {
    modalImage.removeAttribute("src")
      modalImage.classList.add('hidden')
    modalImage.alt = ""
  }

  modalTitle.textContent = recipe.title || "Receita"
  modalDescription.textContent = recipe.description || ""

  modalIngredients.innerHTML = ""
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : normaliseLines(recipe.ingredients)
  ingredients.forEach((i) => {
    const li = document.createElement("li")
    li.textContent = i
    modalIngredients.appendChild(li)
  })

  modalSteps.innerHTML = ""
  const steps = Array.isArray(recipe.steps) ? recipe.steps : normaliseLines(recipe.steps)
  steps.forEach((s) => {
    const li = document.createElement("li")
    li.textContent = s
    modalSteps.appendChild(li)
  })

  modalOverlay.classList.remove('hidden')
  modalOverlay.setAttribute("aria-hidden", "false")
  document.body.style.overflow = "hidden"
}

function closeModal() {
  modalOverlay.classList.add('hidden')
  modalOverlay.setAttribute("aria-hidden", "true")
  document.body.style.overflow = ""
}

modalCloseBtn?.addEventListener("click", closeModal)
modalOverlay?.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal()
})
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay && !modalOverlay.classList.contains('hidden')) closeModal()
})

async function loadRecipes() {
  try {
    const q = query(collection(db, "recipes"), orderBy("createdAt", "desc"))
    const snap = await getDocs(q)
    const recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    loadingEl.style.display = "none"

    if (!recipes.length) {
      emptyEl.classList.remove('hidden')
      gridEl.classList.add('hidden')
      return
    }

    emptyEl.classList.add('hidden')
    gridEl.classList.remove('hidden')

    gridEl.innerHTML = recipes
      .map((r) => {
        const img = getRecipeImage(r)
        const safeDesc = escapeHtml(r.description || "")
        const safeTitle = escapeHtml(r.title || "Receita")
        const safeId = escapeHtml(r.id)
        const safeImg = escapeHtml(img || "")
        return `
          <div class="product-card recipe-card" data-id="${safeId}">
            <img class="product-image" src="${safeImg}" alt="${safeTitle}" />
            <div class="product-content">
              <span class="product-category">Receita</span>
              <h3 class="product-name">${safeTitle}</h3>
              <p class="product-description">${safeDesc}</p>
              <div class="recipe-footer">
                <span class="recipe-cta">Ver receita</span>
              </div>
            </div>
          </div>
        `
      })
      .join("")

      // Attach image error handlers (remove broken images)
      gridEl.querySelectorAll('.product-image').forEach(img => {
        img.addEventListener('error', () => img.classList.add('hidden'))
      })
    // click handlers
    gridEl.querySelectorAll(".recipe-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id")
        const recipe = recipes.find((x) => x.id === id)
        if (recipe) openModal(recipe)
      })
    })
  } catch (error) {
    console.error("Erro ao carregar receitas:", error)
    loadingEl.style.display = "none"
    emptyEl.style.display = "block"
    emptyEl.innerHTML = "<p>Erro ao carregar receitas.</p>"
    showToast("Erro", "Não foi possível carregar as receitas", "error")
  }
}

loadRecipes()
