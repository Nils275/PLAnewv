import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

let currentView = 'graph'
let searchQuery = ''
let activeTag = null

let simNodes = []
let simLinks = []
let simRAF = null
let simRunning = false
let simDragNode = null
let simDragOffset = { x: 0, y: 0 }
let simContent = null
let simAllNotes = []

const NODE_RED = '#e8392e'
const LINK_BLUE = '#3b5bdb'
const GRAPH_BG = '#1a1b26'
const GRAPH_BG_LIGHT = '#f5f5fa'

export async function renderBrain(content) {
  content.innerHTML = `<div class="spinner"></div>`
  stopSim()
  const { data: notes } = await supabase.from('brain_notes').select('*').order('updated_at', { ascending: false })
  const allNotes = notes || []
  drawView(content, allNotes)
}

function drawView(content, notes) {
  const allTags = extractAllTags(notes)
  const filtered = filterNotes(notes)

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Cerveau</div>
        <div class="page-sub">Base de connaissances — ${notes.length} note${notes.length === 1 ? '' : 's'} · ${allTags.length} tag${allTags.length === 1 ? '' : 's'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="seg-toggle">
          <button class="seg-btn ${currentView === 'graph' ? 'active' : ''}" data-view="graph">Graphe</button>
          <button class="seg-btn ${currentView === 'list' ? 'active' : ''}" data-view="list">Liste</button>
        </div>
        <button class="btn btn-primary" id="add-note">${Icon.plus(16)} Nouvelle note</button>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <div style="position:relative;flex:1;min-width:200px">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-3);pointer-events:none">${Icon.search(15)}</span>
        <input id="brain-search" placeholder="Rechercher une note..." value="${escape(searchQuery)}" style="width:100%;height:36px;padding:0 12px 0 34px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s" onfocus="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px var(--primary-soft)'" onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${allTags.slice(0, 12).map((t) => `<button class="brain-tag-chip ${activeTag === t ? 'active' : ''}" data-tag="${escape(t)}">#${escape(t)}</button>`).join('')}
        ${activeTag ? `<button class="brain-tag-chip" data-tag="" style="opacity:.7">✕ Clear</button>` : ''}
      </div>
    </div>

    <div id="brain-content">
      ${currentView === 'graph' ? drawGraphHTML(filtered, notes) : drawList(filtered, notes)}
    </div>
  `

  content.querySelector('#add-note').onclick = () => openNoteForm(content, notes, null)
  content.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
    currentView = b.dataset.view
    if (currentView !== 'graph') stopSim()
    drawView(content, notes)
  })

  const searchInput = content.querySelector('#brain-search')
  searchInput.oninput = () => { searchQuery = searchInput.value; drawView(content, notes) }

  content.querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => {
    activeTag = b.dataset.tag || null
    drawView(content, notes)
  })

  content.querySelectorAll('[data-note-id]').forEach((el) => el.onclick = () => {
    const note = notes.find((n) => n.id === el.dataset.noteId)
    if (note) openNoteDetail(content, notes, note)
  })

  if (currentView === 'graph') {
    initSim(content, filtered, notes)
  }
}

function drawList(notes, allNotes) {
  if (!notes.length) return '<div class="empty">Aucune note. Cliquez sur "Nouvelle note" pour commencer.</div>'

  return `
    <div class="brain-list">
      ${notes.map((n) => {
        const links = extractLinks(n.content)
        const tags = (n.tags || [])
        return `
          <div class="card brain-card" data-note-id="${n.id}" style="cursor:pointer">
            <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:10px;height:10px;border-radius:50%;background:${NODE_RED};flex-shrink:0"></span>
                <div style="font-weight:700;font-size:15px">${escape(n.title)}</div>
              </div>
              <span style="font-size:11px;color:var(--text-3)">${new Date(n.updated_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div style="font-size:13px;color:var(--text-2);line-height:1.5;margin-bottom:8px">${escape(n.content.slice(0, 150))}${n.content.length > 150 ? '...' : ''}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${tags.map((t) => `<span class="brain-mini-tag">#${escape(t)}</span>`).join('')}
              ${links.length ? `<span style="font-size:11px;color:var(--text-3);margin-left:auto">${Icon.link(11)} ${links.length} lien${links.length > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>`
      }).join('')}
    </div>`
}

function drawGraphHTML(notes, allNotes) {
  if (!notes.length && !allNotes.length) return '<div class="empty">Aucune note. Cliquez sur "Nouvelle note" pour commencer.</div>'

  const links = []
  const noteMap = new Map(allNotes.map((n) => [n.title.toLowerCase(), n]))
  const filteredIds = new Set(notes.map((n) => n.id))
  notes.forEach((n) => {
    const refs = extractLinks(n.content)
    refs.forEach((ref) => {
      const target = noteMap.get(ref.toLowerCase())
      if (target && filteredIds.has(target.id)) {
        links.push({ source: n.id, target: target.id })
      }
    })
  })

  return `
    <div class="card brain-graph-card" style="overflow:hidden;padding:0">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:600;font-size:14px">Graphe des connaissances</div>
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:12px;color:var(--text-3)" id="brain-graph-stats">${notes.length} noeuds · ${links.length} liens</span>
          <button class="btn btn-sm btn-ghost" id="brain-reset" title="Repositionner">${Icon.refresh(13)} Réorganiser</button>
        </div>
      </div>
      <div class="brain-graph-wrap" id="brain-graph-wrap">
        <svg id="brain-svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:560px;display:block">
          <g id="brain-links-group"></g>
          <g id="brain-nodes-group"></g>
        </svg>
        <div class="brain-graph-legend">
          <div style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:50%;background:${NODE_RED}"></span> Note</div>
          <div style="display:flex;align-items:center;gap:6px"><span style="width:18px;height:2px;background:${LINK_BLUE}"></span> Lien</div>
        </div>
      </div>
    </div>

    <div style="margin-top:16px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-2)">Toutes les notes</div>
      <div class="brain-chips">
        ${notes.map((n) => `
          <button class="brain-chip" data-note-id="${n.id}" style="--chip-color:${NODE_RED}">
            <span style="width:8px;height:8px;border-radius:50%;background:${NODE_RED};flex-shrink:0"></span>
            ${escape(n.title)}
          </button>`).join('')}
      </div>
    </div>`
}

function initSim(content, notes, allNotes) {
  stopSim()
  simContent = content
  simAllNotes = allNotes

  const svg = content.querySelector('#brain-svg')
  if (!svg) return
  const wrap = content.querySelector('#brain-graph-wrap')
  const rect = wrap.getBoundingClientRect()
  const w = rect.width || 800
  const h = 560

  const links = []
  const noteMap = new Map(allNotes.map((n) => [n.title.toLowerCase(), n]))
  const filteredIds = new Set(notes.map((n) => n.id))
  notes.forEach((n) => {
    const refs = extractLinks(n.content)
    refs.forEach((ref) => {
      const target = noteMap.get(ref.toLowerCase())
      if (target && filteredIds.has(target.id)) {
        links.push({ source: n.id, target: target.id })
      }
    })
  })

  simNodes = notes.map((n, i) => {
    const angle = (i / Math.max(notes.length, 1)) * 2 * Math.PI
    const radius = notes.length <= 2 ? 60 : notes.length <= 5 ? 100 : notes.length <= 10 ? 140 : 170
    return {
      id: n.id,
      title: n.title,
      x: w / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
      y: h / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      r: 14 + Math.min(links.filter((l) => l.source === n.id || l.target === n.id).length * 2.5, 14),
      linkCount: links.filter((l) => l.source === n.id || l.target === n.id).length,
    }
  })

  simLinks = links
  simRunning = true
  startSimLoop(w, h)

  const resetBtn = content.querySelector('#brain-reset')
  if (resetBtn) resetBtn.onclick = () => {
    simNodes.forEach((n, i) => {
      const angle = (i / Math.max(simNodes.length, 1)) * 2 * Math.PI
      const radius = simNodes.length <= 2 ? 60 : simNodes.length <= 5 ? 100 : 140
      n.x = w / 2 + Math.cos(angle) * radius
      n.y = h / 2 + Math.sin(angle) * radius
      n.vx = 0
      n.vy = 0
    })
    simRunning = true
    startSimLoop(w, h)
  }

  svg.addEventListener('pointerdown', onSimPointerDown)
  window.addEventListener('pointermove', onSimPointerMove)
  window.addEventListener('pointerup', onSimPointerUp)
}

function startSimLoop(w, h) {
  if (simRAF) cancelAnimationFrame(simRAF)

  const cx = w / 2
  const cy = h / 2
  const repulsion = 6000
  const linkStrength = 0.04
  const centerStrength = 0.015
  const damping = 0.82
  const minDist = 20

  function tick() {
    if (!simRunning) return

    for (let i = 0; i < simNodes.length; i++) {
      const a = simNodes[i]
      for (let j = i + 1; j < simNodes.length; j++) {
        const b = simNodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist) dist = minDist
        const force = repulsion / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        if (a !== simDragNode) { a.vx += fx; a.vy += fy }
        if (b !== simDragNode) { b.vx -= fx; b.vy -= fy }
      }
    }

    simLinks.forEach((l) => {
      const a = simNodes.find((n) => n.id === l.source)
      const b = simNodes.find((n) => n.id === l.target)
      if (!a || !b) return
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const targetDist = 120
      const force = (dist - targetDist) * linkStrength
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      if (a !== simDragNode) { a.vx += fx; a.vy += fy }
      if (b !== simDragNode) { b.vx -= fx; b.vy -= fy }
    })

    simNodes.forEach((n) => {
      if (n === simDragNode) { n.vx = 0; n.vy = 0; return }
      n.vx += (cx - n.x) * centerStrength
      n.vy += (cy - n.y) * centerStrength
      n.vx *= damping
      n.vy *= damping
      n.x += n.vx
      n.y += n.vy
      n.x = Math.max(n.r + 5, Math.min(w - n.r - 5, n.x))
      n.y = Math.max(n.r + 5, Math.min(h - n.r - 5, n.y))
    })

    let totalVel = 0
    simNodes.forEach((n) => { totalVel += Math.abs(n.vx) + Math.abs(n.vy) })

    renderSimSVG()

    if (totalVel < 0.5 && !simDragNode) {
      simRunning = false
      return
    }

    simRAF = requestAnimationFrame(tick)
  }

  simRAF = requestAnimationFrame(tick)
}

function renderSimSVG() {
  if (!simContent) return
  const svg = simContent.querySelector('#brain-svg')
  if (!svg) return

  const linksGroup = simContent.querySelector('#brain-links-group')
  const nodesGroup = simContent.querySelector('#brain-nodes-group')
  if (!linksGroup || !nodesGroup) return

  const w = svg.clientWidth || 800
  const h = 560
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const bg = isDark ? GRAPH_BG : GRAPH_BG_LIGHT

  linksGroup.innerHTML = simLinks.map((l) => {
    const a = simNodes.find((n) => n.id === l.source)
    const b = simNodes.find((n) => n.id === l.target)
    if (!a || !b) return ''
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${LINK_BLUE}" stroke-width="1.5" opacity=".55"/>`
  }).join('')

  nodesGroup.innerHTML = simNodes.map((n) => {
    const r = n.r
    return `
      <g class="brain-node" data-note-id="${n.id}" style="cursor:grab" transform="translate(${n.x},${n.y})">
        <circle r="${r + 6}" fill="${NODE_RED}" opacity=".1"/>
        <circle r="${r}" fill="${NODE_RED}" opacity=".9" stroke="${NODE_RED}" stroke-width="2"/>
        <text y="2" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="700" fill="#fff" pointer-events="none">${escape(n.title.slice(0, 8))}</text>
        ${n.linkCount > 0 ? `<text x="${r - 1}" y="${-r + 3}" text-anchor="middle" font-size="7" fill="#fff" pointer-events="none" font-weight="600">${n.linkCount}</text>` : ''}
      </g>`
  }).join('')

  nodesGroup.querySelectorAll('[data-note-id]').forEach((el) => {
    el.onclick = (e) => {
      if (simDragNode) return
      e.stopPropagation()
      const note = simAllNotes.find((n) => n.id === el.dataset.noteId)
      if (note) openNoteDetail(simContent, simAllNotes, note)
    }
  })

  const wrap = simContent.querySelector('#brain-graph-wrap')
  if (wrap) wrap.style.background = bg
}

