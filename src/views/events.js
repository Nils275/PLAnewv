import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const DISCIPLINES = ['Rallye', 'Circuit', 'Endurance', 'F1', 'GT', 'Karting', 'Drift', 'Autre']
const STATUSES = [
  { id: 'upcoming', label: 'À venir', color: 'badge-primary' },
  { id: 'live', label: 'En direct', color: 'badge-danger' },
  { id: 'completed', label: 'Terminé', color: 'badge-success' },
  { id: 'cancelled', label: 'Annulé', color: 'badge-neutral' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

export async function renderEvents(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: events }, { data: clients }, { data: projects }] = await Promise.all([
    supabase.from('sport_events').select('*').order('start_date', { ascending: true }),
    supabase.from('clients').select('id,name,logo_color'),
    supabase.from('projects').select('id,name'),
  ])

  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))
  const all = events || []
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const upcoming = all.filter((e) => e.status === 'upcoming' && e.start_date && new Date(e.start_date) >= now)
  const live = all.filter((e) => e.status === 'live')
  const completed = all.filter((e) => e.status === 'completed')
  const podiums = completed.filter((e) => e.position && e.position <= 3).length

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Événements sportifs</div><div class="page-sub">${all.length} événement(s) · ${podiums} podium(s)</div></div>
      <button class="btn btn-primary" id="add-evt">${Icon.plus(16)} Nouvel événement</button>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">À venir</div><div class="kpi-ico tint-primary">${Icon.calendar(18)}</div></div><div class="kpi-value">${upcoming.length}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">En direct</div><div class="kpi-ico tint-warning">${Icon.flag(18)}</div></div><div class="kpi-value" style="color:#dc2626">${live.length}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Terminés</div><div class="kpi-ico tint-success">${Icon.check(18)}</div></div><div class="kpi-value">${completed.length}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Podiums</div><div class="kpi-ico tint-success">${Icon.trophy(18)}</div></div><div class="kpi-value" style="color:#16a34a">${podiums}</div></div>
    </div>

    ${upcoming.length ? `
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div class="card-title">Prochains événements</div></div>
      <div style="padding:8px">
        ${upcoming.slice(0, 5).map((e) => {
          const c = e.client_id ? clientMap[e.client_id] : null
          const days = e.start_date ? Math.ceil((new Date(e.start_date) - now) / 86400000) : 0
          return `<div style="padding:12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;cursor:pointer" data-edit="${e.id}">
            <div style="text-align:center;min-width:50px">
              <div style="font-size:20px;font-weight:800;color:var(--primary)">${days}j</div>
              <div style="font-size:10px;color:var(--text-3)">restant</div>
            </div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px">${escape(e.name)}</div>
              <div style="font-size:12px;color:var(--text-3)">${escape(e.discipline || '')} · ${escape(e.location || '—')} · ${e.start_date ? new Date(e.start_date).toLocaleDateString('fr-FR') : '—'}</div>
            </div>
            ${c ? `<span class="tag" style="background:${c.logo_color}22;color:${c.logo_color}">${escape(c.name)}</span>` : ''}
            <span class="badge ${STATUS_MAP[e.status]?.color}">${STATUS_MAP[e.status]?.label}</span>
          </div>`
        }).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-head"><div class="card-title">Tous les événements</div></div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Événement</th><th>Discipline</th><th>Lieu</th><th>Date</th><th>Statut</th><th>Pilote(s)</th><th>Position</th><th>Client</th><th></th></tr></thead>
          <tbody>
            ${all.map((e) => {
              const c = e.client_id ? clientMap[e.client_id] : null
              const posBadge = e.position === 1 ? '<span class="badge badge-warning">🥇 1er</span>' : e.position === 2 ? '<span class="badge badge-neutral">🥈 2e</span>' : e.position === 3 ? '<span class="badge badge-warning">🥉 3e</span>' : e.position ? `<span class="badge badge-neutral">${e.position}e</span>` : '—'
              return `<tr>
                <td style="font-weight:600">${escape(e.name)}</td>
                <td><span class="tag">${escape(e.discipline || '—')}</span></td>
                <td>${escape(e.location || '—')}</td>
                <td>${e.start_date ? new Date(e.start_date).toLocaleDateString('fr-FR') : '—'}</td>
                <td><span class="badge ${STATUS_MAP[e.status]?.color || 'badge-neutral'}">${STATUS_MAP[e.status]?.label || e.status}</span></td>
                <td style="font-size:12px">${escape(e.drivers || '—')}</td>
                <td>${posBadge}</td>
                <td>${c ? `<span class="tag" style="background:${c.logo_color}22;color:${c.logo_color}">${escape(c.name)}</span>` : '—'}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-ghost btn-sm btn-icon" data-edit="${e.id}">${Icon.edit(13)}</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-del="${e.id}">${Icon.trash(13)}</button>
                </td>
              </tr>`
            }).join('') || '<tr><td colspan="9"><div class="empty">Aucun événement. Ajoutez votre première course !</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`

  document.getElementById('add-evt').onclick = () => openForm(content, null, clients, projects)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, all.find((e) => e.id === b.dataset.edit), clients, projects))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cet événement ?')) {
      await supabase.from('sport_events').delete().eq('id', b.dataset.del)
      toast('Événement supprimé', 'success')
      renderEvents(content)
    }
  })
}

