import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'
import { getCurrentUser } from './login.js'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtDur = (m) => { const h = Math.floor(m / 60); const mm = m % 60; return `${h}h${String(mm).padStart(2, '0')}` }

let timerInterval = null
let timerStart = null
let timerTaskId = null

export async function renderTimeTracking(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const user = getCurrentUser()
  const [{ data: entries }, { data: tasks }, { data: projects }, { data: clients }, { data: team }] = await Promise.all([
    supabase.from('time_entries').select('*').order('date', { ascending: false }),
    supabase.from('tasks').select('id,title,project_id,client_id').order('title'),
    supabase.from('projects').select('id,name'),
    supabase.from('clients').select('id,name,logo_color'),
    supabase.from('team_members').select('*'),
  ])

  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))
  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  const taskMap = Object.fromEntries((tasks || []).map((t) => [t.id, t.title]))

  const all = entries || []
  const totalMin = all.reduce((s, e) => s + (e.duration_minutes || 0), 0)
  const billableMin = all.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0)
  const billableAmount = all.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes || 0) * Number(e.hourly_rate || 0) / 60, 0)
  const thisWeek = all.filter((e) => { const d = new Date(e.date); const now = new Date(); const diff = (now - d) / 86400000; return diff < 7 })
  const weekMin = thisWeek.reduce((s, e) => s + (e.duration_minutes || 0), 0)

  // group by member
  const byMember = {}
  all.forEach((e) => { byMember[e.member_name] = (byMember[e.member_name] || 0) + (e.duration_minutes || 0) })
  const memberRows = Object.entries(byMember).sort((a, b) => b[1] - a[1])

  // group by client
  const byClient = {}
  all.forEach((e) => { if (e.client_id) { const c = clientMap[e.client_id]; if (c) byClient[c.name] = (byClient[c.name] || 0) + (e.duration_minutes || 0) } })
  const clientRows = Object.entries(byClient).sort((a, b) => b[1] - a[1])

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Suivi du temps</div><div class="page-sub">Chronométrez et facturez vos heures</div></div>
      <button class="btn btn-primary" id="add-entry">${Icon.plus(16)} Saisie manuelle</button>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Total heures</div><div class="kpi-ico tint-primary">${Icon.timer(18)}</div></div><div class="kpi-value">${fmtDur(totalMin)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Heures facturables</div><div class="kpi-ico tint-success">${Icon.dollar(18)}</div></div><div class="kpi-value" style="color:#16a34a">${fmtDur(billableMin)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Valeur facturable</div><div class="kpi-ico tint-success">${Icon.dollar(18)}</div></div><div class="kpi-value" style="color:#16a34a">${euro(billableAmount)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Cette semaine</div><div class="kpi-ico tint-warning">${Icon.calendar(18)}</div></div><div class="kpi-value">${fmtDur(weekMin)}</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-head"><div class="card-title">Chronomètre</div></div>
        <div class="card-pad" style="text-align:center">
          <div id="timer-display" style="font-size:42px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:2px;margin:10px 0">00:00:00</div>
          <div style="display:flex;gap:10px;justify-content:center;margin-bottom:14px">
            <button class="btn btn-primary" id="timer-start">${Icon.play(16)} Démarrer</button>
            <button class="btn" id="timer-stop" style="display:none">${Icon.stop(16)} Arrêter & enregistrer</button>
          </div>
          <div class="field" style="text-align:left">
            <label>Tâche associée</label>
            <select id="timer-task">
              <option value="">— Tâche libre —</option>
              ${(tasks || []).map((t) => `<option value="${t.id}">${escape(t.title)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="text-align:left">
            <label>Description</label>
            <input id="timer-desc" placeholder="Que faites-vous ?">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Par membre</div></div>
        <div style="padding:8px">
          ${memberRows.length ? memberRows.map(([name, min]) => {
            const m = (team || []).find((tm) => `${tm.first_name} ${tm.last_name}` === name)
            return `<div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
              ${m ? `<div class="avatar sm" style="background:${avatarColor(name)}">${initials(m.first_name, m.last_name)}</div>` : '<div class="avatar sm">?</div>'}
              <div style="flex:1;font-size:13px;font-weight:500">${escape(name || '—')}</div>
              <div style="font-size:13px;font-weight:600">${fmtDur(min)}</div>
            </div>`
          }).join('') : '<div class="empty">Aucune donnée</div>'}
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-head"><div class="card-title">Par client</div></div>
        <div style="padding:8px">
          ${clientRows.length ? clientRows.map(([name, min]) => {
            const c = (clients || []).find((cl) => cl.name === name)
            return `<div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
              <div class="avatar sm" style="background:${c?.logo_color || '#64748b'}">${escape((name || '?')[0])}</div>
              <div style="flex:1;font-size:13px;font-weight:500">${escape(name)}</div>
              <div style="font-size:13px;font-weight:600">${fmtDur(min)}</div>
            </div>`
          }).join('') : '<div class="empty">Aucun client lié</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Répartition facturable / non facturable</div></div>
        <div class="card-pad">
          ${(() => {
            const bill = billableMin
            const nonBill = totalMin - billableMin
            const total = totalMin || 1
            return `<div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Facturable</span><strong>${fmtDur(bill)} (${euro(bill * 50 / 60)})</strong></div>
                <div style="height:10px;background:var(--surface-2);border-radius:6px;overflow:hidden"><div style="height:100%;width:${bill / total * 100}%;background:#16a34a;border-radius:6px;transition:width .4s"></div></div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Non facturable</span><strong>${fmtDur(nonBill)}</strong></div>
                <div style="height:10px;background:var(--surface-2);border-radius:6px;overflow:hidden"><div style="height:100%;width:${nonBill / total * 100}%;background:#94a3b8;border-radius:6px;transition:width .4s"></div></div>
              </div>
            </div>`
          })()}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Toutes les entrées</div><span class="badge badge-neutral">${all.length}</span></div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Date</th><th>Description</th><th>Membre</th><th>Client</th><th>Projet</th><th>Durée</th><th>Facturable</th><th style="text-align:right">Montant</th><th></th></tr></thead>
          <tbody>
            ${all.map((e) => {
              const c = e.client_id ? clientMap[e.client_id] : null
              const amount = e.billable ? (e.duration_minutes || 0) * Number(e.hourly_rate || 0) / 60 : 0
              return `<tr>
                <td>${e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—'}</td>
                <td style="font-weight:500">${escape(e.description)}</td>
                <td>${escape(e.member_name || '—')}</td>
                <td>${c ? `<span class="tag" style="background:${c.logo_color}22;color:${c.logo_color}">${escape(c.name)}</span>` : '—'}</td>
                <td>${e.project_id ? `<span class="tag">${escape(projectMap[e.project_id] || 'Projet')}</span>` : '—'}</td>
                <td style="font-weight:600">${fmtDur(e.duration_minutes || 0)}</td>
                <td>${e.billable ? '<span class="badge badge-success">Oui</span>' : '<span class="badge badge-neutral">Non</span>'}</td>
                <td style="text-align:right;font-weight:600;color:${e.billable ? '#16a34a' : 'var(--text-3)'}">${e.billable ? euro(amount) : '—'}</td>
                <td style="text-align:right">
                  <button class="btn btn-ghost btn-sm btn-icon" data-edit="${e.id}">${Icon.edit(13)}</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-del="${e.id}">${Icon.trash(13)}</button>
                </td>
              </tr>`
            }).join('') || '<tr><td colspan="9"><div class="empty">Aucune entrée. Démarrez le chronomètre ou ajoutez une saisie manuelle.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`

  document.getElementById('add-entry').onclick = () => openForm(content, {}, user, tasks, projects, clients, team)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, all.find((e) => e.id === b.dataset.edit), user, tasks, projects, clients, team))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette entrée ?')) {
      await supabase.from('time_entries').delete().eq('id', b.dataset.del)
      toast('Entrée supprimée', 'success')
      renderTimeTracking(content)
    }
  })

  setupTimer(content, user, tasks, clients)
}

