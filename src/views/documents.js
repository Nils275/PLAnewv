import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'
import { getCurrentUser } from './login.js'

const CATEGORIES = [
  { id: 'all', label: 'Tous les documents', icon: '🗂️' },
  { id: 'contracts', label: 'Contrats', icon: '📋' },
  { id: 'invoices', label: 'Factures & Devis', icon: '🧾' },
  { id: 'reports', label: 'Rapports', icon: '📊' },
  { id: 'presentations', label: 'Présentations', icon: '🎯' },
  { id: 'media', label: 'Médias & Visuels', icon: '🖼️' },
  { id: 'legal', label: 'Documents légaux', icon: '⚖️' },
  { id: 'general', label: 'Documents généraux', icon: '📁' },
]

const NAV_CATS = CATEGORIES.filter((c) => c.id !== 'all')

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || 'Documents généraux'
const catIcon = (id) => CATEGORIES.find((c) => c.id === id)?.icon || '📁'

const fileIcon = (type, name) => {
  const ext = (name || '').split('.').pop().toLowerCase()
  if (type?.includes('pdf') || ext === 'pdf') return '📄'
  if (type?.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
  if (type?.includes('video') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎬'
  if (type?.includes('sheet') || type?.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (type?.includes('word') || ['doc', 'docx'].includes(ext)) return '📝'
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  return '📎'
}

const isPreviewable = (type, name) => {
  const ext = (name || '').split('.').pop().toLowerCase()
  return type?.includes('pdf') || ext === 'pdf' ||
    type?.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
}

const fmtSize = (b) => {
  if (!b) return '—'
  if (b < 1024) return b + ' o'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko'
  return (b / 1024 / 1024).toFixed(1) + ' Mo'
}

let activeCategory = 'all'
let searchQuery = ''

export async function renderDocuments(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const user = getCurrentUser()
  const authorName = user ? user.name : 'Moi'
  const [{ data: docs }, { data: projects }, { data: clients }] = await Promise.all([
    supabase.from('documents').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('id,name,color').order('name'),
    supabase.from('clients').select('id,name,logo_color').order('name'),
  ])

  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p]))
  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))

  const allDocs = docs || []
  const totalSize = allDocs.reduce((s, d) => s + (d.size || 0), 0)

  // Count per category
  const catCounts = {}
  NAV_CATS.forEach((c) => catCounts[c.id] = 0)
  allDocs.forEach((d) => {
    const key = d.category || 'general'
    catCounts[key] = (catCounts[key] || 0) + 1
  })

  drawLayout(content, allDocs, projectMap, clientMap, catCounts, totalSize, projects, clients, authorName)
}

