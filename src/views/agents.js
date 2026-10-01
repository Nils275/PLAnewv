import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const AGENT_ICONS = ['sparkles', 'trend', 'crm', 'edit', 'finance', 'chat', 'bell', 'brain']
const AGENT_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'claude-3-5-sonnet', 'claude-3-haiku']
const AGENT_STATUS = [
  { id: 'active', label: 'Actif', color: '#16a34a' },
  { id: 'paused', label: 'En pause', color: '#f59e0b' },
  { id: 'draft', label: 'Brouillon', color: '#6b7280' },
]

export async function renderAgents(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const { data: agents } = await supabase.from('ai_agents').select('*').order('created_at', { ascending: false })
  const all = agents || []

  const active = all.filter((a) => a.status === 'active').length
  const paused = all.filter((a) => a.status === 'paused').length

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Agents IA</div>
        <div class="page-sub">${all.length} agent${all.length === 1 ? '' : 's'} · ${active} actif${active === 1 ? '' : 's'} · ${paused} en pause</div>
      </div>
      <button class="btn btn-primary" id="add-agent">${Icon.plus(16)} Nouvel agent</button>
    </div>

    <div class="grid grid-3" style="margin-bottom:18px">
      ${all.map((a) => agentCard(a)).join('') || '<div class="empty">Aucun agent. Créez-en un pour commencer.</div>'}
    </div>
  `

  content.querySelector('#add-agent').onclick = () => openAgentForm(content, null)

  content.querySelectorAll('[data-agent-id]').forEach((el) => el.onclick = () => {
    const agent = all.find((a) => a.id === el.dataset.agentId)
    if (agent) openAgentDetail(content, all, agent)
  })

  content.querySelectorAll('[data-toggle-agent]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation()
    const agent = all.find((a) => a.id === b.dataset.toggleAgent)
    if (!agent) return
    const newStatus = agent.status === 'active' ? 'paused' : 'active'
    await supabase.from('ai_agents').update({ status: newStatus }).eq('id', agent.id)
    toast(newStatus === 'active' ? 'Agent activé' : 'Agent mis en pause', 'success')
    renderAgents(content)
  })

  content.querySelectorAll('[data-edit-agent]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation()
    const agent = all.find((a) => a.id === b.dataset.editAgent)
    if (agent) openAgentForm(content, agent)
  })

  content.querySelectorAll('[data-del-agent]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation()
    if (!await confirmDialog('Supprimer cet agent ?')) return
    await supabase.from('ai_agents').delete().eq('id', b.dataset.delAgent)
    toast('Agent supprimé', 'success')
    renderAgents(content)
  })
}

function agentCard(a) {
  const status = AGENT_STATUS.find((s) => s.id === a.status) || AGENT_STATUS[2]
  const iconFn = Icon[a.icon] || Icon.sparkles
  return `
    <div class="card agent-card" data-agent-id="${a.id}" style="cursor:pointer;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${a.color || '#2563eb'}"></div>
      <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="agent-avatar" style="background:${a.color || '#2563eb'}22;color:${a.color || '#2563eb'}">${iconFn(20)}</div>
          <div>
            <div style="font-weight:700;font-size:15px">${escape(a.name)}</div>
            <div style="font-size:12px;color:var(--text-3)">${escape(a.role)}</div>
          </div>
        </div>
        <span class="badge ${a.status === 'active' ? 'badge-success' : a.status === 'paused' ? 'badge-warning' : 'badge-neutral'}">${status.label}</span>
      </div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.5;margin-bottom:12px">${escape(a.description || '—')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:6px;align-items:center">
          <span class="tag">${escape(a.model)}</span>
          ${a.last_run ? `<span style="font-size:11px;color:var(--text-3)">Dernier run: ${new Date(a.last_run).toLocaleDateString('fr-FR')}</span>` : '<span style="font-size:11px;color:var(--text-3)">Jamais lancé</span>'}
        </div>
        <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-ghost" data-toggle-agent="${a.id}" title="${a.status === 'active' ? 'Mettre en pause' : 'Activer'}">${a.status === 'active' ? Icon.pause(13) : Icon.play(13)}</button>
          <button class="btn btn-sm btn-ghost" data-edit-agent="${a.id}" title="Modifier">${Icon.edit(13)}</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-del-agent="${a.id}" title="Supprimer">${Icon.trash(13)}</button>
        </div>
      </div>
    </div>`
}

function openAgentDetail(content, all, agent) {
  modal(agent.name, (body) => {
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div class="agent-avatar lg" style="background:${agent.color || '#2563eb'}22;color:${agent.color || '#2563eb'}">${(Icon[agent.icon] || Icon.sparkles)(24)}</div>
        <div>
          <div style="font-weight:700;font-size:18px">${escape(agent.name)}</div>
          <div style="font-size:13px;color:var(--text-3)">${escape(agent.role)} · ${escape(agent.model)}</div>
        </div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:4px">Description</div>
        <div style="font-size:14px;color:var(--text-2);line-height:1.6">${escape(agent.description || '—')}</div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:4px">Prompt système</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.6;background:var(--surface-2);padding:12px;border-radius:8px;white-space:pre-wrap;font-family:monospace">${escape(agent.system_prompt || '—')}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="run-agent">${Icon.play(14)} Lancer l'agent</button>
        <button class="btn btn-sm btn-ghost" id="edit-agent-detail">${Icon.edit(14)} Modifier</button>
      </div>`
  }, null, { noFooter: true })

  document.getElementById('run-agent').onclick = async () => {
    await supabase.from('ai_agents').update({ last_run: new Date().toISOString() }).eq('id', agent.id)
    toast('Agent lancé — exécution simulée', 'info')
    document.querySelector('.modal-overlay')?.remove()
    renderAgents(content)
  }
  document.getElementById('edit-agent-detail').onclick = () => {
    document.querySelector('.modal-overlay')?.remove()
    openAgentForm(content, agent)
  }
}