function onSimPointerDown(e) {
  if (!simContent) return
  const svg = simContent.querySelector('#brain-svg')
  if (!svg) return
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return
  const local = pt.matrixTransform(ctm.inverse())

  let closest = null
  let closestDist = Infinity
  simNodes.forEach((n) => {
    const d = Math.sqrt((n.x - local.x) ** 2 + (n.y - local.y) ** 2)
    if (d < n.r + 8 && d < closestDist) {
      closest = n
      closestDist = d
    }
  })

  if (closest) {
    simDragNode = closest
    simDragOffset = { x: local.x - closest.x, y: local.y - closest.y }
    simRunning = true
    startSimLoop(svg.clientWidth || 800, 560)
    e.preventDefault()
  }
}

function onSimPointerMove(e) {
  if (!simDragNode || !simContent) return
  const svg = simContent.querySelector('#brain-svg')
  if (!svg) return
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return
  const local = pt.matrixTransform(ctm.inverse())
  simDragNode.x = local.x - simDragOffset.x
  simDragNode.y = local.y - simDragOffset.y
  simDragNode.vx = 0
  simDragNode.vy = 0
}

function onSimPointerUp() {
  if (simDragNode) {
    simDragNode = null
    simRunning = true
    const svg = simContent?.querySelector('#brain-svg')
    startSimLoop(svg?.clientWidth || 800, 560)
  }
}

