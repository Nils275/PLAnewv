import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok']
const PLATFORM_COLORS = { instagram: '#e1306c', facebook: '#1877f2', linkedin: '#0a66c2', twitter: '#1da1f2', tiktok: '#000000' }
const STATUSES = [
  { id: 'idea', label: 'Idée', color: 'badge-neutral' },
  { id: 'draft', label: 'Brouillon', color: 'badge-warning' },
  { id: 'scheduled', label: 'Programmé', color: 'badge-primary' },
  { id: 'published', label: 'Publié', color: 'badge-success' },
  { id: 'cancelled', label: 'Annulé', color: 'badge-danger' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

export async function renderSocial(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: posts }, { data: clients }, { data: projects }, { data: team }] = await Promise.all([
    supabase.from('social_posts').select('*').order('scheduled_date', { ascending: true }),
    supabase.from('clients').select('id,name,logo_color'),
    supabase.from('projects').select('id,name'),
    supabase.from('team_members').select('*'),
  ])

  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))
  const all = posts || []

  const byStatus = {}
  STATUSES.forEach((s) => { byStatus[s.id] = all.filter((p) => p.status === s.id) })
  const upcoming = all.filter((p) => p.scheduled_date && new Date(p.scheduled_date) >= new Date() && p.status === 'scheduled').length
  const published = byStatus.published.length

  // calendar grid — next 4 weeks
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weeks = []
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1)
  for (let w = 0; w < 4; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(startOfWeek)
      dt.setDate(startOfWeek.getDate() + w * 7 + d)
      const dateStr = dt.toISOString().slice(0, 10)
      const dayPosts = all.filter((p) => p.scheduled_date === dateStr)
      week.push({ date: dt, dateStr, posts: dayPosts })
    }
    weeks.push(week)
  }

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Calendrier éditorial</div><div class="page-sub">${all.length} post(s) · ${published} publié(s) · ${upcoming} à venir</div></div>
      <button class="btn btn-primary" id="add-post">${Icon.plus(16)} Nouveau post</button>
    </div>

    <div class="grid grid-5" style="margin-bottom:18px">
      ${STATUSES.map((s) => `<div class="card stat-mini"><div class="stat-num">${byStatus[s.id].length}</div><div class="stat-label"><span class="badge ${s.color}">${s.label}</span></div></div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div class="card-title">Planning — 4 prochaines semaines</div></div>
      <div style="overflow-x:auto;padding:12px">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;min-width:700px">
          ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => `<div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;text-align:center;padding:4px">${d}</div>`).join('')}
          ${weeks.flat().map((day) => {
            const isToday = day.dateStr === today.toISOString().slice(0, 10)
            const isPast = day.date < today
            return `<div style="min-height:80px;border:1px solid var(--border);border-radius:8px;padding:4px;background:${isToday ? 'var(--primary-soft)' : 'var(--surface)'};opacity:${isPast ? 0.5 : 1}">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);text-align:center;margin-bottom:2px">${day.date.getDate()}</div>
              ${day.posts.map((p) => `<div style="font-size:10px;padding:3px 4px;border-radius:4px;background:${PLATFORM_COLORS[p.platform] || '#64748b'}22;color:${PLATFORM_COLORS[p.platform] || '#64748b'};margin-bottom:2px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-edit="${p.id}">${escape(p.title)}</div>`).join('')}
            </div>`
          }).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Tous les posts</div></div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Titre</th><th>Plateforme</th><th>Statut</th><th>Date prévue</th><th>Client</th><th>Responsable</th><th></th></tr></thead>
          <tbody>
            ${all.map((p) => {
              const c = p.client_id ? clientMap[p.client_id] : null
              return `<tr>
                <td style="font-weight:500">${escape(p.title)}</td>
                <td><span class="tag" style="background:${PLATFORM_COLORS[p.platform] || '#64748b'}22;color:${PLATFORM_COLORS[p.platform] || '#64748b'}">${p.platform}</span></td>
                <td><span class="badge ${STATUS_MAP[p.status]?.color || 'badge-neutral'}">${STATUS_MAP[p.status]?.label || p.status}</span></td>
                <td>${p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString('fr-FR') : '—'}</td>
                <td>${c ? `<span class="tag" style="background:${c.logo_color}22;color:${c.logo_color}">${escape(c.name)}</span>` : '—'}</td>
                <td>${escape(p.assignee || '—')}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-ghost btn-sm btn-icon" data-edit="${p.id}">${Icon.edit(13)}</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-del="${p.id}">${Icon.trash(13)}</button>
                </td>
              </tr>`
            }).join('') || '<tr><td colspan="7"><div class="empty">Aucun post. Créez votre premier contenu !</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`

  document.getElementById('add-post').onclick = () => openForm(content, null, clients, projects, team)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, all.find((p) => p.id === b.dataset.edit), clients, projects, team))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce post ?')) {
      await supabase.from('social_posts').delete().eq('id', b.dataset.del)
      toast('Post supprimé', 'success')
      renderSocial(content)
    }
  })
}

async function openForm(content, post, clients, projects, team) {
  await modal(post ? 'Modifier le post' : 'Nouveau post', (body) => {
    body.innerHTML = `
      <div class="field"><label>Titre</label><input id="f-title" value="${escape(post?.title || '')}" placeholder="ex: Résumé du rallye"></div>
      <div class="field"><label>Contenu</label><textarea id="f-content" rows="4" placeholder="Texte du post...">${escape(post?.content || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Plateforme</label><select id="f-platform">${PLATFORMS.map((p) => `<option value="${p}" ${post?.platform === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>Statut</label><select id="f-status">${STATUSES.map((s) => `<option value="${s.id}" ${post?.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date de publication</label><input type="date" id="f-date" value="${post?.scheduled_date || ''}"></div>
        <div class="field"><label>Responsable</label><select id="f-assignee"><option value="">—</option>${(team || []).map((m) => `<option value="${m.first_name} ${m.last_name}" ${post?.assignee === `${m.first_name} ${m.last_name}` ? 'selected' : ''}>${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${post?.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${post?.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Hashtags</label><input id="f-hashtags" value="${escape(post?.hashtags || '')}" placeholder="#rallye #motorsport"></div>`
  }, async () => {
    const payload = {
      title: document.getElementById('f-title').value.trim(),
      content: document.getElementById('f-content').value.trim(),
      platform: document.getElementById('f-platform').value,
      status: document.getElementById('f-status').value,
      scheduled_date: document.getElementById('f-date').value || null,
      assignee: document.getElementById('f-assignee').value,
      client_id: document.getElementById('f-client').value || null,
      project_id: document.getElementById('f-project').value || null,
      hashtags: document.getElementById('f-hashtags').value.trim(),
    }
    if (!payload.title) { toast('Titre requis', 'error'); return false }
    if (post) {
      await supabase.from('social_posts').update(payload).eq('id', post.id)
      toast('Post mis à jour', 'success')
    } else {
      await supabase.from('social_posts').insert(payload)
      toast('Post créé', 'success')
    }
    renderSocial(content)
  })
}
