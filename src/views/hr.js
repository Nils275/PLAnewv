import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'
import { getCurrentUser } from './login.js'

const LEAVE_TYPES = [
  { value: 'leave', label: 'Congé' },
  { value: 'sick', label: 'Maladie' },
  { value: 'telework', label: 'Télétravail' },
  { value: 'absence', label: 'Absence' },
  { value: 'training', label: 'Formation' },
]
const LEAVE_STATUS = ['pending', 'approved', 'rejected']
const DEPARTMENTS = ['Direction', 'Commercial', 'Création', 'Technique', 'Administration', 'Communication']
const ROLES = ['Manager', 'Salarié', 'Freelance', 'Stagiaire', 'Alternant']

export async function renderHR(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const [members, leaves, objectives, onboarding] = await Promise.all([
    supabase.from('team_members').select('*').order('first_name'),
    supabase.from('hr_leaves').select('*,member:team_members(first_name,last_name)').order('created_at', { ascending: false }),
    supabase.from('hr_objectives').select('*,member:team_members(first_name,last_name)'),
    supabase.from('hr_onboarding_tasks').select('*,member:team_members(first_name,last_name)'),
  ])

  const m = members.data || []
  const lv = leaves.data || []
  const ob = objectives.data || []
  const onb = onboarding.data || []

  const activeMembers = m.filter((x) => x.status === 'active').length
  const pendingLeaves = lv.filter((x) => x.status === 'pending').length
  const onLeaveToday = lv.filter((x) => x.status === 'approved' && new Date(x.start_date) <= new Date() && new Date(x.end_date) >= new Date()).length
  const activeObjectives = ob.filter((x) => x.status === 'active').length
  const onboardingPending = onb.filter((x) => !x.completed).length

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Gestion des employés / RH</div>
        <div class="page-sub">Annuaire, congés, objectifs, onboarding</div>
      </div>
      <button class="btn btn-primary" id="add-member">${Icon.users(16)} Ajouter un collaborateur</button>
    </div>

    <div class="grid grid-5" style="margin-bottom:18px">
      ${kpiBox('Collaborateurs actifs', activeMembers, Icon.team(18), 'tint-primary')}
      ${kpiBox('Congés en attente', pendingLeaves, Icon.calendar(18), 'tint-warning')}
      ${kpiBox('Absents aujourd\'hui', onLeaveToday, Icon.close(18), 'tint-danger')}
      ${kpiBox('Objectifs actifs', activeObjectives, Icon.trend(18), 'tint-success')}
      ${kpiBox('Onboarding en cours', onboardingPending, Icon.tasks(18), 'tint-accent')}
    </div>

    <div class="seg-toggle" style="margin-bottom:18px" id="hr-tabs">
      <button class="seg-btn active" data-tab="directory">Annuaire</button>
      <button class="seg-btn" data-tab="leaves">Congés & Absences</button>
      <button class="seg-btn" data-tab="objectives">Objectifs</button>
      <button class="seg-btn" data-tab="onboarding">Onboarding</button>
    </div>

    <div id="hr-tab-content"></div>
  `

  const tabContent = content.querySelector('#hr-tab-content')
  const tabs = content.querySelectorAll('#hr-tabs .seg-btn')
  tabs.forEach((tab) => tab.onclick = () => {
    tabs.forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    renderTab(tab.dataset.tab, tabContent, m, lv, ob, onb)
  })
  renderTab('directory', tabContent, m, lv, ob, onb)

  content.querySelector('#add-member').onclick = () => openMemberModal(m, () => renderHR(content))
}

function renderTab(tab, el, members, leaves, objectives, onboarding) {
  if (tab === 'directory') renderDirectory(el, members)
  else if (tab === 'leaves') renderLeaves(el, leaves, members)
  else if (tab === 'objectives') renderObjectives(el, objectives, members)
  else if (tab === 'onboarding') renderOnboarding(el, onboarding, members)
}

function renderDirectory(el, members) {
  el.innerHTML = `
    <div class="team-grid">
      ${members.map((m) => `
        <div class="card team-card" data-member="${m.id}">
          <div class="avatar lg" style="background:${avatarColor(m.first_name + m.last_name)}">${initials(m.first_name, m.last_name)}</div>
          <div class="team-name">${escape(m.first_name)} ${escape(m.last_name)}</div>
          <div class="team-role">${escape(m.role || '—')}</div>
          <div class="team-dept">${escape(m.department || '—')}</div>
          <span class="badge ${m.status === 'active' ? 'badge-success' : 'badge-neutral'}">${m.status}</span>
          <div class="team-contact">
            ${m.email ? `<span>${escape(m.email)}</span>` : ''}
            ${m.phone ? `<span>${escape(m.phone)}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn btn-sm btn-ghost edit-member" data-id="${m.id}">Modifier</button>
            <button class="btn btn-sm btn-ghost btn-danger del-member" data-id="${m.id}">Supprimer</button>
          </div>
        </div>`).join('') || '<div class="empty">Aucun collaborateur</div>'}
    </div>`

  el.querySelectorAll('.edit-member').forEach((b) => b.onclick = () => {
    const member = members.find((x) => x.id === b.dataset.id)
    openMemberModal(members, () => renderHR(el.closest('#content')), member)
  })
  el.querySelectorAll('.del-member').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer ce collaborateur ?')) return
    await supabase.from('team_members').delete().eq('id', b.dataset.id)
    toast('Collaborateur supprimé', 'success')
    renderHR(el.closest('#content'))
  })
  el.querySelectorAll('[data-member]').forEach((c) => c.onclick = (e) => {
    if (e.target.closest('button')) return
    const member = members.find((x) => x.id === c.dataset.member)
    openProfileModal(member)
  })
}

