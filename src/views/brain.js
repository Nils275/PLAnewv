import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

let currentView = 'graph'
let selectedNoteId = null
let searchQuery = ''
let activeTag = null

export async function renderBrain(content) {
  content.innerHTML = `<div class="spinner"></div>`
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
      ${currentView === 'graph' ? drawGraph(filtered, notes) : drawList(filtered, notes)}
    </div>
  `

  content.querySelector('#add-note').onclick = () => openNoteForm(content, notes, null)
  content.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { currentView = b.dataset.view; drawView(content, notes) })

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
                <span style="width:10px;height:10px;border-radius:50%;background:${n.color || '#2563eb'};flex-shrink:0"></span>
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

function drawGraph(notes, allNotes) {
  if (!notes.length && !allNotes.length) return '<div class="empty">Aucune note. Cliquez sur "Nouvelle note" pour commencer.</div>'

  const links = []
  const noteMap = new Map(allNotes.map((n) => [n.title.toLowerCase(), n]))
  notes.forEach((n) => {
    const refs = extractLinks(n.content)
    refs.forEach((ref) => {
      const target = noteMap.get(ref.toLowerCase())
      if (target) links.push({ source: n.id, target: target.id, sourceTitle: n.title, targetTitle: target.title })
    })
  })

  const w = 800, h = 500
  const cx = w / 2, cy = h / 2
  const nodes = notes.map((n, i) => {
    const angle = (i / notes.length) * 2 * Math.PI
    const radius = notes.length <= 2 ? 80 : notes.length <= 5 ? 130 : notes.length <= 10 ? 180 : 200
    return {
      id: n.id,
      title: n.title,
      color: n.color || '#2563eb',
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      linkCount: links.filter((l) => l.source === n.id || l.target === n.id).length,
    }
  })

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const validLinks = links.filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))

  return `
    <div class="card" style="overflow:hidden;padding:0">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:600;font-size:14px">Graphe des connaissances</div>
        <div style="font-size:12px;color:var(--text-3)">${nodes.length} noeuds · ${validLinks.length} liens</div>
      </div>
      <div class="brain-graph-wrap">
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:500px;cursor:default">
          <defs>
            <marker id="arrow-brain" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-3)" opacity=".4"/>
            </marker>
          </defs>
          ${validLinks.map((l) => {
            const s = nodeMap.get(l.source)
            const t = nodeMap.get(l.target)
            const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
            const dx = t.x - s.x, dy = t.y - s.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const offset = 28
            const ex = t.x - (dx / dist) * offset
            const ey = t.y - (dy / dist) * offset
            return `<line x1="${s.x}" y1="${s.y}" x2="${ex}" y2="${ey}" stroke="var(--border-strong)" stroke-width="1.5" opacity=".5" marker-end="url(#arrow-brain)"/>`
          }).join('')}
          ${nodes.map((n) => {
            const r = 18 + Math.min(n.linkCount * 3, 12)
            return `
              <g class="brain-node" data-note-id="${n.id}" style="cursor:pointer">
                <circle cx="${n.x}" cy="${n.y}" r="${r + 4}" fill="${n.color}" opacity=".12"/>
                <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${n.color}" opacity=".85" stroke="${n.color}" stroke-width="2"/>
                <text x="${n.x}" y="${n.y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff" pointer-events="none">${escape(n.title.slice(0, 10))}</text>
                ${n.linkCount > 0 ? `<text x="${n.x + r - 2}" y="${n.y - r + 2}" text-anchor="middle" font-size="8" fill="var(--text-3)" pointer-events="none">${n.linkCount}</text>` : ''}
              </g>`
          }).join('')}
        </svg>
      </div>
    </div>

    <div style="margin-top:16px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-2)">Toutes les notes</div>
      <div class="brain-chips">
        ${notes.map((n) => `
          <button class="brain-chip" data-note-id="${n.id}" style="--chip-color:${n.color || '#2563eb'}">
            <span style="width:8px;height:8px;border-radius:50%;background:${n.color || '#2563eb'};flex-shrink:0"></span>
            ${escape(n.title)}
          </button>`).join('')}
      </div>
    </div>`
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
              <button class="brain-chip" data-note-id="${ln.id}" style="--chip-color:${ln.color || '#2563eb'}">
                <span style="width:8px;height:8px;border-radius:50%;background:${ln.color || '#2563eb'};flex-shrink:0"></span>
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
  const allTags = extractAllTags(notes)
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
