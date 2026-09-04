import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'
import { getCurrentUser } from './login.js'

const STATUSES = [
  { id: 'new', label: 'Nouvelle', color: '#3b82f6' },
  { id: 'exploring', label: 'En exploration', color: '#8b5cf6' },
  { id: 'planned', label: 'Planifiée', color: '#f59e0b' },
  { id: 'in_progress', label: 'En cours', color: '#10b981' },
  { id: 'done', label: 'Réalisée', color: '#22c55e' },
  { id: 'archived', label: 'Archivée', color: '#94a3b8' },
]

const PRIORITIES = [
  { id: 'low', label: 'Faible', color: '#94a3b8' },
  { id: 'medium', label: 'Moyenne', color: '#f59e0b' },
  { id: 'high', label: 'Haute', color: '#ef4444' },
]

const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id
const statusColor = (id) => STATUSES.find((s) => s.id === id)?.color || '#94a3b8'
const priorityLabel = (id) => PRIORITIES.find((p) => p.id === id)?.label || id
const priorityColor = (id) => PRIORITIES.find((p) => p.id === id)?.color || '#94a3b8'

let activeScope = 'all'
let activeStatus = 'all'
let searchQuery = ''

export async function renderIdeas(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const user = getCurrentUser()
  const authorName = user ? user.name : 'Moi'
  const [{ data: ideas }, { data: clients }, { data: projects }] = await Promise.all([
    supabase.from('ideas').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id,name,logo_color').order('name'),
    supabase.from('projects').select('id,name,color').order('name'),
  ])

  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p]))
  const allIdeas = ideas || []

  drawLayout(content, allIdeas, clientMap, projectMap, clients, projects, authorName)
}