function renderLeaves(el, leaves, members) {
  el.innerHTML = `
    <div style="margin-bottom:14px">
      <button class="btn btn-primary" id="add-leave">${Icon.calendar(16)} Demander un congé</button>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Collaborateur</th><th>Type</th><th>Début</th><th>Fin</th><th>Statut</th><th>Motif</th><th></th></tr></thead>
        <tbody>
          ${leaves.map((l) => `
            <tr>
              <td>${escape(l.member?.first_name || '')} ${escape(l.member?.last_name || '')}</td>
              <td><span class="badge ${l.type === 'sick' ? 'badge-danger' : l.type === 'telework' ? 'badge-primary' : 'badge-neutral'}">${leaveLabel(l.type)}</span></td>
              <td>${new Date(l.start_date).toLocaleDateString('fr-FR')}</td>
              <td>${new Date(l.end_date).toLocaleDateString('fr-FR')}</td>
              <td><span class="badge ${l.status === 'approved' ? 'badge-success' : l.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${l.status}</span></td>
              <td>${escape(l.reason || '—')}</td>
              <td>
                ${l.status === 'pending' ? `<button class="btn btn-sm approve-leave" data-id="${l.id}">Approuver</button> <button class="btn btn-sm btn-danger reject-leave" data-id="${l.id}">Refuser</button>` : ''}
                <button class="btn btn-sm btn-ghost btn-danger del-leave" data-id="${l.id}">Supprimer</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Aucune demande</td></tr>'}
        </tbody>
      </table>
    </div>`

  el.querySelector('#add-leave').onclick = () => openLeaveModal(members, () => renderHR(el.closest('#content')))
  el.querySelectorAll('.approve-leave').forEach((b) => b.onclick = async () => {
    await supabase.from('hr_leaves').update({ status: 'approved' }).eq('id', b.dataset.id)
    toast('Congé approuvé', 'success')
    renderHR(el.closest('#content'))
  })
  el.querySelectorAll('.reject-leave').forEach((b) => b.onclick = async () => {
    await supabase.from('hr_leaves').update({ status: 'rejected' }).eq('id', b.dataset.id)
    toast('Congé refusé', 'info')
    renderHR(el.closest('#content'))
  })
  el.querySelectorAll('.del-leave').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer cette demande ?')) return
    await supabase.from('hr_leaves').delete().eq('id', b.dataset.id)
    renderHR(el.closest('#content'))
  })
}

function renderObjectives(el, objectives, members) {
  el.innerHTML = `
    <div style="margin-bottom:14px">
      <button class="btn btn-primary" id="add-obj">${Icon.trend(16)} Nouvel objectif</button>
    </div>
    <div class="grid grid-2">
      ${objectives.map((o) => `
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div>
              <div style="font-weight:600;font-size:14px">${escape(o.title)}</div>
              <div style="font-size:12px;color:var(--text-3)">${escape(o.member?.first_name || '')} ${escape(o.member?.last_name || '')}</div>
            </div>
            <span class="badge ${o.status === 'active' ? 'badge-primary' : o.status === 'done' ? 'badge-success' : 'badge-neutral'}">${o.status}</span>
          </div>
          ${o.description ? `<div style="font-size:13px;color:var(--text-2);margin-bottom:8px">${escape(o.description)}</div>` : ''}
          <div class="progress" style="margin-bottom:6px"><div class="progress-fill" style="width:${o.progress || 0}%"></div></div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:var(--text-3)">${o.progress || 0}%</span>
            ${o.due_date ? `<span style="font-size:12px;color:var(--text-3)">Échéance: ${new Date(o.due_date).toLocaleDateString('fr-FR')}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn btn-sm btn-ghost edit-obj" data-id="${o.id}">Modifier</button>
            <button class="btn btn-sm btn-ghost btn-danger del-obj" data-id="${o.id}">Supprimer</button>
          </div>
        </div>`).join('') || '<div class="empty">Aucun objectif</div>'}
    </div>`

  el.querySelector('#add-obj').onclick = () => openObjectiveModal(members, () => renderHR(el.closest('#content')))
  el.querySelectorAll('.edit-obj').forEach((b) => b.onclick = () => {
    const obj = objectives.find((x) => x.id === b.dataset.id)
    openObjectiveModal(members, () => renderHR(el.closest('#content')), obj)
  })
  el.querySelectorAll('.del-obj').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer cet objectif ?')) return
    await supabase.from('hr_objectives').delete().eq('id', b.dataset.id)
    renderHR(el.closest('#content'))
  })
}

