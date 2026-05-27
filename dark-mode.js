// Dark Mode Toggle Script
// Salva preferência em localStorage e aplica automaticamente

const DARK_MODE_KEY = 'padaria-dark-mode'

function initDarkMode() {
  const html = document.documentElement
  const toggle = document.getElementById('theme-toggle')

  // Carregar preferência salva ou usar sistema preferência
  const savedMode = localStorage.getItem(DARK_MODE_KEY)
  let isDarkMode

  if (savedMode !== null) {
    isDarkMode = savedMode === 'true'
  } else {
    // Usar preferência do sistema se nada foi salvo
    isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  applyDarkMode(isDarkMode)

  // Toggle button click event
  if (toggle) {
    toggle.addEventListener('click', () => {
      isDarkMode = !isDarkMode
      applyDarkMode(isDarkMode)
      localStorage.setItem(DARK_MODE_KEY, isDarkMode)
    })
  }

  // Ouve mudanças na preferência do sistema
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
      if (localStorage.getItem(DARK_MODE_KEY) === null) {
        applyDarkMode(e.matches)
      }
    })
  }
}

function applyDarkMode(isDark) {
  const html = document.documentElement
  const toggle = document.getElementById('theme-toggle')

  if (isDark) {
    html.classList.add('dark-mode')
    if (toggle) toggle.textContent = '☀️' // Sun icon for light mode
  } else {
    html.classList.remove('dark-mode')
    if (toggle) toggle.textContent = '🌙' // Moon icon for dark mode
  }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDarkMode)
} else {
  initDarkMode()
}
