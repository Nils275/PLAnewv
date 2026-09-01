import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { getCurrentUser } from './login.js'
import { navigate } from '../router.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const SUGGESTIONS = [
  'Qu\'est-ce que j\'ai à faire aujourd\'hui ?',
  'Ai-je des tâches en retard ?',
  'Bilan financier',
  'Vue d\'ensemble',
  'Où en sont mes projets ?',
  'Quels sont nos clients ?',
]

let messages = []
let isOpen = false
let container = null

export function initAssistant() {
  container = document.createElement('div')
  container.className = 'assistant-container'
  container.innerHTML = buildHTML()
  document.body.appendChild(container)
  bindEvents()
}

function buildHTML() {
  return `
    <button class="assistant-trigger" id="assistant-trigger" title="Assistant IA">
      <span class="assistant-trigger-glow"></span>
      <span class="assistant-trigger-core">${Icon.sparkles(22)}</span>
    </button>
    <div class="assistant-panel" id="assistant-panel">
      <div class="assistant-header">
        <div class="assistant-header-info">
          <span class="assistant-header-icon">${Icon.sparkles(18)}</span>
          <div>
            <div class="assistant-header-title">Assistant</div>
            <div class="assistant-header-sub">Copilote de votre activité</div>
          </div>
        </div>
        <button class="icon-btn" id="assistant-close">${Icon.close(18)}</button>
      </div>
      <div class="assistant-body" id="assistant-body">
        <div class="assistant-welcome">
          <div class="assistant-welcome-icon">${Icon.sparkles(32)}</div>
          <div class="assistant-welcome-title">Bonjour, je suis votre assistant</div>
          <div class="assistant-welcome-text">J'ai accès à toutes vos données : tâches, projets, clients, finances, agenda, événements... Posez-moi une question en lang naturel.</div>
          <div class="assistant-suggestions" id="assistant-suggestions">
            ${SUGGESTIONS.map((s) => `<button class="assistant-suggestion" data-suggestion="${escapeAttr(s)}">${escapeHTML(s)}</button>`).join('')}
          </div>
        </div>
        <div class="assistant-messages" id="assistant-messages"></div>
      </div>
      <div class="assistant-input-area">
        <input id="assistant-input" placeholder="Posez votre question..." autocomplete="off">
        <button class="assistant-send-btn" id="assistant-send">${Icon.send(18)}</button>
      </div>
    </div>`
}

function bindEvents() {
  const trigger = container.querySelector('#assistant-trigger')
  const panel = container.querySelector('#assistant-panel')
  const closeBtn = container.querySelector('#assistant-close')
  const input = container.querySelector('#assistant-input')
  const sendBtn = container.querySelector('#assistant-send')
  const suggestionsEl = container.querySelector('#assistant-suggestions')

  trigger.onclick = () => {
    isOpen = !isOpen
    panel.classList.toggle('open', isOpen)
    trigger.classList.toggle('hidden', isOpen)
    if (isOpen) setTimeout(() => input.focus(), 100)
  }

  closeBtn.onclick = () => {
    isOpen = false
    panel.classList.remove('open')
    trigger.classList.remove('hidden')
  }

  const send = async () => {
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    await sendMessage(text)
  }

  sendBtn.onclick = send
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  })

  suggestionsEl.querySelectorAll('.assistant-suggestion').forEach((btn) => {
    btn.onclick = () => {
      const text = btn.dataset.suggestion
      sendMessage(text)
    }
  })
}

async function sendMessage(text) {
  const user = getCurrentUser()
  const userName = user ? user.name : 'Utilisateur'

  // Hide suggestions after first message
  const suggestionsEl = container.querySelector('#assistant-suggestions')
  if (suggestionsEl) suggestionsEl.style.display = 'none'

  const messagesEl = container.querySelector('#assistant-messages')
  const bodyEl = container.querySelector('#assistant-body')

  // Append user message
  const userMsgEl = document.createElement('div')
  userMsgEl.className = 'assistant-msg user'
  userMsgEl.innerHTML = `<div class="assistant-msg-bubble">${escapeHTML(text)}</div>`
  messagesEl.appendChild(userMsgEl)

  // Typing indicator
  const typingEl = document.createElement('div')
  typingEl.className = 'assistant-msg bot assistant-typing'
  typingEl.innerHTML = `<div class="assistant-typing-dots"><span></span><span></span><span></span></div>`
  messagesEl.appendChild(typingEl)
  scrollToBottom(bodyEl)

  // Build message history
  messages.push({ role: 'user', content: text })

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/jarvis-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages, user_name: userName }),
    })
    const data = await res.json()
    const reply = data.reply || 'Désolé, je n\'ai pas pu traiter votre demande.'

    typingEl.remove()

    // Append bot message
    const botMsgEl = document.createElement('div')
    botMsgEl.className = 'assistant-msg bot'
    botMsgEl.innerHTML = `<div class="assistant-msg-bubble">${formatReply(reply)}</div>`
    messagesEl.appendChild(botMsgEl)

    messages.push({ role: 'assistant', content: reply })
  } catch (err) {
    typingEl.remove()
    const errMsgEl = document.createElement('div')
    errMsgEl.className = 'assistant-msg bot'
    errMsgEl.innerHTML = `<div class="assistant-msg-bubble assistant-error">Problème de connexion. Réessayez.</div>`
    messagesEl.appendChild(errMsgEl)
  }

  scrollToBottom(bodyEl)
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight
}

function formatReply(text) {
  // Convert plain text with line breaks to HTML, preserving bullet points
  const escaped = escapeHTML(text)
  // Bold headers like === TEXT ===
  let html = escaped.replace(/=== (.+?) ===/g, '<strong>$1</strong>')
  // Bullet points
  const lines = html.split('\n')
  let result = []
  let inList = false
  for (const line of lines) {
    if (line.trim().startsWith('• ')) {
      if (!inList) { result.push('<ul class="assistant-list">'); inList = true }
      result.push(`<li>${line.trim().slice(2)}</li>`)
    } else {
      if (inList) { result.push('</ul>'); inList = false }
      if (line.trim()) result.push(`<div class="assistant-line">${line}</div>`)
    }
  }
  if (inList) result.push('</ul>')
  return result.join('')
}

function escapeHTML(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;')
}