function renderOnboarding(el, onboarding, members) {
  const grouped = {}
  onboarding.forEach((t) => {
    const key = t.member_id
    if (!grouped[key]) grouped[key] = { member: t.member, tasks: [] }
    grouped[key].tasks.push(t)
  })

  el.innerHTML = `
    <div style="margin-bottom:14px">
      <button class="btn btn-primary" id="add-onb">${Icon.tasks(16)} Ajouter une tâche onboarding</button>
    </div>
    <div class="grid grid-2">
      ${Object.values(grouped).map((g) => {
        const done = g.tasks.filter((t) => t.completed).length
        return `
          <div class="card card-pad">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:10px">
                <div class="avatar sm" style="background:${avatarColor((g.member?.first_name || '') + (g.member?.last_name || ''))}">${initials(g.member?.first_name, g.member?.last_name)}</div>
                <div style="font-weight:600;font-size:14px">${escape(g.member?.first_name || '')} ${escape(g.member?.last_name || '')}</div>
              </div>
              <span class="badge badge-primary">${done}/${g.tasks.length}</span>
            </div>
            ${g.tasks.map((t) => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                <input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}" class="onb-check" style="width:18px;height:18px">
                <span style="flex:1;font-size:13px;${t.completed ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${escape(t.title)}</span>
                ${t.due_date ? `<span style="font-size:11px;color:var(--text-3)">${new Date(t.due_date).toLocaleDateString('fr-FR')}</span>` : ''}
                <button class="btn btn-sm btn-ghost btn-danger del-onb" data-id="${t.id}">×</button>
              </div>`).join('')}
          </div>`
      }).join('') || '<div class="empty">Aucune tâche d\'onboarding</div>'}
    </div>`

  el.querySelector('#add-onb').onclick = () => openOnboardingModal(members, () => renderHR(el.closest('#content')))
  el.querySelectorAll('.onb-check').forEach((c) => c.onchange = async () => {
    await supabase.from('hr_onboarding_tasks').update({ completed: c.checked }).eq('id', c.dataset.id)
    renderHR(el.closest('#content'))
  })
  el.querySelectorAll('.del-onb').forEach((b) => b.onclick = async () => {
    await supabase.from('hr_onboarding_tasks').delete().eq('id', b.dataset.id)
    renderHR(el.closest('#content'))
  })
}

function openMemberModal(members, onDone, existing) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier le collaborateur' : 'Nouveau collaborateur', (body) => {
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Prénom</label><input id="m-first" value="${escape(existing?.first_name || '')}"></div>
        <div class="field"><label>Nom</label><input id="m-last" value="${escape(existing?.last_name || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Fonction</label><input id="m-role" value="${escape(existing?.role || '')}" placeholder="Ex: Chef de projet"></div>
        <div class="field"><label>Service</label>
          <select id="m-dept">${DEPARTMENTS.map((d) => `<option ${existing?.department === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Email</label><input id="m-email" type="email" value="${escape(existing?.email || '')}"></div>
        <div class="field"><label>Téléphone</label><input id="m-phone" value="${escape(existing?.phone || '')}"></div>
      </div>
      <div class="field"><label>Statut</label>
        <select id="m-status">
          <option value="active" ${existing?.status === 'active' ? 'selected' : ''}>Actif</option>
          <option value="away" ${existing?.status === 'away' ? 'selected' : ''}>Absent</option>
          <option value="inactive" ${existing?.status === 'inactive' ? 'selected' : ''}>Inactif</option>
        </select>
      </div>`
  }, async (body) => {
    const first = body.querySelector('#m-first').value.trim()
    const last = body.querySelector('#m-last').value.trim()
    if (!first || !last) { toast('Nom requis', 'error'); return false }
    const payload = {
      first_name: first,
      last_name: last,
      role: body.querySelector('#m-role').value.trim(),
      department: body.querySelector('#m-dept').value,
      email: body.querySelector('#m-email').value.trim(),
      phone: body.querySelector('#m-phone').value.trim(),
      status: body.querySelector('#m-status').value,
    }
    if (isEdit) {
      await supabase.from('team_members').update(payload).eq('id', existing.id)
      toast('Collaborateur modifié', 'success')
    } else {
      await supabase.from('team_members').insert(payload)
      toast('Collaborateur ajouté', 'success')
    }
    onDone()
  })
}

function openProfileModal(member) {
  modal(`Profil — ${member.first_name} ${member.last_name}`, (body) => {
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
        <div class="avatar lg" style="background:${avatarColor(member.first_name + member.last_name)}">${initials(member.first_name, member.last_name)}</div>
        <div>
          <div style="font-size:18px;font-weight:700">${escape(member.first_name)} ${escape(member.last_name)}</div>
          <div style="font-size:14px;color:var(--text-3)">${escape(member.role || '—')} · ${escape(member.department || '—')}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div><strong>Email:</strong> ${escape(member.email || '—')}</div>
        <div><strong>Téléphone:</strong> ${escape(member.phone || '—')}</div>
        <div><strong>Statut:</strong> <span class="badge ${member.status === 'active' ? 'badge-success' : 'badge-neutral'}">${member.status}</span></div>
      </div>`
  }, null, { noFooter: true })
}