function openAgentForm(content, existing) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier l\'agent' : 'Nouvel agent IA', (body) => {
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Nom</label><input id="a-name" value="${escape(existing?.name || '')}" placeholder="Ex: Jarvis"></div>
        <div class="field"><label>Rôle</label><input id="a-role" value="${escape(existing?.role || '')}" placeholder="Ex: Assistant général"></div>
      </div>
      <div class="field"><label>Description</label><textarea id="a-desc" placeholder="Que fait cet agent ?">${escape(existing?.description || '')}</textarea></div>
      <div class="field"><label>Prompt système</label><textarea id="a-prompt" style="min-height:120px;font-family:monospace;font-size:13px" placeholder="Instructions pour l'agent...">${escape(existing?.system_prompt || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Modèle</label><select id="a-model">${AGENT_MODELS.map((m) => `<option value="${m}" ${existing?.model === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Icône</label><select id="a-icon">${AGENT_ICONS.map((i) => `<option value="${i}" ${existing?.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Couleur</label>
          <select id="a-color">${['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#059669'].map((c) => `<option value="${c}" ${existing?.color === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Statut</label><select id="a-status">${AGENT_STATUS.map((s) => `<option value="${s.id}" ${existing?.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>`
  }, async (body) => {
    const name = body.querySelector('#a-name').value.trim()
    if (!name) { toast('Nom requis', 'error'); return false }
    const payload = {
      name,
      role: body.querySelector('#a-role').value.trim() || 'assistant',
      description: body.querySelector('#a-desc').value.trim(),
      system_prompt: body.querySelector('#a-prompt').value.trim(),
      model: body.querySelector('#a-model').value,
      icon: body.querySelector('#a-icon').value,
      color: body.querySelector('#a-color').value,
      status: body.querySelector('#a-status').value,
    }
    if (isEdit) {
      await supabase.from('ai_agents').update(payload).eq('id', existing.id)
      toast('Agent modifié', 'success')
    } else {
      await supabase.from('ai_agents').insert(payload)
      toast('Agent créé', 'success')
    }
    renderAgents(content)
  }, { large: true })
}