function drawLayout(content, allDocs, projectMap, clientMap, catCounts, totalSize, projects, clients, authorName) {
  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Centre d'archivage</div><div class="page-sub">${allDocs.length} document(s) · ${fmtSize(totalSize)} au total</div></div>
      <button class="btn btn-primary" id="add-doc">${Icon.plus(16)} Ajouter un document</button>
    </div>
    <div class="doc-archive">
      <aside class="doc-sidebar">
        <div class="doc-search">
          <span class="doc-search-ico">${Icon.search(16)}</span>
          <input id="doc-search-input" placeholder="Rechercher..." autocomplete="off" value="${escape(searchQuery)}">
        </div>
        <nav class="doc-nav">
          ${CATEGORIES.map((cat) => {
            const count = cat.id === 'all' ? allDocs.length : (catCounts[cat.id] || 0)
            return `
              <button class="doc-nav-item ${activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
                <span class="doc-nav-icon">${cat.icon}</span>
                <span class="doc-nav-label">${escape(cat.label)}</span>
                <span class="doc-nav-count">${count}</span>
              </button>`
          }).join('')}
        </nav>
        <div class="doc-storage">
          <div class="doc-storage-label">Espace utilisé</div>
          <div class="doc-storage-bar"><div class="doc-storage-fill" style="width:${Math.min(100, (totalSize / (500 * 1024 * 1024)) * 100)}%"></div></div>
          <div class="doc-storage-text">${fmtSize(totalSize)} / 500 Mo</div>
        </div>
      </aside>
      <div class="doc-main">
        <div class="drop-zone" id="drop-zone">
          <div style="text-align:center;padding:24px 20px;color:var(--text-3)">
            <div style="font-size:28px;margin-bottom:6px">${Icon.briefcase(28)}</div>
            <div style="font-size:13px;font-weight:600;color:var(--text-2)">Glissez vos fichiers ici pour les archiver</div>
            <div style="font-size:12px;margin-top:4px">ou cliquez pour parcourir — vous choisirez la rubrique</div>
          </div>
        </div>
        <div class="doc-grid" id="doc-grid">
          ${renderDocGrid(allDocs, projectMap, clientMap)}
        </div>
      </div>
    </div>`

  bindEvents(content, allDocs, projectMap, clientMap, projects, clients, authorName)
}

function getFilteredDocs(allDocs) {
  let filtered = allDocs
  if (activeCategory !== 'all') {
    filtered = filtered.filter((d) => (d.category || 'general') === activeCategory)
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((d) =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.uploaded_by || '').toLowerCase().includes(q)
    )
  }
  return filtered
}

function renderDocGrid(allDocs, projectMap, clientMap) {
  const filtered = getFilteredDocs(allDocs)
  if (!filtered.length) {
    return '<div class="empty" style="margin-top:24px;text-align:center">Aucun document dans cette rubrique</div>'
  }
  return filtered.map((d) => docCard(d, projectMap, clientMap)).join('')
}

function docCard(d, projectMap, clientMap) {
  const client = d.client_id ? clientMap[d.client_id] : null
  const project = d.project_id ? projectMap[d.project_id] : null
  const canPreview = isPreviewable(d.type, d.name)
  return `
    <div class="doc-card" data-doc-id="${d.id}">
      <div class="doc-card-preview" ${canPreview ? `data-view="${d.id}" style="cursor:pointer"` : ''}>
        ${renderThumb(d)}
      </div>
      <div class="doc-card-body">
        <div class="doc-card-title" title="${escape(d.name)}">
          ${escape(d.name)}
          ${d.locked ? '<span class="doc-lock">🔒</span>' : ''}
        </div>
        <div class="doc-card-meta">
          <span class="doc-cat-tag">${catIcon(d.category)} ${escape(catLabel(d.category))}</span>
          <span>${fmtSize(d.size)}</span>
        </div>
        <div class="doc-card-meta">
          <span>${escape(d.uploaded_by)}</span>
          <span>${new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        ${project || client ? `<div class="doc-card-meta">${project ? `<span style="color:${project.color || 'var(--primary)'}">● ${escape(project.name)}</span>` : ''}${client ? `<span style="color:${client.logo_color || 'var(--text-3)'}">${escape(client.name)}</span>` : ''}</div>` : ''}
      </div>
      <div class="doc-card-actions">
        ${canPreview ? `<button class="doc-act" data-view="${d.id}" title="Visualiser">${Icon.search(15)}</button>` : ''}
        ${d.file_url ? `<a class="doc-act" href="${d.file_url}" target="_blank" download title="Télécharger">${Icon.download(15)}</a>` : ''}
        <button class="doc-act" data-lock="${d.id}" title="${d.locked ? 'Déverrouiller' : 'Verrouiller'}">${d.locked ? '🔓' : '🔒'}</button>
        <button class="doc-act" data-edit="${d.id}" title="Modifier">${Icon.edit(14)}</button>
        <button class="doc-act doc-act-danger" data-del="${d.id}" title="Supprimer">${Icon.trash(14)}</button>
      </div>
    </div>`
}

function renderThumb(d) {
  if (!d.file_url) return `<div class="doc-thumb-icon">${Icon.briefcase(28)}</div>`
  if (isPreviewable(d.type, d.name)) {
    if (d.type?.includes('pdf') || (d.name || '').split('.').pop().toLowerCase() === 'pdf') {
      return `<div class="doc-thumb-icon">📄</div>`
    }
    return `<img src="${d.file_url}" alt="${escape(d.name)}" class="doc-thumb-img">`
  }
  return `<div class="doc-thumb-icon">${fileIcon(d.type, d.name)}</div>`
}

function bindEvents(content, allDocs, projectMap, clientMap, projects, clients, authorName) {
  // Category navigation
  content.querySelectorAll('.doc-nav-item').forEach((btn) => {
    btn.onclick = () => {
      activeCategory = btn.dataset.cat
      content.querySelectorAll('.doc-nav-item').forEach((b) => b.classList.toggle('active', b === btn))
      const grid = document.getElementById('doc-grid')
      grid.innerHTML = renderDocGrid(allDocs, projectMap, clientMap)
      bindDocCardEvents(content, allDocs, projectMap, clientMap, projects, clients, authorName)
    }
  })

  // Search
  const searchInput = document.getElementById('doc-search-input')
  if (searchInput) {
    let timer
    searchInput.addEventListener('input', () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        searchQuery = searchInput.value
        const grid = document.getElementById('doc-grid')
        grid.innerHTML = renderDocGrid(allDocs, projectMap, clientMap)
        bindDocCardEvents(content, allDocs, projectMap, clientMap, projects, clients, authorName)
      }, 200)
    })
  }

  // Add button
  document.getElementById('add-doc').onclick = () => openForm(content, {}, projects, clients, authorName)

  // Drop zone
  setupDropZone(content, projects, clients, authorName, allDocs, projectMap, clientMap)

  bindDocCardEvents(content, allDocs, projectMap, clientMap, projects, clients, authorName)
}

function bindDocCardEvents(content, allDocs, projectMap, clientMap, projects, clients, authorName) {
  content.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
    const d = allDocs.find((x) => x.id === b.dataset.view)
    if (d) previewDoc(d)
  })
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
    openForm(content, allDocs.find((d) => d.id === b.dataset.edit), projects, clients, authorName)
  })
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce document ?')) {
      const d = allDocs.find((x) => x.id === b.dataset.del)
      if (d?.file_path) {
        await supabase.storage.from('documents').remove([d.file_path])
      }
      await supabase.from('documents').delete().eq('id', b.dataset.del)
      toast('Document supprimé', 'success')
      renderDocuments(content)
    }
  })
  content.querySelectorAll('[data-lock]').forEach((b) => b.onclick = async () => {
    const d = allDocs.find((x) => x.id === b.dataset.lock)
    await supabase.from('documents').update({ locked: !d.locked }).eq('id', d.id)
    renderDocuments(content)
  })
}

function setupDropZone(content, projects, clients, authorName, allDocs, projectMap, clientMap) {
  const zone = document.getElementById('drop-zone')
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.multiple = true
  fileInput.style.display = 'none'
  content.appendChild(fileInput)

  zone.onclick = () => fileInput.click()
  fileInput.onchange = () => {
    if (fileInput.files.length) handleFiles(content, Array.from(fileInput.files), projects, clients, authorName)
    fileInput.value = ''
  }

  zone.addEventListener('dragover', (e) => {
    e.preventDefault()
    zone.classList.add('drop-zone--active')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-zone--active'))
  zone.addEventListener('drop', (e) => {
    e.preventDefault()
    zone.classList.remove('drop-zone--active')
    if (e.dataTransfer.files.length) handleFiles(content, Array.from(e.dataTransfer.files), projects, clients, authorName)
  })
}

async function handleFiles(content, files, projects, clients, authorName) {
  const category = await pickCategory()
  if (!category) return

  for (const file of files) {
    toast(`Upload de ${file.name}...`, 'info')
    const ext = file.name.split('.').pop()
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadErr) {
      toast(`Erreur upload: ${uploadErr.message}`, 'error')
      continue
    }

    const { data: pubData } = supabase.storage.from('documents').getPublicUrl(filePath)
    const fileUrl = pubData.publicUrl

    await supabase.from('documents').insert({
      name: file.name,
      file_url: fileUrl,
      file_path: filePath,
      size: file.size,
      type: file.type || '',
      uploaded_by: authorName,
      category,
    })
    toast(`${file.name} archivé dans ${catLabel(category)}`, 'success')
  }
  renderDocuments(content)
}

function pickCategory() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    const m = document.createElement('div')
    m.className = 'modal'
    m.style.maxWidth = '420px'
    m.innerHTML = `
      <div class="modal-head">
        <div class="modal-title">Choisir une rubrique</div>
        <button class="icon-btn close-btn">${Icon.close(18)}</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${NAV_CATS.map((c) => `
            <button class="doc-cat-pick" data-cat="${c.id}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);cursor:pointer;transition:all .15s;text-align:left;width:100%">
              <span style="font-size:20px">${c.icon}</span>
              <span style="font-size:14px;font-weight:600">${escape(c.label)}</span>
            </button>`).join('')}
        </div>
      </div>`
    overlay.appendChild(m)
    document.body.appendChild(overlay)

    const close = (val) => { overlay.remove(); resolve(val) }
    m.querySelector('.close-btn').onclick = () => close(null)
    overlay.onclick = (e) => { if (e.target === overlay) close(null) }
    m.querySelectorAll('.doc-cat-pick').forEach((btn) => {
      btn.onclick = () => close(btn.dataset.cat)
      btn.onmouseenter = () => { btn.style.borderColor = 'var(--primary)'; btn.style.background = 'var(--primary-soft)' }
      btn.onmouseleave = () => { btn.style.borderColor = 'var(--border)'; btn.style.background = 'var(--surface-2)' }
    })
  })
}

function previewDoc(d) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.zIndex = '200'
  const m = document.createElement('div')
  m.className = 'modal'
  m.style.maxWidth = '900px'
  m.style.maxHeight = '90vh'
  m.innerHTML = `
    <div class="modal-head">
      <div class="modal-title" style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${fileIcon(d.type, d.name)}</span>
        ${escape(d.name)}
      </div>
      <div style="display:flex;gap:6px">
        ${d.file_url ? `<a href="${d.file_url}" target="_blank" download class="btn btn-primary btn-sm" style="display:flex;align-items:center;gap:6px">${Icon.download(15)} Télécharger</a>` : ''}
        <button class="icon-btn close-btn">${Icon.close(18)}</button>
      </div>
    </div>
    <div class="modal-body" style="padding:0;display:flex;align-items:center;justify-content:center;min-height:400px;max-height:calc(90vh - 70px);overflow:hidden">
      ${renderPreview(d)}
    </div>`
  overlay.appendChild(m)
  document.body.appendChild(overlay)
  m.querySelector('.close-btn').onclick = () => overlay.remove()
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
}

function renderPreview(d) {
  if (!d.file_url) return '<div class="empty">Aucun fichier associé</div>'
  if (isPreviewable(d.type, d.name)) {
    if (d.type?.includes('pdf') || (d.name || '').split('.').pop().toLowerCase() === 'pdf') {
      return `<iframe src="${d.file_url}" style="width:100%;height:calc(90vh - 70px);border:none" title="${escape(d.name)}"></iframe>`
    }
    return `<img src="${d.file_url}" alt="${escape(d.name)}" style="max-width:100%;max-height:calc(90vh - 70px);object-fit:contain">`
  }
  return `
    <div style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">${fileIcon(d.type, d.name)}</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">${escape(d.name)}</div>
      <div style="font-size:13px;color:var(--text-3);margin-bottom:20px">${fmtSize(d.size)} · ${catLabel(d.category)}</div>
      <div style="font-size:13px;color:var(--text-3);margin-bottom:16px">Ce type de fichier ne peut pas être prévisualisé directement.</div>
      <a href="${d.file_url}" target="_blank" download class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px">${Icon.download(16)} Télécharger le fichier</a>
    </div>`
}

async function openForm(content, d = {}, projects, clients, authorName) {
  if (!projects) {
    const res = await supabase.from('projects').select('id,name')
    projects = res.data || []
  }
  if (!clients) {
    const res = await supabase.from('clients').select('id,name')
    clients = res.data || []
  }
  let selectedFile = null
  await modal(d.id ? 'Modifier le document' : 'Nouveau document', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom</label><input id="f-name" value="${escape(d.name || '')}" placeholder="ex: Cahier des charges"></div>
      <div class="field"><label>Rubrique</label><select id="f-category">${NAV_CATS.map((c) => `<option value="${c.id}" ${d.category === c.id ? 'selected' : ''}>${c.icon} ${escape(c.label)}</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="field"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${d.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${d.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Fichier</label><div class="drop-zone" id="modal-drop" style="margin-top:4px">
        <div style="text-align:center;padding:16px;color:var(--text-3);font-size:13px" id="modal-drop-text">
          ${d.file_url ? `Fichier actuel: ${escape(d.name)}` : 'Glissez un fichier ici ou cliquez'}
        </div>
      </div><input type="file" id="f-file" style="display:none"></div>`
    const modalZone = body.querySelector('#modal-drop')
    const modalInput = body.querySelector('#f-file')
    const modalDropText = body.querySelector('#modal-drop-text')
    modalZone.onclick = () => modalInput.click()
    modalZone.addEventListener('dragover', (e) => { e.preventDefault(); modalZone.classList.add('drop-zone--active') })
    modalZone.addEventListener('dragleave', () => modalZone.classList.remove('drop-zone--active'))
    modalZone.addEventListener('drop', (e) => {
      e.preventDefault()
      modalZone.classList.remove('drop-zone--active')
      if (e.dataTransfer.files.length) {
        selectedFile = e.dataTransfer.files[0]
        modalInput.files = e.dataTransfer.files
        modalDropText.textContent = `Fichier sélectionné: ${selectedFile.name}`
      }
    })
    modalInput.onchange = () => {
      if (modalInput.files.length) {
        selectedFile = modalInput.files[0]
        modalDropText.textContent = `Fichier sélectionné: ${selectedFile.name}`
      }
    }
  }, async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      project_id: document.getElementById('f-project').value || null,
      client_id: document.getElementById('f-client').value || null,
      category: document.getElementById('f-category').value || 'general',
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }

    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, selectedFile)
      if (uploadErr) { toast(`Erreur upload: ${uploadErr.message}`, 'error'); return false }
      const { data: pubData } = supabase.storage.from('documents').getPublicUrl(filePath)
      payload.file_url = pubData.publicUrl
      payload.file_path = filePath
      payload.size = selectedFile.size
      payload.type = selectedFile.type || ''
      payload.uploaded_by = authorName
      if (!payload.name) payload.name = selectedFile.name
    }

    if (d.id) {
      await supabase.from('documents').update(payload).eq('id', d.id)
      toast('Document mis à jour', 'success')
    } else {
      if (!payload.file_url) { toast('Aucun fichier sélectionné', 'error'); return false }
      await supabase.from('documents').insert(payload)
      toast('Document archivé', 'success')
    }
    renderDocuments(content)
  })
}
