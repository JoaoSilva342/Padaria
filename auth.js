import { auth, showToast, db, authReady } from "./firebase-config.js"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

const registerPhoneInput = document.getElementById("register-phone")

function normalizePhone(value) {
  return (value || "").replace(/\D/g, "").slice(0, 9)
}

if (registerPhoneInput) {
  registerPhoneInput.addEventListener("input", () => {
    registerPhoneInput.value = normalizePhone(registerPhoneInput.value)
  })
}

document.querySelectorAll(".tab-auth-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab

    document.querySelectorAll(".tab-auth-btn").forEach((b) => b.classList.remove("active"))
    document.querySelectorAll(".tab-content-auth").forEach((c) => c.classList.remove("active"))

    btn.classList.add("active")
    document.getElementById(`${tab}-tab`).classList.add("active")
  })
})

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("login-email").value
  const password = document.getElementById("login-password").value
  const btn = e.target.querySelector('button[type="submit"]')

  btn.disabled = true
  btn.textContent = "A entrar..."

  try {
    await authReady
    await signInWithEmailAndPassword(auth, email, password)
    showToast("Bem-vindo!", "Início de sessão realizado com sucesso", "success")
    setTimeout(() => (window.location.href = "index.html"), 1000)
  } catch (error) {
    console.error("[v0] Login error:", error)
    showToast("Erro no início de sessão", "Credenciais inválidas", "error")
    btn.disabled = false
    btn.textContent = "Entrar"
  }
})

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault()

  const name = document.getElementById("register-name").value
  const email = document.getElementById("register-email").value
  const phone = normalizePhone(registerPhoneInput?.value || "")
  const password = document.getElementById("register-password").value
  const confirmPassword = document.getElementById("register-confirm-password").value
  const btn = e.target.querySelector('button[type="submit"]')

  if (registerPhoneInput) {
    registerPhoneInput.value = phone
  }

  if (phone.length !== 9) {
    showToast("Erro", "O número de telefone deve ter exatamente 9 dígitos", "error")
    return
  }

  if (password !== confirmPassword) {
    showToast("Erro", "As palavras-passe não coincidem", "error")
    return
  }

  if (password.length < 6) {
    showToast("Erro", "A palavra-passe deve ter pelo menos 6 caracteres", "error")
    return
  }

  btn.disabled = true
  btn.textContent = "A criar conta..."

  try {
    await authReady
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(userCredential.user, { displayName: name })

    await setDoc(doc(db, "users", userCredential.user.uid), {
      name,
      email,
      phone,
      role: "customer",
      createdAt: new Date(),
    })

    showToast("Conta criada!", "A sua conta foi criada com sucesso", "success")
    setTimeout(() => (window.location.href = "index.html"), 1000)
  } catch (error) {
    console.error("[v0] Register error:", error)
    showToast("Erro no registo", error.message || "Não foi possível criar a conta", "error")
    btn.disabled = false
    btn.textContent = "Criar conta"
  }
})