function setupTimer(content, user, tasks, clients) {
  const startBtn = document.getElementById('timer-start')
  const stopBtn = document.getElementById('timer-stop')
  const display = document.getElementById('timer-display')

  startBtn.onclick = () => {
    timerStart = Date.now()
    timerTaskId = document.getElementById('timer-task').value || null
    startBtn.style.display = 'none'
    stopBtn.style.display = 'inline-flex'
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStart) / 1000)
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
      const s = String(elapsed % 60).padStart(2, '0')
      display.textContent = `${h}:${m}:${s}`
    }, 1000)
  }

  stopBtn.onclick = async () => {
    clearInterval(timerInterval)
    const elapsedMin = Math.max(1, Math.round((Date.now() - timerStart) / 60000))
    const desc = document.getElementById('timer-desc').value.trim() || 'Travail chronométré'
    const task = (tasks || []).find((t) => t.id === timerTaskId)

    let memberName = user?.name || ''
    if (user) {
      const { data: team } = await supabase.from('team_members').select('*')
      const me = (team || []).find((m) => m.first_name.toLowerCase() === user.name.toLowerCase())
      if (me) memberName = `${me.first_name} ${me.last_name}`
    }

    const payload = {
      description: desc,
      task_id: timerTaskId || null,
      project_id: task?.project_id || null,
      client_id: task?.client_id || null,
      member_name: memberName,
      duration_minutes: elapsedMin,
      billable: true,
      hourly_rate: 50,
      date: new Date().toISOString().slice(0, 10),
    }

    const { error } = await supabase.from('time_entries').insert(payload)
    if (error) { toast('Erreur: ' + error.message, 'error') }
    else { toast(`Temps enregistré: ${fmtDur(elapsedMin)}`, 'success') }

    timerStart = null
    timerTaskId = null
    display.textContent = '00:00:00'
    document.getElementById('timer-desc').value = ''
    renderTimeTracking(content)
  }
}

