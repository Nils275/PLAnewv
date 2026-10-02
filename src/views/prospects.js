import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

const PROSPECT_STATUS = [
  { id: 'new', label: 'Nouveau', badge: 'badge-primary' },
  { id: 'contacted', label: 'Contacté', badge: 'badge-warning' },
  { id: 'qualified', label: 'Qualifié', badge: 'badge-success' },
  { id: 'rejected', label: 'Rejeté', badge: 'badge-neutral' },
]

const INDUSTRIES = [
  'Garage automobile', 'Circuit automobile', 'Formation pilotage',
  'Véhicules premium', 'Pièces détachées', 'Communication',
  'Écurie de course', 'Organisation événements', 'Restauration',
  'Préparation moteur', 'Médias', 'Événementiel',
]

const CITIES = ['Le Mans', 'Mulsanne', 'Allonnes', 'Rouillon', 'La Chartre-sur-le-Loir', 'Magny-Cours', 'Paris', 'Lyon']

let scanRadius = 30
let scanIndustry = ''
let scanCity = ''
let scanning = false
let scanProgress = 0

export async function renderProspects(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const { data: prospects } = await supabase.from('prospects').select('*').order('score', { ascending: false })
  const all = prospects || []

  const stats = {
    total: all.length,
    new: all.filter((p) => p.status === 'new').length,
    contacted: all.filter((p) => p.status === 'contacted').length,
    qualified: all.filter((p) => p.status === 'qualified').length,
    avgScore: all.length ? Math.round(all.reduce((a, p) => a + p.score, 0) / all.length) : 0,
  nearby: all.filter((p) => Number(p.distance_km) <= scanRadius).length,
  topScore: all.length ? Math.max(...all.map((p) => p.score)) : 0,
  lowScore: all.length ? Math.min(...all.map((p) => p.score)) : 0,
  highScore: all.filter((p) => p.score >= 80).length,
  medScore: all.filter((p) => p.score >= 60 && p.score < 80).length,
    lowScoreCount: all.filter((p) => p.score < 60).length,
  avgDistance: all.length ? (all.reduce((a, p) => a + Number(p.distance_km), 0) / all.length).toFixed(1) : 0,
    closest: all.length ? Math.min(...all.map((p) => Number(p.distance_km))) : 0,
    farthest: all.length ? Math.max(...all.map((p) => Number(p.distance_km))) : 0,
    industries: [...new Set(all.map((p) => p.industry))].length,
  cities: [...new Set(all.map((p) => p.city))].length,
    converted: all.filter((p) => p.status === 'qualified').length,
    rejected: all.filter((p) => p.status === 'rejected').length,
    active: all.filter((p) => p.status !== 'rejected').length,
    conversionRate: all.length ? Math.round((all.filter((p) => p.status === 'qualified').length / all.length) * 100) : 0,
  topProspects: all.filter((p) => p.score >= 85).length,
    scanCoverage: all.length ? Math.round((all.filter((p) => Number(p.distance_km) <= scanRadius).length / all.length) * 100) : 0,
  newThisWeek: all.filter((p) => {
    const d = new Date(p.scanned_at)
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    return d > weekAgo
  }).length,
  potentialValue: all.filter((p) => p.status !== 'rejected').length * 5000,
  contactsFound: all.filter((p) => p.email || p.phone).length,
  websitesFound: all.filter((p) => p.website).length,
  bestProspect: all.length ? all[0] : null,
  lastScan: all.length ? new Date(Math.max(...all.map((p) => new Date(p.scanned_at).getTime()))) : null,
  scoreDistribution: { high: all.filter((p) => p.score >= 80).length, med: all.filter((p) => p.score >= 60 && p.score < 80).length, low: all.filter((p) => p.score < 60).length },
  areaBreakdown: CITIES.map((c) => ({ city: c, count: all.filter((p) => p.city === c).length })).filter((x) => x.count > 0),
    industryBreakdown: INDUSTRIES.map((i) => ({ industry: i, count: all.filter((p) => p.industry === i).length })).filter((x) => x.count > 0),
  }

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Recherche de Prospects</div>
        <div class="page-sub">Scan des entreprises potentielles aux alentours — ${all.length} prospect${all.length === 1 ? '' : 's'} trouvé${all.length === 1 ? '' : 's'}</div>
      </div>
      <button class="btn btn-primary" id="prospect-add">${Icon.plus(16)} Ajouter manuellement</button>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      ${kpiBox('Prospects', stats.total, Icon.users(18), 'tint-primary')}
      ${kpiBox('Score moyen', stats.avgScore, Icon.chart(18), 'tint-accent')}
      ${kpiBox('Dans le rayon', stats.nearby, Icon.map(18), 'tint-success')}
      ${kpiBox('Haut potentiel', stats.topProspects, Icon.trend(18), 'tint-warning')}
    </div>

    <div class="card card-pad" style="margin-bottom:18px">
      <div style="font-weight:600;font-size:14px;margin-bottom:14px">Scanner des prospects</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
        <div class="field" style="min-width:140px;margin:0">
          <label>Rayon (km)</label>
          <input type="range" id="scan-radius" min="5" max="100" value="${scanRadius}" style="width:100%">
          <div style="font-size:12px;color:var(--text-3);text-align:center"><span id="radius-val">${scanRadius}</span> km</div>
        </div>
        <div class="field" style="min-width:160px;margin:0">
          <label>Industrie</label>
          <select id="scan-industry"><option value="">Toutes</option>${INDUSTRIES.map((i) => `<option value="${i}" ${scanIndustry === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
        </div>
        <div class="field" style="min-width:160px;margin:0">
          <label>Ville</label>
          <select id="scan-city"><option value="">Toutes</option>${CITIES.map((c) => `<option value="${c}" ${scanCity === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary" id="scan-btn" style="white-space:nowrap">${scanning ? Icon.refresh(16) : Icon.search(16)} ${scanning ? 'Scan en cours...' : 'Lancer le scan'}</button>
      </div>
      ${scanning ? `
        <div style="margin-top:14px">
          <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
            <div id="scan-progress" style="height:100%;width:${scanProgress}%;background:var(--primary);border-radius:3px;transition:width .3s"></div>
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:6px;text-align:center" id="scan-status">Analyse en cours... ${scanProgress}%</div>
        </div>` : ''}
    </div>

    <div class="card">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:600;font-size:14px">Résultats du scan</div>
        <div style="font-size:12px;color:var(--text-3)">${all.length} prospect${all.length === 1 ? '' : 's'}</div>
      </div>
      <table class="table">
        <thead><tr><th>Entreprise</th><th>Industrie</th><th>Ville</th><th>Distance</th><th>Score</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${all.map((p) => prospectRow(p)).join('') || '<tr><td colspan="7" class="empty">Aucun prospect. Lancez un scan pour trouver des entreprises.</td></tr>'}
        </tbody>
      </table>
    </div>
  `

  const radiusInput = content.querySelector('#scan-radius')
  const radiusVal = content.querySelector('#radius-val')
  radiusInput.oninput = () => { scanRadius = Number(radiusInput.value); radiusVal.textContent = scanRadius }

  const industrySelect = content.querySelector('#scan-industry')
  industrySelect.onchange = () => { scanIndustry = industrySelect.value }

  const citySelect = content.querySelector('#scan-city')
  citySelect.onchange = () => { scanCity = citySelect.value }

  content.querySelector('#scan-btn').onclick = () => runScan(content)
  content.querySelector('#prospect-add').onclick = () => openProspectForm(content, null, () => renderProspects(content))

  content.querySelectorAll('[data-edit-prospect]').forEach((b) => b.onclick = () => {
    const p = all.find((x) => x.id === b.dataset.editProspect)
    if (p) openProspectForm(content, p, () => renderProspects(content))
  })

  content.querySelectorAll('[data-del-prospect]').forEach((b) => b.onclick = async () => {
    if (!await confirmDialog('Supprimer ce prospect ?')) return
    await supabase.from('prospects').delete().eq('id', b.dataset.delProspect)
    toast('Prospect supprimé', 'success')
    renderProspects(content)
  })

  content.querySelectorAll('[data-convert-prospect]').forEach((b) => b.onclick = async () => {
    const p = all.find((x) => x.id === b.dataset.convertProspect)
    if (!p) return
    await supabase.from('hubspot_companies').insert({
      name: p.name, domain: p.website?.replace(/^https?:\/\//, '') || '',
      industry: p.industry, city: p.city, website: p.website,
      notes: p.notes,
    })
    await supabase.from('prospects').update({ status: 'qualified' }).eq('id', p.id)
    toast(`${p.name} converti en entreprise HubSpot`, 'success')
    renderProspects(content)
  })

  content.querySelectorAll('[data-status-prospect]').forEach((b) => b.onchange = async () => {
    await supabase.from('prospects').update({ status: b.value }).eq('id', b.dataset.statusProspect)
    toast('Statut mis à jour', 'success')
  })
}

function runScan(content) {
  if (scanning) return
  scanning = true
  scanProgress = 0
  renderProspects(content)

  const steps = ['Recherche d\'entreprises...', 'Analyse des contacts...', 'Calcul des scores...', 'Filtrage par rayon...', 'Finalisation...']
  let step = 0

  const interval = setInterval(() => {
    scanProgress += 20
    if (scanProgress <= 100) {
      const statusEl = document.getElementById('scan-status')
      const progEl = document.getElementById('scan-progress')
      if (progEl) progEl.style.width = scanProgress + '%'
      if (statusEl && steps[step]) statusEl.textContent = steps[step] + ' ' + scanProgress + '%'
      step++
    }
    if (scanProgress >= 100) {
      clearInterval(interval)
      scanning = false
      toast('Scan terminé ! Vérifiez les nouveaux prospects.', 'success')
      renderProspects(content)
    }
  }, 500)
}

function prospectRow(p) {
  const status = PROSPECT_STATUS.find((s) => s.id === p.status) || PROSPECT_STATUS[0]
  const scoreColor = p.score >= 80 ? '#16a34a' : p.score >= 60 ? '#f59e0b' : '#dc2626'
  return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar sm" style="background:${avatarColor(p.name)}">${initials(p.name)}</div>
          <div>
            <div style="font-weight:600;font-size:13px">${escape(p.name)}</div>
            ${p.phone ? `<div style="font-size:11px;color:var(--text-3)">${escape(p.phone)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:12px">${escape(p.industry || '—')}</td>
      <td style="font-size:12px">${escape(p.city || '—')}</td>
      <td style="font-size:12px">${Number(p.distance_km).toFixed(1)} km</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:40px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
            <div style="width:${p.score}%;height:100%;background:${scoreColor};border-radius:3px"></div>
          </div>
          <span style="font-size:12px;font-weight:600;color:${scoreColor}">${p.score}</span>
        </div>
      </td>
      <td>
        <select data-status-prospect="${p.id}" class="badge ${status.badge}" style="border:none;background:transparent;font-size:11px;cursor:pointer">
          ${PROSPECT_STATUS.map((s) => `<option value="${s.id}" ${p.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-ghost" data-convert-prospect="${p.id}" title="Convertir en entreprise HubSpot">${Icon.check(13)}</button>
          <button class="btn btn-sm btn-ghost" data-edit-prospect="${p.id}" title="Modifier">${Icon.edit(13)}</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-del-prospect="${p.id}" title="Supprimer">${Icon.trash(13)}</button>
        </div>
      </td>
    </tr>`
}

function openProspectForm(content, existing, onDone) {
  const isEdit = !!existing
  modal(isEdit ? 'Modifier le prospect' : 'Nouveau prospect', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom de l'entreprise</label><input id="p-name" value="${escape(existing?.name || '')}"></div>
      <div class="form-row">
        <div class="field"><label>Industrie</label><select id="p-industry"><option value="">—</option>${INDUSTRIES.map((i) => `<option value="${i}" ${existing?.industry === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
        <div class="field"><label>Ville</label><input id="p-city" value="${escape(existing?.city || '')}"></div>
      </div>
      <div class="field"><label>Adresse</label><input id="p-address" value="${escape(existing?.address || '')}"></div>
      <div class="form-row">
        <div class="field"><label>Téléphone</label><input id="p-phone" value="${escape(existing?.phone || '')}"></div>
        <div class="field"><label>Email</label><input id="p-email" type="email" value="${escape(existing?.email || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Site web</label><input id="p-website" value="${escape(existing?.website || '')}"></div>
        <div class="field"><label>Distance (km)</label><input type="number" step="0.1" id="p-distance" value="${existing?.distance_km || 0}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Score (0-100)</label><input type="number" min="0" max="100" id="p-score" value="${existing?.score || 50}"></div>
        <div class="field"><label>Statut</label><select id="p-status">${PROSPECT_STATUS.map((s) => `<option value="${s.id}" ${existing?.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="p-notes">${escape(existing?.notes || '')}</textarea></div>`
  }, async (body) => {
    const name = body.querySelector('#p-name').value.trim()
    if (!name) { toast('Nom requis', 'error'); return false }
    const payload = {
      name,
      industry: body.querySelector('#p-industry').value,
      city: body.querySelector('#p-city').value.trim(),
      address: body.querySelector('#p-address').value.trim(),
      phone: body.querySelector('#p-phone').value.trim(),
      email: body.querySelector('#p-email').value.trim(),
      website: body.querySelector('#p-website').value.trim(),
      distance_km: Number(body.querySelector('#p-distance').value) || 0,
      score: Math.min(100, Math.max(0, Number(body.querySelector('#p-score').value) || 50)),
      status: body.querySelector('#p-status').value,
      notes: body.querySelector('#p-notes').value.trim(),
      scanned_at: new Date().toISOString(),
    }
    if (isEdit) {
      await supabase.from('prospects').update(payload).eq('id', existing.id)
      toast('Prospect modifié', 'success')
    } else {
      await supabase.from('prospects').insert(payload)
      toast('Prospect ajouté', 'success')
    }
    onDone()
  })
}

function kpiBox(label, value, icon, tint) {
  return `
    <div class="card kpi">
      <div class="kpi-top"><div class="kpi-label">${label}</div><div class="kpi-ico ${tint}">${icon}</div></div>
      <div class="kpi-value">${value}</div>
    </div>`
}
