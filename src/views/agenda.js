import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'
import { getCurrentUser } from './login.js'

const TYPES = [
  { id: 'meeting', label: 'Réunion', color: '#7c3aed' },
  { id: 'task', label: 'Tâche', color: '#dc2626' },
  { id: 'event', label: 'Évènement', color: '#0891b2' },
  { id: 'leave', label: 'Absence/Congé', color: '#f59e0b' },
  { id: 'reminder', label: 'Rappel', color: '#2563eb' },
  { id: 'call', label: 'Appel', color: '#059669' },
  { id: 'visit', label: 'Visite', color: '#d97706' },
]

const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t]))

let viewMode = 'month'
let cursor = new Date()
let selectedMember = 'all'

export async function renderAgenda(content) {
  content.innerHTML = `<div class="spinner"></div>`
  await draw(content)
}

async function draw(content) {
  const user = getCurrentUser()
  const [{ data: events }, { data: team }] = await Promise.all([
    supabase.from('events').select('*').order('start_ts', { ascending: true }),
    supabase.from('team_members').select('*').order('first_name'),
  ])

  const teamMembers = team || []
  const allEvents = events || []

  let visibleEvents = allEvents
  if (selectedMember === 'me' && user) {
    visibleEvents = allEvents.filter((e) => {
      const assignee = (e.assigned_to || '').toLowerCase()
      return assignee.startsWith(user.name.toLowerCase() + ' ') || assignee === user.name.toLowerCase() || !assignee
    })
  } else if (selectedMember !== 'all' && selectedMember !== 'me') {
    visibleEvents = allEvents.filter((e) => {
      const assignee = (e.assigned_to || '').toLowerCase()
      const member = teamMembers.find((m) => m.id === selectedMember)
      if (!member) return false
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase()
      return assignee === fullName || assignee.startsWith(member.first_name.toLowerCase() + ' ')
    })
  }

  if (viewMode === 'month') {
    drawMonth(content, visibleEvents, teamMembers, user)
  } else if (viewMode === 'week') {
    drawWeek(content, visibleEvents, teamMembers, user)
  } else {
    drawDay(content, visibleEvents, teamMembers, user)
  }
}

