import './style.css'
import { Icon } from './icons.js'
import { navigate, onRoute, getRoute, initRouter, toast } from './router.js'
import { supabase } from './supabase.js'
import { renderDashboard, escape } from './views/dashboard.js'
import { renderTasks } from './views/tasks.js'
import { renderProjects } from './views/projects.js'
import { renderTeam } from './views/team.js'
import { renderCRM } from './views/crm.js'
import { renderClients } from './views/clients.js'
import { renderChat } from './views/chat.js'
import { renderFinance } from './views/finance.js'
import { renderSettings } from './views/settings.js'
import { renderAgenda } from './views/agenda.js'
import { renderDocuments } from './views/documents.js'
import { renderPress } from './views/press.js'
import { renderCommunication } from './views/communication.js'
import { renderTemplates } from './views/templates.js'
import { renderTimeTracking } from './views/time-tracking.js'
import { renderInvoices } from './views/invoices.js'
import { renderSocial } from './views/social.js'
import { renderEvents } from './views/events.js'
import { renderReports } from './views/reports.js'
import { renderAnalytics } from './views/analytics.js'
import { renderIdeas } from './views/ideas.js'
import { renderLogin, getCurrentUser, logout } from './views/login.js'
import { initAssistant } from './views/assistant.js'

const NAV = [
  { section: 'Pilotage', items: [
    { id: 'dashboard', label: 'Tableau de bord', icon: Icon.dashboard(18) },
    { id: 'tasks', label: 'Tâches', icon: Icon.tasks(18) },
    { id: 'projects', label: 'Projets', icon: Icon.projects(18) },
    { id: 'agenda', label: 'Agenda', icon: Icon.calendar(18) },
    { id: 'time-tracking', label: 'Suivi du temps', icon: Icon.timer(18) },
  ]},
  { section: 'Business', items: [
    { id: 'clients', label: 'Clients', icon: Icon.users(18) },
    { id: 'crm', label: 'CRM', icon: Icon.crm(18) },
    { id: 'invoices', label: 'Facturation', icon: Icon.file(18) },
    { id: 'finance', label: 'Finance', icon: Icon.finance(18) },
    { id: 'ideas', label: 'Idées', icon: Icon.briefcase(18) },
  ]},
  { section: 'Collaboration', items: [
    { id: 'team', label: 'Équipe', icon: Icon.team(18) },
    { id: 'chat', label: 'Discussions', icon: Icon.chat(18) },
    { id: 'communication', label: 'Communication', icon: Icon.chat(18) },
    { id: 'documents', label: 'Documents', icon: Icon.briefcase(18) },
  ]},
  { section: 'Création', items: [
    { id: 'social', label: 'Calendrier éditorial', icon: Icon.image(18) },
    { id: 'templates', label: 'Templates', icon: Icon.briefcase(18) },
  ]},
  { section: 'Veille', items: [
    { id: 'events', label: 'Événements sportifs', icon: Icon.trophy(18) },
    { id: 'press', label: 'Presse Sport Auto', icon: Icon.trend(18) },
  ]},
  { section: 'Analyse', items: [
    { id: 'reports', label: 'Rapports clients', icon: Icon.file(18) },
    { id: 'analytics', label: 'Analytics', icon: Icon.chart(18) },
  ]},
  { section: 'Système', items: [
    { id: 'settings', label: 'Paramètres', icon: Icon.settings(18) },
  ]},
]

const VIEWS = {
  dashboard: renderDashboard,
  tasks: renderTasks,
  projects: renderProjects,
  agenda: renderAgenda,
  'time-tracking': renderTimeTracking,
  invoices: renderInvoices,
  social: renderSocial,
  events: renderEvents,
  reports: renderReports,
  analytics: renderAnalytics,
  ideas: renderIdeas,
  clients: renderClients,
  crm: renderCRM,
  finance: renderFinance,
  team: renderTeam,
  chat: renderChat,
  communication: renderCommunication,
  documents: renderDocuments,
  templates: renderTemplates,
  press: renderPress,
  settings: renderSettings,
}

