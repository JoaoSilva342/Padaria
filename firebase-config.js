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
  const content = document.createElement('div')
  content.className = 'toast-content'
  const h4 = document.createElement('h4')
  h4.textContent = title
  const p = document.createElement('p')
  p.textContent = message
  content.appendChild(h4)
  content.appendChild(p)
  toast.appendChild(content)

  container.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease-out reverse"
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// Show a reusable login-required popup (used to block navigation to restricted pages)
export function showAuthRequiredPopup(message = null) {
  const isDarkMode = document.documentElement.classList.contains('dark-mode')
  const popupBg = isDarkMode ? '#2a2420' : '#fff8f0'
  const popupText = isDarkMode ? '#f5f1ed' : '#222'
  const popupMutedText = isDarkMode ? '#ccc5bd' : '#555'
  const popupAccent = isDarkMode ? '#e89c50' : '#b77b4b'

  // avoid multiple popups
  if (document.getElementById('auth-required-popup')) return

  const popup = document.createElement('div')
  popup.id = 'auth-required-popup'
  popup.style.position = 'fixed'
  popup.style.top = '0'
  popup.style.left = '0'
  popup.style.width = '100vw'
  popup.style.height = '100vh'
  popup.style.background = 'rgba(0,0,0,0.5)'
  popup.style.display = 'flex'
  popup.style.alignItems = 'center'
  popup.style.justifyContent = 'center'
  popup.style.zIndex = '9999'
  popup.innerHTML = `
    <div style="background:${popupBg};color:${popupText};padding:2rem 2.5rem;border-radius:16px;box-shadow:0 2px 16px #0002;text-align:center;max-width:90vw;border:1px solid rgba(139,90,60,0.18);">
      <h3 style="color:${popupAccent};font-size:1.3rem;margin-bottom:1rem;">${message || 'Faça login para continuar'}</h3>
      <p style="margin-bottom:1.5rem;color:${popupMutedText};">Crie uma conta ou entre para aceder a esta funcionalidade.</p>
      <a href="auth.html" class="btn-primary" style="padding:0.7em 2em;color:#fff;">Fazer Login</a><br>
      <button id="close-auth-required-popup" style="margin-top:1.5rem;background:none;border:none;color:${popupAccent};font-size:1.1rem;cursor:pointer;">Fechar</button>
    </div>
  `
  document.body.appendChild(popup)
  document.body.style.overflow = 'hidden'

  function close() {
    popup.remove()
    document.body.style.overflow = ''
    document.removeEventListener('keydown', esc)
  }
  function esc(e) { if (e.key === 'Escape') close() }
  document.getElementById('close-auth-required-popup').onclick = close
  popup.onclick = function(e) { if (e.target === popup) close() }
  document.addEventListener('keydown', esc)
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

// Delegated click handler: block navigation when clicking any element that
// targets the custom cake page. This works for anchors generated dynamically.
document.addEventListener('click', (e) => {
  try {
    const el = e.target.closest('a[href="bolo-personalizado.html"], .custom-cake-option-btn')
    if (!el) return
    const user = auth.currentUser
    if (!user) {
      e.preventDefault()
      showAuthRequiredPopup('É necessário iniciar sessão para personalizar bolos')
    }
  } catch (err) {
    // Non-fatal
  }
}, true)