function openLeaveModal(members, onDone) {
  modal('Demander un congé', (body) => {
    body.innerHTML = `
      <div class="field"><label>Collaborateur</label>
        <select id="l-member">${members.map((m) => `<option value="${m.id}">${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Type</label>
        <select id="l-type">${LEAVE_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="field"><label>Début</label><input id="l-start" type="date"></div>
        <div class="field"><label>Fin</label><input id="l-end" type="date"></div>
      </div>
      <div class="field"><label>Motif</label><textarea id="l-reason" placeholder="Optionnel"></textarea></div>`
  }, async (body) => {
    const payload = {
      member_id: body.querySelector('#l-member').value,
      type: body.querySelector('#l-type').value,
      start_date: body.querySelector('#l-start').value,
      end_date: body.querySelector('#l-end').value,
      reason: body.querySelector('#l-reason').value.trim(),
      status: 'pending',
    }
    if (!payload.start_date || !payload.end_date) { toast('Dates requises', 'error'); return false }
    await supabase.from('hr_leaves').insert(payload)
    toast('Demande créée', 'success')
    onDone()
  })
}

function openObjectiveModal(members, onDone, existing) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier l\'objectif' : 'Nouvel objectif', (body) => {
    body.innerHTML = `
      <div class="field"><label>Collaborateur</label>
        <select id="o-member">${members.map((m) => `<option value="${m.id}" ${existing?.member_id === m.id ? 'selected' : ''}>${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Titre</label><input id="o-title" value="${escape(existing?.title || '')}"></div>
      <div class="field"><label>Description</label><textarea id="o-desc">${escape(existing?.description || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Échéance</label><input id="o-due" type="date" value="${existing?.due_date || ''}"></div>
        <div class="field"><label>Progression (%)</label><input id="o-progress" type="number" min="0" max="100" value="${existing?.progress || 0}"></div>
      </div>
      <div class="field"><label>Statut</label>
        <select id="o-status">
          <option value="active" ${existing?.status === 'active' ? 'selected' : ''}>En cours</option>
          <option value="done" ${existing?.status === 'done' ? 'selected' : ''}>Terminé</option>
          <option value="paused" ${existing?.status === 'paused' ? 'selected' : ''}>En pause</option>
        </select>
      </div>`
  }, async (body) => {
    const title = body.querySelector('#o-title').value.trim()
    if (!title) { toast('Titre requis', 'error'); return false }
    const payload = {
      member_id: body.querySelector('#o-member').value,
      title,
      description: body.querySelector('#o-desc').value.trim(),
      due_date: body.querySelector('#o-due').value || null,
      progress: parseInt(body.querySelector('#o-progress').value) || 0,
      status: body.querySelector('#o-status').value,
    }
    if (isEdit) {
      await supabase.from('hr_objectives').update(payload).eq('id', existing.id)
      toast('Objectif modifié', 'success')
    } else {
      await supabase.from('hr_objectives').insert(payload)
      toast('Objectif créé', 'success')
    }
    onDone()
  })
}

function openOnboardingModal(members, onDone) {
  modal('Tâche d\'onboarding', (body) => {
    body.innerHTML = `
      <div class="field"><label>Collaborateur</label>
        <select id="on-member">${members.map((m) => `<option value="${m.id}">${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Tâche</label><input id="on-title" placeholder="Ex: Signature du contrat"></div>
      <div class="field"><label>Échéance</label><input id="on-due" type="date"></div>`
  }, async (body) => {
    const title = body.querySelector('#on-title').value.trim()
    if (!title) { toast('Titre requis', 'error'); return false }
    await supabase.from('hr_onboarding_tasks').insert({
      member_id: body.querySelector('#on-member').value,
      title,
      due_date: body.querySelector('#on-due').value || null,
    })
    toast('Tâche ajoutée', 'success')
    onDone()
  })
}

function leaveLabel(type) {
  return LEAVE_TYPES.find((t) => t.value === type)?.label || type
}

function kpiBox(label, value, icon, tint) {
  return `
    <div class="card kpi">
      <div class="kpi-top"><div class="kpi-label">${label}</div><div class="kpi-ico ${tint}">${icon}</div></div>
      <div class="kpi-value">${value}</div>
    </div>`
}