function drawLayout(content, allIdeas, clientMap, projectMap, clients, projects, authorName) {
  const companyCount = allIdeas.filter((i) => i.scope === 'company').length
  const clientCount = allIdeas.filter((i) => i.scope === 'client').length

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Idées</div><div class="page-sub">${allIdeas.length} idée(s) · ${companyCount} entreprise · ${clientCount} clients</div></div>
      <button class="btn btn-primary" id="add-idea">${Icon.plus(16)} Nouvelle idée</button>
    </div>
    <div class="ideas-tabs">
      <button class="ideas-tab ${activeScope === 'all' ? 'active' : ''}" data-scope="all">Toutes (${allIdeas.length})</button>
      <button class="ideas-tab ${activeScope === 'company' ? 'active' : ''}" data-scope="company">Développement entreprise (${companyCount})</button>
      <button class="ideas-tab ${activeScope === 'client' ? 'active' : ''}" data-scope="client">Idées clients (${clientCount})</button>
    </div>
    <div class="ideas-toolbar">
      <div class="ideas-search">
        <span class="ideas-search-ico">${Icon.search(15)}</span>
        <input id="ideas-search-input" placeholder="Rechercher une idée..." autocomplete="off" value="${escape(searchQuery)}">
      </div>
      <select id="ideas-status-filter" class="ideas-filter-select">
        <option value="all" ${activeStatus === 'all' ? 'selected' : ''}>Tous les statuts</option>
        ${STATUSES.map((s) => `<option value="${s.id}" ${activeStatus === s.id ? 'selected' : ''}>${escape(s.label)}</option>`).join('')}
      </select>
    </div>
    <div class="ideas-board" id="ideas-board">
      ${renderBoard(allIdeas, clientMap, projectMap)}
    </div>`

  bindEvents(content, allIdeas, clientMap, projectMap, clients, projects, authorName)
}

function getFilteredIdeas(allIdeas) {
  let filtered = allIdeas
  if (activeScope !== 'all') filtered = filtered.filter((i) => i.scope === activeScope)
  if (activeStatus !== 'all') filtered = filtered.filter((i) => i.status === activeStatus)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((i) =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.tags || '').toLowerCase().includes(q)
    )
  }
  return filtered
}

function renderBoard(allIdeas, clientMap, projectMap) {
  const filtered = getFilteredIdeas(allIdeas)
  if (!filtered.length) {
    return '<div class="empty" style="margin-top:24px;text-align:center">Aucune idée dans cette vue</div>'
  }

  const byStatus = {}
  STATUSES.forEach((s) => byStatus[s.id] = [])
  filtered.forEach((i) => {
    if (!byStatus[i.status]) byStatus[i.status] = []
    byStatus[i.status].push(i)
  })

  return `<div class="ideas-columns">${STATUSES.map((s) => {
    const items = byStatus[s.id] || []
    return `
      <div class="ideas-col">
        <div class="ideas-col-head">
          <span class="ideas-col-dot" style="background:${s.color}"></span>
          <span class="ideas-col-title">${escape(s.label)}</span>
          <span class="ideas-col-count">${items.length}</span>
        </div>
        <div class="ideas-col-body">
          ${items.map((i) => ideaCard(i, clientMap, projectMap)).join('') || '<div class="ideas-col-empty">—</div>'}
        </div>
      </div>`
  }).join('')}</div>`
}

function ideaCard(i, clientMap, projectMap) {
  const client = i.client_id ? clientMap[i.client_id] : null
  const project = i.project_id ? projectMap[i.project_id] : null
  const tags = (i.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
  return `
    <div class="idea-card" data-id="${i.id}">
      <div class="idea-card-head">
        <div class="idea-card-title" title="${escape(i.title)}">${escape(i.title)}</div>
        <div class="idea-card-actions">
          <button class="idea-act" data-edit="${i.id}" title="Modifier">${Icon.edit(12)}</button>
          <button class="idea-act idea-act-danger" data-del="${i.id}" title="Supprimer">${Icon.trash(12)}</button>
        </div>
      </div>
      ${i.description ? `<div class="idea-card-desc">${escape(i.description.slice(0, 120))}${i.description.length > 120 ? '...' : ''}</div>` : ''}
      <div class="idea-card-tags">
        <span class="idea-tag idea-tag-priority" style="background:${priorityColor(i.priority)}20;color:${priorityColor(i.priority)}">${priorityLabel(i.priority)}</span>
        ${i.scope === 'client' ? '<span class="idea-tag idea-tag-scope">Client</span>' : '<span class="idea-tag idea-tag-scope idea-tag-scope-company">Entreprise</span>'}
        ${tags.map((t) => `<span class="idea-tag">${escape(t)}</span>`).join('')}
      </div>
      <div class="idea-card-meta">
        ${client ? `<span style="color:${client.logo_color || 'var(--text-3)'}">${escape(client.name)}</span>` : ''}
        ${project ? `<span style="color:${project.color || 'var(--text-3)'}">● ${escape(project.name)}</span>` : ''}
        <span>${escape(i.created_by)}</span>
      </div>
      <div class="idea-card-status">
        <select class="idea-status-select" data-status="${i.id}" style="border-color:${statusColor(i.status)};color:${statusColor(i.status)}">
          ${STATUSES.map((s) => `<option value="${s.id}" ${i.status === s.id ? 'selected' : ''}>${escape(s.label)}</option>`).join('')}
        </select>
      </div>
    </div>`
}

function bindEvents(content, allIdeas, clientMap, projectMap, clients, projects, authorName) {
  // Scope tabs
  content.querySelectorAll('.ideas-tab').forEach((tab) => {
    tab.onclick = () => {
      activeScope = tab.dataset.scope
      content.querySelectorAll('.ideas-tab').forEach((t) => t.classList.toggle('active', t === tab))
      refreshBoard(content, allIdeas, clientMap, projectMap, clients, projects, authorName)
    }
  })

  // Status filter
  const statusFilter = document.getElementById('ideas-status-filter')
  if (statusFilter) {
    statusFilter.onchange = () => {
      activeStatus = statusFilter.value
      refreshBoard(content, allIdeas, clientMap, projectMap, clients, projects, authorName)
    }
  }

  // Search
  const searchInput = document.getElementById('ideas-search-input')
  if (searchInput) {
    let timer
    searchInput.addEventListener('input', () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        searchQuery = searchInput.value
        refreshBoard(content, allIdeas, clientMap, projectMap, clients, projects, authorName)
      }, 200)
    })
  }

  // Add button
  document.getElementById('add-idea').onclick = () => openForm(content, {}, clients, projects, authorName)

  bindCardEvents(content, allIdeas, clients, projects, authorName)
}

function refreshBoard(content, allIdeas, clientMap, projectMap, clients, projects, authorName) {
  const board = document.getElementById('ideas-board')
  if (board) board.innerHTML = renderBoard(allIdeas, clientMap, projectMap)
  bindCardEvents(content, allIdeas, clients, projects, authorName)
}

function bindCardEvents(content, allIdeas, clients, projects, authorName) {
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
    openForm(content, allIdeas.find((i) => i.id === b.dataset.edit), clients, projects, authorName)
  })
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette idée ?')) {
      await supabase.from('ideas').delete().eq('id', b.dataset.del)
      toast('Idée supprimée', 'success')
      renderIdeas(content)
    }
  })
  content.querySelectorAll('[data-status]').forEach((sel) => {
    sel.onchange = async () => {
      await supabase.from('ideas').update({ status: sel.value, updated_at: new Date().toISOString() }).eq('id', sel.dataset.status)
      renderIdeas(content)
    }
  })
}

async function openForm(content, i = {}, clients, projects, authorName) {
  if (!clients) {
    const res = await supabase.from('clients').select('id,name')
    clients = res.data || []
  }
  if (!projects) {
    const res = await supabase.from('projects').select('id,name')
    projects = res.data || []
  }
  await modal(i.id ? "Modifier l'idée" : 'Nouvelle idée', (body) => {
    body.innerHTML = `
      <div class="field"><label>Titre</label><input id="f-title" value="${escape(i.title || '')}" placeholder="ex: Nouveau service digital"></div>
      <div class="form-row">
        <div class="field"><label>Portée</label><select id="f-scope">
          <option value="company" ${i.scope === 'company' ? 'selected' : ''}>Développement entreprise</option>
          <option value="client" ${i.scope === 'client' ? 'selected' : ''}>Idée client</option>
        </select></div>
        <div class="field"><label>Priorité</label><select id="f-priority">
          ${PRIORITIES.map((p) => `<option value="${p.id}" ${i.priority === p.id ? 'selected' : ''}>${escape(p.label)}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="field" id="f-client-wrap" style="display:${i.scope === 'client' ? 'block' : 'none'}"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${i.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet (optionnel)</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${i.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Description</label><textarea id="f-desc" rows="4" placeholder="Décrivez l'idée en détail...">${escape(i.description || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">
          ${STATUSES.map((s) => `<option value="${s.id}" ${i.status === s.id ? 'selected' : ''}>${escape(s.label)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Tags (séparés par des virgules)</label><input id="f-tags" value="${escape(i.tags || '')}" placeholder="ex: marketing, q4, innovation"></div>
      </div>`
    const scopeSel = body.querySelector('#f-scope')
    const clientWrap = body.querySelector('#f-client-wrap')
    scopeSel.onchange = () => { clientWrap.style.display = scopeSel.value === 'client' ? 'block' : 'none' }
  }, async () => {
    const payload = {
      title: document.getElementById('f-title').value.trim(),
      scope: document.getElementById('f-scope').value,
      priority: document.getElementById('f-priority').value,
      client_id: document.getElementById('f-client')?.value || null,
      project_id: document.getElementById('f-project').value || null,
      description: document.getElementById('f-desc').value.trim(),
      status: document.getElementById('f-status').value,
      tags: document.getElementById('f-tags').value.trim(),
      created_by: authorName,
    }
    if (!payload.title) { toast('Titre requis', 'error'); return false }

    if (i.id) {
      payload.updated_at = new Date().toISOString()
      await supabase.from('ideas').update(payload).eq('id', i.id)
      toast('Idée mise à jour', 'success')
    } else {
      await supabase.from('ideas').insert(payload)
      toast('Idée créée', 'success')
    }
    renderIdeas(content)
  })
}