async function openForm(content, evt, clients, projects) {
  await modal(evt ? 'Modifier l\'événement' : 'Nouvel événement', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom de l'événement</label><input id="f-name" value="${escape(evt?.name || '')}" placeholder="ex: Rallye Monte-Carlo"></div>
      <div class="form-row">
        <div class="field"><label>Discipline</label><select id="f-discipline">${DISCIPLINES.map((d) => `<option value="${d}" ${evt?.discipline === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="field"><label>Lieu / Circuit</label><input id="f-location" value="${escape(evt?.location || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date de début</label><input type="date" id="f-start" value="${evt?.start_date || ''}"></div>
        <div class="field"><label>Date de fin</label><input type="date" id="f-end" value="${evt?.end_date || ''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">${STATUSES.map((s) => `<option value="${s.id}" ${evt?.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
        <div class="field"><label>Position</label><input type="number" id="f-position" value="${evt?.position || ''}" min="1" placeholder="ex: 1"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Pilote(s)</label><input id="f-drivers" value="${escape(evt?.drivers || '')}" placeholder="ex: Sébastien Ogier, Julien Ingrassia"></div>
        <div class="field"><label>Équipe</label><input id="f-team" value="${escape(evt?.team || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Client lié</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${evt?.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet lié</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${evt?.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Résultat</label><input id="f-result" value="${escape(evt?.result || '')}" placeholder="ex: Victoire avec 15s d'avance"></div>
      <div class="field"><label>Notes</label><textarea id="f-notes">${escape(evt?.notes || '')}</textarea></div>`
  }, async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      discipline: document.getElementById('f-discipline').value,
      location: document.getElementById('f-location').value.trim(),
      start_date: document.getElementById('f-start').value || null,
      end_date: document.getElementById('f-end').value || null,
      status: document.getElementById('f-status').value,
      position: document.getElementById('f-position').value ? Number(document.getElementById('f-position').value) : null,
      drivers: document.getElementById('f-drivers').value.trim(),
      team: document.getElementById('f-team').value.trim(),
      client_id: document.getElementById('f-client').value || null,
      project_id: document.getElementById('f-project').value || null,
      result: document.getElementById('f-result').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }
    if (evt) {
      await supabase.from('sport_events').update(payload).eq('id', evt.id)
      toast('Événement mis à jour', 'success')
    } else {
      await supabase.from('sport_events').insert(payload)
      toast('Événement créé', 'success')
    }
    renderEvents(content)
  })
}
