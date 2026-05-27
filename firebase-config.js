import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

const firebaseConfig = {
  apiKey: "AIzaSyCJxjgzcNPVVGGAbjmM3HzYnhGsZzv9JD8",
  authDomain: "padaria-f6399.firebaseapp.com",
  databaseURL: "https://padaria-f6399-default-rtdb.firebaseio.com",
  projectId: "padaria-f6399",
  storageBucket: "padaria-f6399.firebasestorage.app",
  messagingSenderId: "174570344483",
  appId: "1:174570344483:web:f8b0d991273d2cee3be196",
  measurementId: "G-F4CFEHC9TF",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Mantém a sessão apenas durante a sessão do browser (permite navegar entre páginas)
// mas não fica "gravado" permanentemente.
export const authReady = setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error("Erro ao definir persistência de autenticação:", error)
})

export async function getUserRole(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId))
    if (userDoc.exists()) {
      return userDoc.data().role || "customer"
    }
    return "customer"
  } catch (error) {
    console.error("Error getting user role:", error)
    return "customer"
  }
}

const CART_OWNER_KEY = "cartOwnerUid"

function syncCartOwnerWithAuthUser(user) {
  try {
    const currentOwner = user?.uid || ""
    const previousOwner = sessionStorage.getItem(CART_OWNER_KEY)

    if (previousOwner === null) {
      sessionStorage.setItem(CART_OWNER_KEY, currentOwner)
      return
    }

    if (previousOwner !== currentOwner) {
      localStorage.removeItem("cart")
      updateCartCount()
    }

    sessionStorage.setItem(CART_OWNER_KEY, currentOwner)
  } catch (error) {
    console.warn("Não foi possível sincronizar dono do carrinho:", error)
  }
}

// Auth state observer
export function observeAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    syncCartOwnerWithAuthUser(user)
    callback(user)
  })
}

export { onAuthStateChanged }

// Show toast notification
export function showToast(title, message, type = "success") {
  const container = document.getElementById("toast-container")
  if (!container) return

  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.innerHTML = `
    <div class="toast-content">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
  `

  container.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease-out reverse"
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// Update cart count in header
export function updateCartCount() {
  const cartCountEl = document.getElementById("cart-count")
  if (!cartCountEl) return

  const cart = JSON.parse(localStorage.getItem("cart") || "[]")
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  cartCountEl.textContent = totalItems
}

export async function updateAuthButton(user) {
  const authBtn = document.getElementById("auth-btn")
  const adminLink = document.getElementById("admin-link")

  // Em várias páginas existem links/botões "Criar Conta" (header + footer).
  // Escondemos todos quando o utilizador está autenticado.
  const createAccountLinks = Array.from(document.querySelectorAll('a[href="auth.html"]')).filter((a) =>
    (a.textContent || "").toLowerCase().includes("criar conta"),
  )

  // Algumas páginas podem não ter o botão de autenticação (ou podem ter um layout diferente).
  // Nesses casos, tratamos pelo menos do "Criar Conta" e do link de Admin.

  if (user) {
    if (authBtn) authBtn.textContent = "Sair"

    // Esconde "Criar Conta"
    createAccountLinks.forEach((a) => (a.style.display = "none"))

    // Mostra Admin se for admin/staff
    const role = await getUserRole(user.uid)
    if (adminLink && (role === "admin" || role === "staff")) {
      adminLink.style.display = "inline-block"
    } else if (adminLink) {
      adminLink.style.display = "none"
    }

    if (authBtn) {
      authBtn.onclick = async () => {
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
        await signOut(auth)
        showToast("Sessão terminada", "Até breve!", "success")
        if (window.location.pathname.includes("orders") || window.location.pathname.includes("admin")) {
          window.location.href = "index.html"
        }
      }
    }
  } else {
    if (authBtn) authBtn.textContent = "Entrar"

    // Mostra "Criar Conta"
    createAccountLinks.forEach((a) => (a.style.display = "inline-block"))

    if (adminLink) adminLink.style.display = "none"

    if (authBtn) {
      authBtn.onclick = () => (window.location.href = "auth.html")
    }
  }
}

// Initialize common header functionality
if (document.getElementById("cart-btn")) {
  document.getElementById("cart-btn").onclick = () => (window.location.href = "cart.html")
  updateCartCount()
}

observeAuthState(updateAuthButton)
