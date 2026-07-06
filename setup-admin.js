import { auth, db, showToast } from "./firebase-config.js"
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

const setupForm = document.getElementById("setup-admin-form")
const adminPhoneInput = document.getElementById("admin-phone")

function normalizePhone(value) {
  return (value || "").replace(/\D/g, "").slice(0, 9)
}

if (adminPhoneInput) {
  adminPhoneInput.addEventListener("input", () => {
    adminPhoneInput.value = normalizePhone(adminPhoneInput.value)
  })
}

setupForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  const name = document.getElementById("admin-name").value
  const email = document.getElementById("admin-email").value
  const phone = normalizePhone(adminPhoneInput?.value || "")
  const password = document.getElementById("admin-password").value
  const confirmPassword = document.getElementById("admin-confirm-password").value

  if (adminPhoneInput) {
    adminPhoneInput.value = phone
  }

  if (phone.length !== 9) {
    showToast("Erro", "O número de telefone deve ter exatamente 9 dígitos", "error")
    return
  }

  if (password !== confirmPassword) {
    showToast("Erro", "As palavras-passe não coincidem", "error")
    return
  }

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    await setDoc(doc(db, "users", user.uid), {
      email,
      name,
      phone,
      role: "admin",
      createdAt: new Date(),
    })

    document.querySelector(".auth-header").style.display = "none"
    document.querySelector(".card").style.display = "none"
    document.getElementById("success-message").style.display = "block"

    showToast("Sucesso", "Administrador criado com sucesso!", "success")
  } catch (error) {
    console.error("Error creating admin:", error)
    showToast("Erro", error.message, "error")
  }
})