function shellHTML(user) {
  const initials = user.name.slice(0, 2).toUpperCase()
  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-logo" id="brand-logo">M</div>
        <div class="brand-name" id="brand-name">Mon Entreprise</div>
      </div>
      <nav class="nav" id="nav">
        ${NAV.map((g) => `
          <div class="nav-section">${g.section}</div>
          ${g.items.map((i) => `
            <button class="nav-item" data-route="${i.id}">
              <span class="nav-ico">${i.icon}</span>
              <span>${i.label}</span>
            </button>`).join('')}
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="avatar" style="background:${user.avatar_color || 'var(--primary)'}">${initials}</div>
          <div class="user-meta">
            <div class="user-name">${escape(user.name)}</div>
            <div class="user-role">${user.role === 'admin' ? 'Administrateur' : 'Membre'}</div>
          </div>
          <button class="icon-btn" id="logout-btn" title="Déconnexion">${Icon.close(16)}</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn">${Icon.menu(20)}</button>
        <div class="search">
          <span class="search-ico">${Icon.search(16)}</span>
          <input id="global-search" placeholder="Rechercher partout..." autocomplete="off">
          <div class="search-results" id="search-results" style="display:none"></div>
        </div>
        <div class="topbar-spacer"></div>
        <button class="icon-btn" id="theme-toggle">${Icon.moon(18)}</button>
        <button class="icon-btn" id="bell-btn">${Icon.bell(18)}<span class="dot"></span></button>
      </header>
      <main class="content" id="content"></main>
    </div>`
}

export function updateBrand(settings) {
  const nameEl = document.getElementById('brand-name')
  const logoEl = document.getElementById('brand-logo')
  if (!nameEl) return
  if (settings.name) nameEl.textContent = settings.name
  if (logoEl) {
    if (settings.logo_url) {
      logoEl.innerHTML = `<img src="${settings.logo_url}" style="width:100%;height:100%;border-radius:9px;object-fit:cover">`
    } else {
      logoEl.textContent = (settings.name || 'M')[0].toUpperCase()
    }
  }
  if (settings.primary_color) {
    document.documentElement.style.setProperty('--primary', settings.primary_color)
  }
}

async function boot() {
  initRouter()

  // Check login
  const user = getCurrentUser()
  if (!user) {
    renderLogin(document.getElementById('app'), () => location.reload())
    return
  }

  // theme
  const savedTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)
  document.querySelector('#app').innerHTML = shellHTML(user)
  updateThemeIcon()

  // brand from settings
  const { data: settings } = await supabase.from('company_settings').select('*').maybeSingle()
  if (settings) updateBrand(settings)

  // nav
  document.querySelectorAll('[data-route]').forEach((b) => b.onclick = () => { navigate(b.dataset.route); closeSidebar() })

  // logout
  document.getElementById('logout-btn').onclick = () => { if (confirm('Se déconnecter ?')) logout() }

  // mobile menu
  document.getElementById('menu-btn').onclick = () => document.getElementById('sidebar').classList.toggle('collapsed')

  // theme toggle
  document.getElementById('theme-toggle').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme')
    const next = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    updateThemeIcon()
  }

  // bell — real notification center
  setupNotifications()

  // global search
  setupSearch()

  // router
  onRoute(render)
  render(getRoute())

  // AI Assistant
  initAssistant()
}

function closeSidebar() {
  if (window.innerWidth <= 860) document.getElementById('sidebar').classList.add('collapsed')
}

function updateThemeIcon() {
  const t = document.documentElement.getAttribute('data-theme')
  document.getElementById('theme-toggle').innerHTML = t === 'dark' ? Icon.sun(18) : Icon.moon(18)
}

