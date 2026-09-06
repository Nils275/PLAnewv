import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'
import { logActivity } from '../activity.js'
import { getCurrentUser } from './login.js'

const TRIGGERS = [
  { value: 'deal_no_response', label: 'Un prospect reste sans réponse', desc: 'Délai en jours sans réponse' },
  { value: 'deal_stage_changed', label: 'Une opportunité change d\'étape', desc: 'Étape cible' },
  { value: 'invoice_overdue', label: 'Une facture est en retard', desc: 'Jours de retard' },
  { value: 'task_overdue', label: 'Une tâche est en retard', desc: 'Jours de retard' },
  { value: 'project_completed', label: 'Un projet est terminé', desc: '—' },
  { value: 'new_client', label: 'Un nouveau client est créé', desc: '—' },
]

const ACTIONS = [
  { value: 'create_task', label: 'Créer une tâche', desc: 'Titre de la tâche' },
  { value: 'create_project', label: 'Créer un projet', desc: 'Nom du projet' },
  { value: 'create_invoice', label: 'Générer une facture', desc: '—' },
  { value: 'send_notification', label: 'Notifier l\'équipe', desc: 'Message' },
  { value: 'create_reminder', label: 'Créer une relance', desc: 'Description' },
]

export async function renderAutomations(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const { data: automations } = await supabase.from('automations').select('*').order('created_at', { ascending: false })

  const autos = automations || []

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Automatisations</div>
        <div class="page-sub">Créez des règles SI... ALORS... pour automatiser votre activité</div>
      </div>
      <button class="btn btn-primary" id="add-auto">${Icon.settings(16)} Nouvelle règle</button>
    </div>

    <div class="card" style="margin-bottom:18px;padding:18px;background:var(--surface-2);border:1px dashed var(--border-strong)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:9px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center">${Icon.bell(18)}</div>
        <div>
          <div style="font-weight:600;font-size:14px">Comment ça marche ?</div>
          <div style="font-size:13px;color:var(--text-3)">Définissez un déclencheur (SI) et une action (ALORS). L'automatisation s'exécute automatiquement.</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px">
          <strong style="color:var(--primary)">SI</strong> un prospect reste sans réponse 5 jours
          <strong style="color:var(--success);margin-left:8px">ALORS</strong> créer une tâche "Relancer le prospect"
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px">
          <strong style="color:var(--primary)">SI</strong> un devis est accepté
          <strong style="color:var(--success);margin-left:8px">ALORS</strong> créer le projet → générer la facture → notifier le commercial
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      ${autos.map((a) => automationCard(a)).join('') || '<div class="empty">Aucune automatisation. Cliquez sur "Nouvelle règle" pour commencer.</div>'}
    </div>
  `

  content.querySelector('#add-auto').onclick = () => openAutoModal(() => renderAutomations(content))
  content.querySelectorAll('.toggle-auto').forEach((b) => b.onclick = async () => {
    const current = b.dataset.enabled === 'true'
    await supabase.from('automations').update({ enabled: !current }).eq('id', b.dataset.id)
    renderAutomations(content)
  })
  content.querySelectorAll('.edit-auto').forEach((b) => b.onclick = () => {
    const auto = autos.find((x) => x.id === b.dataset.id)
    openAutoModal(() => renderAutomations(content), auto)
  })
  content.querySelectorAll('.del-auto').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer cette automatisation ?')) return
    await supabase.from('automations').delete().eq('id', b.dataset.id)
    toast('Automatisation supprimée', 'success')
    renderAutomations(content)
  })
  content.querySelectorAll('.run-auto').forEach((b) => b.onclick = async () => {
    const auto = autos.find((x) => x.id === b.dataset.id)
    if (!auto) return
    const result = await executeAutomation(auto)
    if (result.ok) {
      await supabase.from('automations').update({ last_run: new Date().toISOString(), run_count: (auto.run_count || 0) + 1 }).eq('id', auto.id)
      toast(result.message || 'Automatisation exécutée', 'success')
      await logActivity('automation', auto.id, 'executed', `Règle "${auto.name}" exécutée`, '')
    } else {
      toast(result.message || 'Erreur lors de l\'exécution', 'error')
    }
    renderAutomations(content)
  })
}

async function executeAutomation(auto) {
  const tc = typeof auto.trigger_config === 'string' ? JSON.parse(auto.trigger_config) : (auto.trigger_config || {})
  const ac = typeof auto.action_config === 'string' ? JSON.parse(auto.action_config) : (auto.action_config || {})
  const user = getCurrentUser()

  try {
    if (auto.action_type === 'create_task' || auto.action_type === 'create_reminder') {
      const title = ac.title || 'Tâche automatique'
      const { data: taskData } = await supabase.from('tasks').insert({
        title,
        status: 'todo',
        priority: auto.action_type === 'create_reminder' ? 'high' : 'medium',
        due_date: tc.days ? new Date(Date.now() + tc.days * 86400000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      }).select('id').single()
      await logActivity('task', taskData?.id || '', 'created', `Tâche créée automatiquement: "${title}"`, 'tasks')
      return { ok: true, message: `Tâche créée: "${title}"` }

    } else if (auto.action_type === 'create_project') {
      const name = ac.title || 'Projet automatique'
      const { data: projData } = await supabase.from('projects').insert({
        name,
        status: 'planning',
        progress: 0,
      }).select('id').single()
      await logActivity('project', projData?.id || '', 'created', `Projet créé automatiquement: "${name}"`, 'projects')
      return { ok: true, message: `Projet créé: "${name}"` }

    } else if (auto.action_type === 'create_invoice') {
      const number = `AUTO-${Date.now().toString().slice(-6)}`
      const { data: invData } = await supabase.from('invoices').insert({
        number,
        type: 'invoice',
        status: 'draft',
        total: 0,
        date: new Date().toISOString().slice(0, 10),
      }).select('id').single()
      await logActivity('invoice', invData?.id || '', 'created', `Facture générée automatiquement: ${number}`, 'invoices')
      return { ok: true, message: `Facture générée: ${number}` }

    } else if (auto.action_type === 'send_notification') {
      const msg = ac.message || 'Notification automatique'
      await logActivity('notification', '', 'sent', `Notification: "${msg}"`, '')
      return { ok: true, message: `Notification envoyée: "${msg}"` }
    }
    return { ok: false, message: 'Action non reconnue' }
  } catch (e) {
    return { ok: false, message: `Erreur: ${e.message}` }
  }
}

function automationCard(a) {
  const trigger = TRIGGERS.find((t) => t.value === a.trigger_type)
  const action = ACTIONS.find((t) => t.value === a.action_type)
  const triggerConfig = typeof a.trigger_config === 'string' ? JSON.parse(a.trigger_config) : (a.trigger_config || {})
  const actionConfig = typeof a.action_config === 'string' ? JSON.parse(a.action_config) : (a.action_config || {})

  return `
    <div class="card card-pad" style="opacity:${a.enabled ? '1' : '0.6'}">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
        <div style="font-weight:700;font-size:15px">${escape(a.name)}</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" class="toggle-auto" data-id="${a.id}" data-enabled="${a.enabled}" ${a.enabled ? 'checked' : ''} style="width:18px;height:18px">
          <span style="font-size:12px;color:var(--text-3)">${a.enabled ? 'Active' : 'Inactive'}</span>
        </label>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="background:var(--surface-2);border-radius:8px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">SI</div>
          <div style="font-size:13px">${escape(trigger?.label || a.trigger_type)}${triggerConfig.days ? ` (${triggerConfig.days}j)` : ''}${triggerConfig.stage ? ` → ${triggerConfig.stage}` : ''}</div>
        </div>
        <div style="text-align:center;color:var(--text-3)">↓</div>
        <div style="background:var(--surface-2);border-radius:8px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">ALORS</div>
          <div style="font-size:13px">${escape(action?.label || a.action_type)}${actionConfig.title ? ` : "${escape(actionConfig.title)}"` : ''}${actionConfig.message ? ` : "${escape(actionConfig.message)}"` : ''}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text-3)">
          ${a.run_count || 0} exécution${a.run_count === 1 ? '' : 's'}
          ${a.last_run ? ` · Dernière: ${new Date(a.last_run).toLocaleDateString('fr-FR')}` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-ghost run-auto" data-id="${a.id}">Exécuter</button>
          <button class="btn btn-sm btn-ghost edit-auto" data-id="${a.id}">Modifier</button>
          <button class="btn btn-sm btn-ghost btn-danger del-auto" data-id="${a.id}">Supprimer</button>
        </div>
      </div>
    </div>`
}

function openAutoModal(onDone, existing) {
  const isEdit = !!existing
  const tc = existing ? (typeof existing.trigger_config === 'string' ? JSON.parse(existing.trigger_config) : existing.trigger_config || {}) : {}
  const ac = existing ? (typeof existing.action_config === 'string' ? JSON.parse(existing.action_config) : existing.action_config || {}) : {}

  modal(isEdit ? 'Modifier l\'automatisation' : 'Nouvelle automatisation', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom de la règle</label><input id="a-name" value="${escape(existing?.name || '')}" placeholder="Ex: Relance prospect 5j"></div>

      <div style="background:var(--surface-2);border-radius:8px;padding:14px">
        <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:10px">SI (Déclencheur)</div>
        <div class="field"><label>Type d'événement</label>
          <select id="a-trigger">
            ${TRIGGERS.map((t) => `<option value="${t.value}" ${existing?.trigger_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="field" id="trigger-config-wrap"><label>Paramètre</label><input id="a-trigger-val" value="${tc.days || tc.stage || ''}" placeholder="Ex: 5"></div>
      </div>

      <div style="background:var(--surface-2);border-radius:8px;padding:14px">
        <div style="font-size:12px;font-weight:700;color:var(--success);margin-bottom:10px">ALORS (Action)</div>
        <div class="field"><label>Action</label>
          <select id="a-action">
            ${ACTIONS.map((t) => `<option value="${t.value}" ${existing?.action_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="field" id="action-config-wrap"><label>Paramètre</label><input id="a-action-val" value="${ac.title || ac.message || ''}" placeholder="Ex: Relancer le prospect"></div>
      </div>

      <div class="field"><label>Activée</label>
        <select id="a-enabled">
          <option value="true" ${existing?.enabled !== false ? 'selected' : ''}>Oui</option>
          <option value="false" ${existing?.enabled === false ? 'selected' : ''}>Non</option>
        </select>
      </div>
    `

    const updateTriggerConfig = () => {
      const trigger = body.querySelector('#a-trigger').value
      const wrap = body.querySelector('#trigger-config-wrap')
      const t = TRIGGERS.find((x) => x.value === trigger)
      if (t && t.desc !== '—') {
        wrap.style.display = ''
        wrap.querySelector('label').textContent = t.desc
      } else {
        wrap.style.display = 'none'
      }
    }
    const updateActionConfig = () => {
      const action = body.querySelector('#a-action').value
      const wrap = body.querySelector('#action-config-wrap')
      const a = ACTIONS.find((x) => x.value === action)
      if (a && a.desc !== '—') {
        wrap.style.display = ''
        wrap.querySelector('label').textContent = a.desc
      } else {
        wrap.style.display = 'none'
      }
    }
    body.querySelector('#a-trigger').onchange = updateTriggerConfig
    body.querySelector('#a-action').onchange = updateActionConfig
    updateTriggerConfig()
    updateActionConfig()
  }, async (body) => {
    const name = body.querySelector('#a-name').value.trim()
    if (!name) { toast('Nom requis', 'error'); return false }
    const triggerType = body.querySelector('#a-trigger').value
    const actionType = body.querySelector('#a-action').value
    const triggerVal = body.querySelector('#a-trigger-val').value.trim()
    const actionVal = body.querySelector('#a-action-val').value.trim()

    const triggerConfig = {}
    if (triggerType === 'deal_no_response' || triggerType === 'invoice_overdue' || triggerType === 'task_overdue') triggerConfig.days = parseInt(triggerVal) || 5
    else if (triggerType === 'deal_stage_changed') triggerConfig.stage = triggerVal

    const actionConfig = {}
    if (actionType === 'create_task' || actionType === 'create_reminder') actionConfig.title = actionVal
    else if (actionType === 'create_project') actionConfig.title = actionVal
    else if (actionType === 'send_notification') actionConfig.message = actionVal

    const payload = {
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
      enabled: body.querySelector('#a-enabled').value === 'true',
    }
    if (isEdit) {
      await supabase.from('automations').update(payload).eq('id', existing.id)
      toast('Automatisation modifiée', 'success')
    } else {
      await supabase.from('automations').insert(payload)
      toast('Automatisation créée', 'success')
    }
    onDone()
  })
}