async function openForm(content, entry, user, tasks, projects, clients, team) {
  let defaultMember = entry.member_name || ''
  if (!entry.id && user) {
    const me = (team || []).find((m) => m.first_name.toLowerCase() === user.name.toLowerCase())
    if (me) defaultMember = `${me.first_name} ${me.last_name}`
    else defaultMember = user.name
  }

  await modal(entry.id ? 'Modifier l\'entrée' : 'Nouvelle entrée de temps', (body) => {
    body.innerHTML = `
      <div class="field"><label>Description</label><input id="f-desc" value="${escape(entry.description || '')}" placeholder="ex: Maquette page Instagram"></div>
      <div class="form-row">
        <div class="field"><label>Membre</label><select id="f-member">
          <option value="">—</option>
          ${(team || []).map((m) => `<option value="${m.first_name} ${m.last_name}" ${defaultMember === `${m.first_name} ${m.last_name}` ? 'selected' : ''}>${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Date</label><input type="date" id="f-date" value="${entry.date || new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Durée (heures)</label><input type="number" id="f-hours" value="${Math.floor((entry.duration_minutes || 0) / 60)}" min="0" style="width:80px"></div>
        <div class="field"><label>Durée (minutes)</label><input type="number" id="f-mins" value="${(entry.duration_minutes || 0) % 60}" min="0" max="59" style="width:80px"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${entry.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${entry.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Tâche</label><select id="f-task"><option value="">—</option>${(tasks || []).map((t) => `<option value="${t.id}" ${entry.task_id === t.id ? 'selected' : ''}>${escape(t.title)}</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="field"><label>Facturable</label><select id="f-billable">
          <option value="true" ${entry.billable !== false ? 'selected' : ''}>Oui</option>
          <option value="false" ${entry.billable === false ? 'selected' : ''}>Non</option>
        </select></div>
        <div class="field"><label>Taux horaire (€/h)</label><input type="number" id="f-rate" value="${entry.hourly_rate || 50}"></div>
      </div>`
  }, async () => {
    const hours = Number(document.getElementById('f-hours').value) || 0
    const mins = Number(document.getElementById('f-mins').value) || 0
    const duration = hours * 60 + mins
    if (!duration) { toast('Durée requise', 'error'); return false }
    const payload = {
      description: document.getElementById('f-desc').value.trim() || 'Saisie manuelle',
      member_name: document.getElementById('f-member').value || '',
      date: document.getElementById('f-date').value,
      duration_minutes: duration,
      client_id: document.getElementById('f-client').value || null,
      project_id: document.getElementById('f-project').value || null,
      task_id: document.getElementById('f-task').value || null,
      billable: document.getElementById('f-billable').value === 'true',
      hourly_rate: Number(document.getElementById('f-rate').value) || 50,
    }
    if (!payload.description) { toast('Description requise', 'error'); return false }
    if (entry.id) {
      await supabase.from('time_entries').update(payload).eq('id', entry.id)
      toast('Entrée mise à jour', 'success')
    } else {
      await supabase.from('time_entries').insert(payload)
      toast('Temps enregistré', 'success')
    }
    renderTimeTracking(content)
  })
}