function memberSelector(teamMembers, user) {
  const options = [
    { value: 'all', label: 'Tout le monde' },
    { value: 'me', label: 'Mon agenda' },
    ...teamMembers.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` })),
  ]
  return `
    <select id="member-filter" style="height:34px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font-size:13px;cursor:pointer;outline:none">
      ${options.map((o) => `<option value="${o.value}" ${selectedMember === o.value ? 'selected' : ''}>${escape(o.label)}</option>`).join('')}
    </select>`
}

function eventColor(e) {
  if (e.color) return e.color
  const t = TYPE_MAP[e.type] || TYPES[0]
  return t.color
}

function eventTag(e) {
  const t = TYPE_MAP[e.type] || TYPES[0]
  return t
}

function drawMonth(content, events, teamMembers, user) {
  const y = cursor.getFullYear(), m = cursor.getMonth()
  const first = new Date(y, m, 1)
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
  while (cells.length % 7 !== 0) cells.push(null)

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Agenda</div><div class="page-sub">Vos tâches y apparaissent automatiquement · Vue partagée</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${memberSelector(teamMembers, user)}
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm view-opt ${viewMode==='day'?'btn-primary':''}" data-view="day">Jour</button>
          <button class="btn btn-sm view-opt ${viewMode==='week'?'btn-primary':''}" data-view="week">Semaine</button>
          <button class="btn btn-sm view-opt ${viewMode==='month'?'btn-primary':''}" data-view="month">Mois</button>
        </div>
        <button class="btn btn-sm" id="prev">${Icon.arrow(14)}</button>
        <div style="font-weight:600;font-size:14px;min-width:140px;text-align:center">${cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        <button class="btn btn-sm" id="next" style="transform:rotate(180deg)">${Icon.arrow(14)}</button>
        <button class="btn btn-sm" id="today">Aujourd'hui</button>
        <button class="btn btn-primary btn-sm" id="add-event">${Icon.plus(14)} Évènement</button>
      </div>
    </div>
    <div class="card" style="overflow:hidden">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--border)">
        ${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d) => `<div style="padding:10px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-3);text-align:center;border-right:1px solid var(--border)">${d}</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr)">
        ${cells.map((dt) => {
          if (!dt) return `<div style="min-height:96px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface-2)"></div>`
          const dayEvents = events.filter((e) => {
            if (!e.start_ts) return false
            const ed = new Date(e.start_ts)
            return ed.getDate() === dt.getDate() && ed.getMonth() === dt.getMonth() && ed.getFullYear() === dt.getFullYear()
          })
          const isToday = dt.toDateString() === new Date().toDateString()
          return `
            <div style="min-height:96px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:6px;cursor:pointer" data-day="${dt.toISOString()}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-size:12px;font-weight:${isToday?'700':'500'};color:${isToday?'var(--primary)':'var(--text-2)'};width:22px;height:22px;border-radius:50%;display:grid;place-items:center;${isToday?'background:var(--primary-soft)':''}">${dt.getDate()}</span>
              </div>
              ${dayEvents.slice(0, 3).map((e) => {
                const c = eventColor(e)
                return `<div style="font-size:11px;padding:3px 6px;border-radius:4px;background:${c}22;color:${c};margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escape(e.title)}">${escape(e.title)}</div>`
              }).join('')}
              ${dayEvents.length > 3 ? `<div style="font-size:10px;color:var(--text-3)">+${dayEvents.length - 3}</div>` : ''}
            </div>`
        }).join('')}
      </div>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;padding:0 4px">
      ${TYPES.map((t) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-3)"><span style="width:10px;height:10px;border-radius:3px;background:${t.color}"></span>${t.label}</div>`).join('')}
    </div>`

  wireNav(content)
  wireMemberFilter(content)
  document.getElementById('add-event').onclick = () => openForm(content, {}, teamMembers, user)
  content.querySelectorAll('[data-day]').forEach((c) => c.onclick = () => {
    const dt = new Date(c.dataset.day)
    openForm(content, { start_ts: dt.toISOString() }, teamMembers, user)
  })
  content.querySelectorAll('.view-opt').forEach((b) => b.onclick = () => { viewMode = b.dataset.view; draw(content) })
}

function drawWeek(content, events, teamMembers, user) {
  const monday = new Date(cursor)
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Agenda — Semaine</div><div class="page-sub">${days[0].toLocaleDateString('fr-FR')} → ${days[6].toLocaleDateString('fr-FR')}</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${memberSelector(teamMembers, user)}
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm view-opt ${viewMode==='day'?'btn-primary':''}" data-view="day">Jour</button>
          <button class="btn btn-sm view-opt ${viewMode==='week'?'btn-primary':''}" data-view="week">Semaine</button>
          <button class="btn btn-sm view-opt ${viewMode==='month'?'btn-primary':''}" data-view="month">Mois</button>
        </div>
        <button class="btn btn-sm" id="prev">${Icon.arrow(14)}</button>
        <button class="btn btn-sm" id="next" style="transform:rotate(180deg)">${Icon.arrow(14)}</button>
        <button class="btn btn-sm" id="today">Aujourd'hui</button>
        <button class="btn btn-primary btn-sm" id="add-event">${Icon.plus(14)} Évènement</button>
      </div>
    </div>
    <div class="card" style="overflow:hidden">
      ${days.map((dt) => {
        const dayEvents = events.filter((e) => {
          if (!e.start_ts) return false
          return new Date(e.start_ts).toDateString() === dt.toDateString()
        })
        const isToday = dt.toDateString() === new Date().toDateString()
        return `
          <div style="display:flex;border-bottom:1px solid var(--border);min-height:80px">
            <div style="width:90px;padding:10px;border-right:1px solid var(--border);flex-shrink:0">
              <div style="font-size:11px;color:var(--text-3);text-transform:uppercase">${dt.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
              <div style="font-size:18px;font-weight:700;color:${isToday?'var(--primary)':'var(--text)'}">${dt.getDate()}</div>
            </div>
            <div style="flex:1;padding:8px;display:flex;flex-direction:column;gap:5px" data-day="${dt.toISOString()}">
              ${dayEvents.map((e) => {
                const c = eventColor(e)
                const t = eventTag(e)
                const time = e.start_ts ? new Date(e.start_ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
                return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;background:${c}22;cursor:pointer" data-edit="${e.id}">
                  <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>
                  <span style="font-size:11px;color:var(--text-3);min-width:40px">${time}</span>
                  <span style="font-size:13px;font-weight:500">${escape(e.title)}</span>
                  ${e.assigned_to ? `<span style="font-size:10px;color:var(--text-3);margin-left:auto">${escape(e.assigned_to)}</span>` : ''}
                </div>`
              }).join('') || '<div style="color:var(--text-3);font-size:12px;padding:6px">—</div>'}
            </div>
          </div>`
      }).join('')}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;padding:0 4px">
      ${TYPES.map((t) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-3)"><span style="width:10px;height:10px;border-radius:3px;background:${t.color}"></span>${t.label}</div>`).join('')}
    </div>`

  wireNav(content)
  wireMemberFilter(content)
  document.getElementById('add-event').onclick = () => openForm(content, {}, teamMembers, user)
  content.querySelectorAll('[data-day]').forEach((c) => c.onclick = (e) => { if (e.target.closest('[data-edit]')) return; openForm(content, { start_ts: c.dataset.day }, teamMembers, user) })
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); openForm(content, events.find((x) => x.id === b.dataset.edit), teamMembers, user) })
  content.querySelectorAll('.view-opt').forEach((b) => b.onclick = () => { viewMode = b.dataset.view; draw(content) })
}

function drawDay(content, events, teamMembers, user) {
  const dayEvents = events.filter((e) => {
    if (!e.start_ts) return false
    return new Date(e.start_ts).toDateString() === cursor.toDateString()
  })
  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Agenda — ${cursor.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div><div class="page-sub">${dayEvents.length} évènement(s)</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${memberSelector(teamMembers, user)}
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm view-opt ${viewMode==='day'?'btn-primary':''}" data-view="day">Jour</button>
          <button class="btn btn-sm view-opt ${viewMode==='week'?'btn-primary':''}" data-view="week">Semaine</button>
          <button class="btn btn-sm view-opt ${viewMode==='month'?'btn-primary':''}" data-view="month">Mois</button>
        </div>
        <button class="btn btn-sm" id="prev">${Icon.arrow(14)}</button>
        <button class="btn btn-sm" id="next" style="transform:rotate(180deg)">${Icon.arrow(14)}</button>
        <button class="btn btn-sm" id="today">Aujourd'hui</button>
        <button class="btn btn-primary btn-sm" id="add-event">${Icon.plus(14)} Évènement</button>
      </div>
    </div>
    <div class="card card-pad">
      ${dayEvents.map((e) => {
        const c = eventColor(e)
        const t = eventTag(e)
        const time = e.start_ts ? new Date(e.start_ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border);cursor:pointer" data-edit="${e.id}">
            <span style="width:10px;height:10px;border-radius:50%;background:${c}"></span>
            <div style="font-size:13px;color:var(--text-3);min-width:60px">${time}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600">${escape(e.title)}</div>
              ${e.location ? `<div style="font-size:12px;color:var(--text-3)">📍 ${escape(e.location)}</div>` : ''}
            </div>
            ${e.assigned_to ? `<span style="font-size:11px;color:var(--text-3)">${escape(e.assigned_to)}</span>` : ''}
            <span class="badge badge-neutral">${t.label}</span>
          </div>`
      }).join('') || '<div class="empty">Aucun évènement ce journée</div>'}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;padding:0 4px">
      ${TYPES.map((t) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-3)"><span style="width:10px;height:10px;border-radius:3px;background:${t.color}"></span>${t.label}</div>`).join('')}
    </div>`

  wireNav(content)
  wireMemberFilter(content)
  document.getElementById('add-event').onclick = () => openForm(content, { start_ts: cursor.toISOString() }, teamMembers, user)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, events.find((x) => x.id === b.dataset.edit), teamMembers, user))
  content.querySelectorAll('.view-opt').forEach((b) => b.onclick = () => { viewMode = b.dataset.view; draw(content) })
}

function wireNav(content) {
  const prev = document.getElementById('prev')
  const next = document.getElementById('next')
  const today = document.getElementById('today')
  if (prev) prev.onclick = () => { move(-1); draw(content) }
  if (next) next.onclick = () => { move(1); draw(content) }
  if (today) today.onclick = () => { cursor = new Date(); draw(content) }
}

function wireMemberFilter(content) {
  const filter = content.querySelector('#member-filter')
  if (filter) filter.onchange = () => { selectedMember = filter.value; draw(content) }
}

function move(dir) {
  if (viewMode === 'month') cursor.setMonth(cursor.getMonth() + dir)
  else if (viewMode === 'week') cursor.setDate(cursor.getDate() + dir * 7)
  else cursor.setDate(cursor.getDate() + dir)
}

async function openForm(content, ev = {}, teamMembers, user) {
  const { data: projects } = await supabase.from('projects').select('id,name')
  const startVal = ev.start_ts ? new Date(ev.start_ts).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)

  let defaultAssignee = ev.assigned_to || ''
  if (!ev.id && user && !defaultAssignee) {
    const me = (teamMembers || []).find((m) => m.first_name.toLowerCase() === user.name.toLowerCase())
    if (me) defaultAssignee = `${me.first_name} ${me.last_name}`
  }

  await modal(ev.id ? 'Modifier' : 'Nouvel évènement', (body) => {
    body.innerHTML = `
      <div class="field"><label>Titre</label><input id="f-title" value="${escape(ev.title || '')}"></div>
      <div class="form-row">
        <div class="field"><label>Type</label><select id="f-type">${TYPES.map((t) => `<option value="${t.id}" ${ev.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${ev.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Assigné à</label><select id="f-assignee"><option value="">—</option>${(teamMembers || []).map((m) => `<option value="${m.first_name} ${m.last_name}" ${defaultAssignee === `${m.first_name} ${m.last_name}` ? 'selected' : ''}>${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select></div>
        <div class="field"><label>Début</label><input type="datetime-local" id="f-start" value="${startVal}"></div>
      </div>
      <div class="field"><label>Lieu</label><input id="f-loc" value="${escape(ev.location || '')}"></div>
      <div class="field"><label>Notes</label><textarea id="f-notes">${escape(ev.notes || '')}</textarea></div>`
  }, async () => {
    const type = document.getElementById('f-type').value
    const t = TYPES.find((x) => x.id === type) || TYPES[0]
    const payload = {
      title: document.getElementById('f-title').value.trim(),
      type,
      color: t.color,
      start_ts: document.getElementById('f-start').value ? new Date(document.getElementById('f-start').value).toISOString() : null,
      project_id: document.getElementById('f-project').value || null,
      assigned_to: document.getElementById('f-assignee').value,
      location: document.getElementById('f-loc').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
    }
    if (!payload.title) { toast('Titre requis', 'error'); return false }
    if (ev.id) {
      await supabase.from('events').update(payload).eq('id', ev.id)
      toast('Évènement mis à jour', 'success')
    } else {
      await supabase.from('events').insert(payload)
      toast('Évènement créé', 'success')
    }
    draw(content)
  })
}
