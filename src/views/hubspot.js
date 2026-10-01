import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

const LIFECYCLE_STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'qualified', label: 'Qualifié' },
  { id: 'opportunity', label: 'Opportunité' },
  { id: 'customer', label: 'Client' },
  { id: 'champion', label: 'Ambassadeur' },
]

const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const TICKET_STATUS = ['open', 'pending', 'waiting', 'closed']

let activeTab = 'contacts'

export async function renderHubSpot(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const [contacts, companies, tickets] = await Promise.all([
    supabase.from('hubspot_contacts').select('*,company:hubspot_companies(name)').order('created_at', { ascending: false }),
    supabase.from('hubspot_companies').select('*').order('name'),
    supabase.from('hubspot_tickets').select('*,contact:hubspot_contacts(first_name,last_name),company:hubspot_companies(name)').order('created_at', { ascending: false }),
  ])

  const c = contacts.data || []
  const co = companies.data || []
  const tk = tickets.data || []

  const stageCounts = {}
  LIFECYCLE_STAGES.forEach((s) => { stageCounts[s.id] = c.filter((x) => x.lifecycle_stage === s.id).length })
  const openTickets = tk.filter((x) => x.status !== 'closed').length

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">HubSpot CRM</div>
        <div class="page-sub">Contacts, entreprises & tickets — ${c.length} contacts · ${co.length} entreprises · ${openTickets} tickets ouverts</div>
      </div>
      <button class="btn btn-primary" id="hs-add">${Icon.plus(16)} Ajouter</button>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      ${kpiBox('Contacts', c.length, Icon.users(18), 'tint-primary')}
      ${kpiBox('Entreprises', co.length, Icon.briefcase(18), 'tint-accent')}
      ${kpiBox('Tickets ouverts', openTickets, Icon.bell(18), 'tint-warning')}
      ${kpiBox('Clients', stageCounts.customer || 0, Icon.check(18), 'tint-success')}
    </div>

    <div class="seg-toggle" style="margin-bottom:18px" id="hs-tabs">
      <button class="seg-btn ${activeTab === 'contacts' ? 'active' : ''}" data-tab="contacts">Contacts</button>
      <button class="seg-btn ${activeTab === 'companies' ? 'active' : ''}" data-tab="companies">Entreprises</button>
      <button class="seg-btn ${activeTab === 'tickets' ? 'active' : ''}" data-tab="tickets">Tickets</button>
    </div>

    <div id="hs-tab-content"></div>
  `

  const tabContent = content.querySelector('#hs-tab-content')
  const tabs = content.querySelectorAll('#hs-tabs .seg-btn')
  tabs.forEach((tab) => tab.onclick = () => {
    tabs.forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    activeTab = tab.dataset.tab
    renderTab(activeTab, tabContent, c, co, tk)
  })

  const addBtn = content.querySelector('#hs-add')
  addBtn.onclick = () => {
    if (activeTab === 'contacts') openContactForm(content, co, null)
    else if (activeTab === 'companies') openCompanyForm(content, null)
    else openTicketForm(content, c, co, null)
  }

  renderTab(activeTab, tabContent, c, co, tk)
}

function renderTab(tab, el, contacts, companies, tickets) {
  if (tab === 'contacts') renderContacts(el, contacts, companies)
  else if (tab === 'companies') renderCompanies(el, companies)
  else renderTickets(el, tickets, contacts, companies)
}

function renderContacts(el, contacts, companies) {
  el.innerHTML = `
    <div class="card">
      <table class="table">
        <thead><tr><th>Contact</th><th>Email</th><th>Téléphone</th><th>Entreprise</th><th>Étape</th><th>Responsable</th><th></th></tr></thead>
        <tbody>
          ${contacts.map((c) => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="avatar sm" style="background:${avatarColor(c.first_name + c.last_name)}">${initials(c.first_name, c.last_name)}</div>
                  <div>
                    <div style="font-weight:600;font-size:13px">${escape(c.first_name)} ${escape(c.last_name)}</div>
                    <div style="font-size:11px;color:var(--text-3)">${escape(c.job_title || '—')}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:12px">${escape(c.email || '—')}</td>
              <td style="font-size:12px">${escape(c.phone || '—')}</td>
              <td style="font-size:12px">${escape(c.company?.name || c.company_name || '—')}</td>
              <td><span class="badge ${stageBadge(c.lifecycle_stage)}">${stageLabel(c.lifecycle_stage)}</span></td>
              <td style="font-size:12px">${escape(c.owner || '—')}</td>
              <td>
                <button class="btn btn-sm btn-ghost edit-hs-cont" data-id="${c.id}">${Icon.edit(13)}</button>
                <button class="btn btn-sm btn-ghost btn-danger del-hs-cont" data-id="${c.id}">${Icon.trash(13)}</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun contact</td></tr>'}
        </tbody>
      </table>
    </div>`

  el.querySelectorAll('.edit-hs-cont').forEach((b) => b.onclick = () => {
    const contact = contacts.find((x) => x.id === b.dataset.id)
    openContactForm(el.closest('#content'), companies, contact)
  })
  el.querySelectorAll('.del-hs-cont').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer ce contact ?')) return
    await supabase.from('hubspot_contacts').delete().eq('id', b.dataset.id)
    toast('Contact supprimé', 'success')
    renderHubSpot(el.closest('#content'))
  })
}

function renderCompanies(el, companies) {
  el.innerHTML = `
    <div class="grid grid-2">
      ${companies.map((co) => `
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
            <div>
              <div style="font-weight:700;font-size:15px">${escape(co.name)}</div>
              <div style="font-size:12px;color:var(--text-3)">${escape(co.industry || '—')} · ${escape(co.size || '—')}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm btn-ghost edit-hs-comp" data-id="${co.id}">${Icon.edit(13)}</button>
              <button class="btn btn-sm btn-ghost btn-danger del-hs-comp" data-id="${co.id}">${Icon.trash(13)}</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-2)">
            ${co.domain ? `<div>🌐 ${escape(co.domain)}</div>` : ''}
            ${co.website ? `<div>🔗 ${escape(co.website)}</div>` : ''}
            ${co.city ? `<div>📍 ${escape(co.city)}</div>` : ''}
            ${co.notes ? `<div style="margin-top:6px;color:var(--text-3)">${escape(co.notes)}</div>` : ''}
          </div>
        </div>`).join('') || '<div class="empty">Aucune entreprise</div>'}
    </div>`

  el.querySelectorAll('.edit-hs-comp').forEach((b) => b.onclick = () => {
    const company = companies.find((x) => x.id === b.dataset.id)
    openCompanyForm(el.closest('#content'), company)
  })
  el.querySelectorAll('.del-hs-comp').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer cette entreprise ?')) return
    await supabase.from('hubspot_companies').delete().eq('id', b.dataset.id)
    toast('Entreprise supprimée', 'success')
    renderHubSpot(el.closest('#content'))
  })
}

function renderTickets(el, tickets, contacts, companies) {
  el.innerHTML = `
    <div class="card">
      <table class="table">
        <thead><tr><th>Sujet</th><th>Priorité</th><th>Statut</th><th>Catégorie</th><th>Contact</th><th>Responsable</th><th></th></tr></thead>
        <tbody>
          ${tickets.map((t) => `
            <tr>
              <td style="font-weight:600;font-size:13px">${escape(t.subject)}</td>
              <td><span class="badge ${priorityBadge(t.priority)}">${priorityLabel(t.priority)}</span></td>
              <td><span class="badge ${ticketStatusBadge(t.status)}">${ticketStatusLabel(t.status)}</span></td>
              <td style="font-size:12px">${escape(t.category || '—')}</td>
              <td style="font-size:12px">${escape(t.contact?.first_name || '')} ${escape(t.contact?.last_name || '')}</td>
              <td style="font-size:12px">${escape(t.owner || '—')}</td>
              <td>
                <button class="btn btn-sm btn-ghost edit-hs-tk" data-id="${t.id}">${Icon.edit(13)}</button>
                <button class="btn btn-sm btn-ghost btn-danger del-hs-tk" data-id="${t.id}">${Icon.trash(13)}</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun ticket</td></tr>'}
        </tbody>
      </table>
    </div>`

  el.querySelectorAll('.edit-hs-tk').forEach((b) => b.onclick = () => {
    const ticket = tickets.find((x) => x.id === b.dataset.id)
    openTicketForm(el.closest('#content'), contacts, companies, ticket)
  })
  el.querySelectorAll('.del-hs-tk').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer ce ticket ?')) return
    await supabase.from('hubspot_tickets').delete().eq('id', b.dataset.id)
    toast('Ticket supprimé', 'success')
    renderHubSpot(el.closest('#content'))
  })
}

function openContactForm(content, companies, existing) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier le contact' : 'Nouveau contact', (body) => {
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Prénom</label><input id="hs-c-first" value="${escape(existing?.first_name || '')}"></div>
        <div class="field"><label>Nom</label><input id="hs-c-last" value="${escape(existing?.last_name || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Email</label><input id="hs-c-email" type="email" value="${escape(existing?.email || '')}"></div>
        <div class="field"><label>Téléphone</label><input id="hs-c-phone" value="${escape(existing?.phone || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Fonction</label><input id="hs-c-title" value="${escape(existing?.job_title || '')}"></div>
        <div class="field"><label>Entreprise</label><select id="hs-c-comp"><option value="">—</option>${companies.map((co) => `<option value="${co.id}" ${existing?.company_id === co.id ? 'selected' : ''}>${escape(co.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Étape</label><select id="hs-c-stage">${LIFECYCLE_STAGES.map((s) => `<option value="${s.id}" ${existing?.lifecycle_stage === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
        <div class="field"><label>Responsable</label><input id="hs-c-owner" value="${escape(existing?.owner || '')}"></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="hs-c-notes">${escape(existing?.notes || '')}</textarea></div>`
  }, async (body) => {
    const first = body.querySelector('#hs-c-first').value.trim()
    const last = body.querySelector('#hs-c-last').value.trim()
    if (!first || !last) { toast('Nom requis', 'error'); return false }
    const compId = body.querySelector('#hs-c-comp').value || null
    const comp = companies.find((x) => x.id === compId)
    const payload = {
      first_name: first, last_name: last,
      email: body.querySelector('#hs-c-email').value.trim(),
      phone: body.querySelector('#hs-c-phone').value.trim(),
      job_title: body.querySelector('#hs-c-title').value.trim(),
      company_id: compId,
      company_name: comp?.name || '',
      lifecycle_stage: body.querySelector('#hs-c-stage').value,
      owner: body.querySelector('#hs-c-owner').value.trim(),
      notes: body.querySelector('#hs-c-notes').value.trim(),
    }
    if (isEdit) {
      await supabase.from('hubspot_contacts').update(payload).eq('id', existing.id)
      toast('Contact modifié', 'success')
    } else {
      await supabase.from('hubspot_contacts').insert(payload)
      toast('Contact créé', 'success')
    }
    renderHubSpot(content)
  })
}

function openCompanyForm(content, existing) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom</label><input id="hs-co-name" value="${escape(existing?.name || '')}"></div>
      <div class="form-row">
        <div class="field"><label>Domaine</label><input id="hs-co-domain" value="${escape(existing?.domain || '')}" placeholder="exemple.fr"></div>
        <div class="field"><label>Site web</label><input id="hs-co-website" value="${escape(existing?.website || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Industrie</label><input id="hs-co-industry" value="${escape(existing?.industry || '')}"></div>
        <div class="field"><label>Taille</label><input id="hs-co-size" value="${escape(existing?.size || '')}" placeholder="11-50"></div>
      </div>
      <div class="field"><label>Ville</label><input id="hs-co-city" value="${escape(existing?.city || '')}"></div>
      <div class="field"><label>Notes</label><textarea id="hs-co-notes">${escape(existing?.notes || '')}</textarea></div>`
  }, async (body) => {
    const name = body.querySelector('#hs-co-name').value.trim()
    if (!name) { toast('Nom requis', 'error'); return false }
    const payload = {
      name,
      domain: body.querySelector('#hs-co-domain').value.trim(),
      website: body.querySelector('#hs-co-website').value.trim(),
      industry: body.querySelector('#hs-co-industry').value.trim(),
      size: body.querySelector('#hs-co-size').value.trim(),
      city: body.querySelector('#hs-co-city').value.trim(),
      notes: body.querySelector('#hs-co-notes').value.trim(),
    }
    if (isEdit) {
      await supabase.from('hubspot_companies').update(payload).eq('id', existing.id)
      toast('Entreprise modifiée', 'success')
    } else {
      await supabase.from('hubspot_companies').insert(payload)
      toast('Entreprise créée', 'success')
    }
    renderHubSpot(content)
  })
}

function openTicketForm(content, contacts, companies, existing) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier le ticket' : 'Nouveau ticket', (body) => {
    body.innerHTML = `
      <div class="field"><label>Sujet</label><input id="hs-t-subject" value="${escape(existing?.subject || '')}"></div>
      <div class="field"><label>Description</label><textarea id="hs-t-desc">${escape(existing?.description || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Priorité</label><select id="hs-t-pri">${TICKET_PRIORITIES.map((p) => `<option value="${p}" ${existing?.priority === p ? 'selected' : ''}>${priorityLabel(p)}</option>`).join('')}</select></div>
        <div class="field"><label>Statut</label><select id="hs-t-status">${TICKET_STATUS.map((s) => `<option value="${s}" ${existing?.status === s ? 'selected' : ''}>${ticketStatusLabel(s)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Catégorie</label><input id="hs-t-cat" value="${escape(existing?.category || '')}" placeholder="commercial, support..."></div>
        <div class="field"><label>Responsable</label><input id="hs-t-owner" value="${escape(existing?.owner || '')}"></div>
      </div>`
  }, async (body) => {
    const subject = body.querySelector('#hs-t-subject').value.trim()
    if (!subject) { toast('Sujet requis', 'error'); return false }
    const payload = {
      subject,
      description: body.querySelector('#hs-t-desc').value.trim(),
      priority: body.querySelector('#hs-t-pri').value,
      status: body.querySelector('#hs-t-status').value,
      category: body.querySelector('#hs-t-cat').value.trim(),
      owner: body.querySelector('#hs-t-owner').value.trim(),
    }
    if (isEdit) {
      await supabase.from('hubspot_tickets').update(payload).eq('id', existing.id)
      toast('Ticket modifié', 'success')
    } else {
      await supabase.from('hubspot_tickets').insert(payload)
      toast('Ticket créé', 'success')
    }
    renderHubSpot(content)
  })
}

function stageLabel(s) { return LIFECYCLE_STAGES.find((x) => x.id === s)?.label || s }
function stageBadge(s) {
  const m = { lead: 'badge-neutral', qualified: 'badge-primary', opportunity: 'badge-warning', customer: 'badge-success', champion: 'badge-success' }
  return m[s] || 'badge-neutral'
}
function priorityLabel(p) { return { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' }[p] || p }
function priorityBadge(p) { return { low: 'badge-neutral', medium: 'badge-primary', high: 'badge-warning', urgent: 'badge-danger' }[p] || 'badge-neutral' }
function ticketStatusLabel(s) { return { open: 'Ouvert', pending: 'En cours', waiting: 'En attente', closed: 'Fermé' }[s] || s }
function ticketStatusBadge(s) { return { open: 'badge-warning', pending: 'badge-primary', waiting: 'badge-neutral', closed: 'badge-success' }[s] || 'badge-neutral' }

function kpiBox(label, value, icon, tint) {
  return `
    <div class="card kpi">
      <div class="kpi-top"><div class="kpi-label">${label}</div><div class="kpi-ico ${tint}">${icon}</div></div>
      <div class="kpi-value">${value}</div>
    </div>`
}