function stopSim() {
  simRunning = false
  if (simRAF) { cancelAnimationFrame(simRAF); simRAF = null }
  window.removeEventListener('pointermove', onSimPointerMove)
  window.removeEventListener('pointerup', onSimPointerUp)
  simDragNode = null
  simContent = null
}

function openNoteDetail(content, notes, note) {
  const links = extractLinks(note.content)
  const noteMap = new Map(notes.map((n) => [n.title.toLowerCase(), n]))
  const linkedNotes = links.map((l) => noteMap.get(l.toLowerCase())).filter(Boolean)
  const tags = (note.tags || [])

  modal(note.title, (body) => {
    body.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${tags.map((t) => `<span class="brain-mini-tag">#${escape(t)}</span>`).join('')}
      </div>
      <div class="brain-note-content">${renderContent(note.content, notes)}</div>
      ${linkedNotes.length ? `
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:8px">Notes liées (${linkedNotes.length})</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${linkedNotes.map((ln) => `
              <button class="brain-chip" data-note-id="${ln.id}" style="--chip-color:${NODE_RED}">
                <span style="width:8px;height:8px;border-radius:50%;background:${NODE_RED};flex-shrink:0"></span>
                ${escape(ln.title)}
              </button>`).join('')}
          </div>
        </div>` : ''}
    `
  }, null, { noFooter: true })

  document.querySelectorAll('[data-note-id]').forEach((el) => {
    el.onclick = () => {
      const n = notes.find((x) => x.id === el.dataset.noteId)
      if (n) {
        document.querySelector('.modal-overlay')?.remove()
        openNoteDetail(content, notes, n)
      }
    }
  })

  const editBtn = document.createElement('button')
  editBtn.className = 'btn btn-sm btn-ghost'
  editBtn.style.cssText = 'position:absolute;top:14px;right:48px'
  editBtn.innerHTML = Icon.edit(14)
  editBtn.onclick = () => {
    document.querySelector('.modal-overlay')?.remove()
    openNoteForm(content, notes, note)
  }
  const modalEl = document.querySelector('.modal')
  if (modalEl) modalEl.appendChild(editBtn)
}

function openNoteForm(content, notes, existing) {
  const isEdit = !!existing
  const existingTags = (existing?.tags || []).join(', ')

  modal(isEdit ? 'Modifier la note' : 'Nouvelle note', (body) => {
    body.innerHTML = `
      <div class="field"><label>Titre</label><input id="b-title" value="${escape(existing?.title || '')}" placeholder="Titre de la note"></div>
      <div class="field"><label>Contenu</label>
        <textarea id="b-content" style="min-height:200px;font-family:monospace;font-size:13px;line-height:1.6" placeholder="Écrivez votre note... Utilisez [[Titre]] pour créer des liens vers d'autres notes et #tag pour les tags">${escape(existing?.content || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="field"><label>Tags (séparés par des virgules)</label><input id="b-tags" value="${escape(existingTags)}" placeholder="strategie, objectifs"></div>
        <div class="field"><label>Couleur</label>
          <select id="b-color">
            ${['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#059669', '#4f46e5', '#0d9488', '#f59e0b', '#ef4444'].map((c) => `<option value="${c}" ${existing?.color === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-3);margin-top:8px;line-height:1.5">
        Astuce: Utilisez <code style="background:var(--surface-2);padding:1px 4px;border-radius:3px">[[Titre d'une note]]</code> pour créer un lien vers une autre note.
        Utilisez <code style="background:var(--surface-2);padding:1px 4px;border-radius:3px">#tag</code> dans le contenu ou le champ tags.
      </div>`
  }, async (body) => {
    const title = body.querySelector('#b-title').value.trim()
    if (!title) { toast('Titre requis', 'error'); return false }
    const contentText = body.querySelector('#b-content').value
    const tagsRaw = body.querySelector('#b-tags').value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
    const contentTags = extractTagsFromContent(contentText)
    const allNoteTags = [...new Set([...tagsRaw, ...contentTags])]
    const payload = {
      title,
      content: contentText,
      tags: allNoteTags,
      color: body.querySelector('#b-color').value,
      updated_at: new Date().toISOString(),
    }
    if (isEdit) {
      await supabase.from('brain_notes').update(payload).eq('id', existing.id)
      toast('Note mise à jour', 'success')
    } else {
      await supabase.from('brain_notes').insert(payload)
      toast('Note créée', 'success')
    }
    renderBrain(content)
  }, { large: true })
}

function renderContent(text, allNotes) {
  let html = escape(text)
  const noteTitles = new Set(allNotes.map((n) => n.title.toLowerCase()))
  html = html.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    const exists = noteTitles.has(title.toLowerCase())
    const cls = exists ? 'brain-wikilink' : 'brain-wikilink-missing'
    return `<span class="${cls}" data-wiki="${escape(title)}">${escape(title)}</span>`
  })
  html = html.replace(/#([a-zA-ZÀ-ÿ0-9_-]+)/g, (match, tag) => `<span class="brain-inline-tag">#${escape(tag)}</span>`)
  html = html.replace(/\n/g, '<br>')
  return html
}

function extractLinks(text) {
  const matches = text.matchAll(/\[\[([^\]]+)\]\]/g)
  return [...matches].map((m) => m[1].trim())
}

function extractTagsFromContent(text) {
  const matches = text.matchAll(/#([a-zA-ZÀ-ÿ0-9_-]+)/g)
  return [...matches].map((m) => m[1].trim())
}

function extractAllTags(notes) {
  const set = new Set()
  notes.forEach((n) => {
    (n.tags || []).forEach((t) => set.add(t))
    extractTagsFromContent(n.content || '').forEach((t) => set.add(t))
  })
  return [...set].sort()
}

function filterNotes(notes) {
  let result = notes
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter((n) => n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
  }
  if (activeTag) {
    result = result.filter((n) => (n.tags || []).includes(activeTag) || extractTagsFromContent(n.content || '').includes(activeTag))
  }
  return result
}