async function setupNotifications() {
  const bell = document.getElementById('bell-btn')
  const [tasks, invoices, events] = await Promise.all([
    supabase.from('tasks').select('title,due_date').neq('status', 'done').not('due_date', 'is', null),
    supabase.from('invoices').select('number,total').eq('status', 'overdue'),
    supabase.from('sport_events').select('name,start_date').eq('status', 'upcoming').order('start_date', { ascending: true }).limit(3),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const overdueTasks = (tasks.data || []).filter((task) => task.due_date < today)
  const items = [
    ...overdueTasks.map((task) => ({ type: 'danger', title: 'Tâche en retard', text: task.title, route: 'tasks' })),
    ...(invoices.data || []).map((invoice) => ({ type: 'warning', title: 'Facture impayée', text: `${invoice.number} · ${Number(invoice.total || 0).toLocaleString('fr-FR')} €`, route: 'invoices' })),
    ...(events.data || []).map((event) => ({ type: 'info', title: 'Événement à venir', text: `${event.name} · ${new Date(event.start_date).toLocaleDateString('fr-FR')}`, route: 'events' })),
  ]
  const dot = bell.querySelector('.dot')
  if (dot) dot.style.display = items.length ? 'block' : 'none'
  bell.onclick = () => showNotifications(items)
}

function showNotifications(items) {
  document.querySelector('.notification-popover')?.remove()
  const popover = document.createElement('div')
  popover.className = 'notification-popover'
  popover.innerHTML = `
    <div class="notification-head"><strong>Notifications</strong><span>${items.length} alerte${items.length === 1 ? '' : 's'}</span></div>
    <div class="notification-list">${items.length ? items.map((item, index) => `
      <button class="notification-item ${item.type}" data-route="${item.route}" data-index="${index}">
        <span class="notification-mark"></span><span><strong>${escape(item.title)}</strong><small>${escape(item.text)}</small></span>
      </button>`).join('') : '<div class="notification-empty">Tout est à jour</div>'}</div>`
  document.body.appendChild(popover)
  const bell = document.getElementById('bell-btn')
  const rect = bell.getBoundingClientRect()
  popover.style.top = `${rect.bottom + 8}px`
  popover.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`
  popover.querySelectorAll('.notification-item').forEach((item) => item.onclick = () => {
    navigate(item.dataset.route)
    popover.remove()
  })
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!popover.contains(e.target) && e.target !== bell) { popover.remove(); document.removeEventListener('click', close) }
  }), 0)
}

async function render(route) {
  document.querySelectorAll('[data-route]').forEach((b) => b.classList.toggle('active', b.dataset.route === route.path))
  const content = document.getElementById('content')
  content.innerHTML = ''
  const view = VIEWS[route.path] || renderDashboard
  try {
    await view(content)
  } catch (e) {
    content.innerHTML = `<div class="empty">Erreur: ${escape(e.message)}</div>`
  }
}

function setupSearch() {
  const input = document.getElementById('global-search')
  const results = document.getElementById('search-results')
  let timer
  input.addEventListener('input', () => {
    clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < 2) { results.style.display = 'none'; return }
    timer = setTimeout(() => doSearch(q, results), 200)
  })
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) results.style.display = 'none' })
}

async function doSearch(q, resultsEl) {
  const [tasks, projects, team, deals, clients] = await Promise.all([
    supabase.from('tasks').select('id,title').ilike('title', `%${q}%`),
    supabase.from('projects').select('id,name').ilike('name', `%${q}%`),
    supabase.from('team_members').select('id,first_name,last_name').or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`),
    supabase.from('crm_deals').select('id,company').ilike('company', `%${q}%`),
    supabase.from('clients').select('id,name').ilike('name', `%${q}%`),
  ])
  const groups = [
    { title: 'Clients', items: (clients.data || []).map((c) => ({ id: c.id, label: c.name, route: 'clients' })) },
    { title: 'Tâches', items: (tasks.data || []).map((t) => ({ id: t.id, label: t.title, route: 'tasks' })) },
    { title: 'Projets', items: (projects.data || []).map((p) => ({ id: p.id, label: p.name, route: 'projects' })) },
    { title: 'Équipe', items: (team.data || []).map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name}`, route: 'team' })) },
    { title: 'CRM', items: (deals.data || []).map((d) => ({ id: d.id, label: d.company, route: 'crm' })) },
  ].filter((g) => g.items.length)

  if (!groups.length) { resultsEl.innerHTML = '<div class="empty">Aucun résultat</div>'; resultsEl.style.display = 'block'; return }
  resultsEl.innerHTML = groups.map((g) => `
    <div class="sr-group">
      <div class="sr-group-title">${g.title}</div>
      ${g.items.slice(0, 5).map((i) => `<div class="sr-item" data-route="${g.route}" data-id="${i.id}">${Icon.search(13)} ${escape(i.label)}</div>`).join('')}
    </div>`).join('')
  resultsEl.style.display = 'block'
  resultsEl.querySelectorAll('.sr-item').forEach((it) => it.onclick = () => {
    navigate(it.dataset.route)
    resultsEl.style.display = 'none'
    input.value = ''
  })
}

boot()
