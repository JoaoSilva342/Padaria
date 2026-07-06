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
    loginPopup.style.position = 'fixed'
    loginPopup.style.top = '0'
    loginPopup.style.left = '0'
    loginPopup.style.width = '100vw'
    loginPopup.style.height = '100vh'
    loginPopup.style.background = 'rgba(0,0,0,0.5)'
    loginPopup.style.display = 'flex'
    loginPopup.style.alignItems = 'center'
    loginPopup.style.justifyContent = 'center'
    loginPopup.style.zIndex = '9999'
    loginPopup.innerHTML = `
      <div style="background:${popupBg};color:${popupText};padding:2rem 2.5rem;border-radius:16px;box-shadow:0 2px 16px #0002;text-align:center;max-width:90vw;border:1px solid rgba(139,90,60,0.18);">
        <h3 style="color:${popupAccent};font-size:1.3rem;margin-bottom:1rem;">Faça login para ver a receita completa</h3>
        <p style="margin-bottom:1.5rem;color:${popupMutedText};">Crie uma conta ou entre para ver ingredientes e modo de preparo.</p>
        <a href="auth.html" class="btn-primary" style="padding:0.7em 2em;color:#fff;">Fazer Login</a><br>
        <button id="close-login-popup" style="margin-top:1.5rem;background:none;border:none;color:${popupAccent};font-size:1.1rem;cursor:pointer;">Fechar</button>
      </div>
    `
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
    modalImage.style.display = "block"
    modalImage.alt = recipe.title || "Receita"
  } else {
    modalImage.removeAttribute("src")
    modalImage.style.display = "none"
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

  modalOverlay.style.display = "flex"
  modalOverlay.setAttribute("aria-hidden", "false")
  document.body.style.overflow = "hidden"
}

function closeModal() {
  modalOverlay.style.display = "none"
  modalOverlay.setAttribute("aria-hidden", "true")
  document.body.style.overflow = ""
}

modalCloseBtn?.addEventListener("click", closeModal)
modalOverlay?.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal()
})
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay?.style.display === "flex") closeModal()
})

async function loadRecipes() {
  try {
    const q = query(collection(db, "recipes"), orderBy("createdAt", "desc"))
    const snap = await getDocs(q)
    const recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    loadingEl.style.display = "none"

    if (!recipes.length) {
      emptyEl.style.display = "block"
      gridEl.style.display = "none"
      return
    }

    emptyEl.style.display = "none"
    gridEl.style.display = "grid"

    gridEl.innerHTML = recipes
      .map((r) => {
        const img = getRecipeImage(r)
        const safeDesc = (r.description || "").replace(/</g, "&lt;")
        const safeTitle = (r.title || "Receita").replace(/</g, "&lt;")
        return `
          <div class="product-card recipe-card" data-id="${r.id}">
            <img class="product-image" src="${img || ""}" alt="${safeTitle}" onerror="this.style.display='none'" />
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
