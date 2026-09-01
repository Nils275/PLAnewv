import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { escape } from './dashboard.js'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtDur = (m) => { const h = Math.floor(m / 60); const mm = m % 60; return `${h}h${String(mm).padStart(2, '0')}` }

export async function renderAnalytics(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const [tasks, projects, deals, tx, timeEntries, clients, team] = await Promise.all([
    supabase.from('tasks').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('crm_deals').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('time_entries').select('*'),
    supabase.from('clients').select('id,name,logo_color'),
    supabase.from('team_members').select('*'),
  ])

  const t = tasks.data || []
  const d = deals.data || []
  const x = tx.data || []
  const te = timeEntries.data || []
  const cl = clients.data || []
  const tm = team.data || []

  // 1. Monthly revenue trend (12 months)
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: dt.toLocaleDateString('fr-FR', { month: 'short' }), year: dt.getFullYear(), monthIdx: dt.getMonth(), income: 0, expense: 0 })
  }
  x.forEach((r) => {
    if (!r.date) return
    const dt = new Date(r.date)
    const m = months.find((mm) => mm.year === dt.getFullYear() && mm.monthIdx === dt.getMonth())
    if (m) { if (r.type === 'income') m.income += Number(r.amount); else m.expense += Number(r.amount) }
  })
  const maxBar = Math.max(...months.map((m) => Math.max(m.income, m.expense)), 1)

  // 2. CRM conversion funnel
  const stages = ['prospect', 'contacted', 'meeting', 'proposal', 'negotiation', 'signed', 'lost']
  const stageLabels = { prospect: 'Prospect', contacted: 'Contacté', meeting: 'RDV', proposal: 'Proposition', negotiation: 'Négociation', signed: 'Signé', lost: 'Perdu' }
  const funnel = stages.map((s) => ({ label: stageLabels[s], count: d.filter((k) => k.stage === s).length, value: d.filter((k) => k.stage === s).reduce((sum, k) => sum + Number(k.value), 0) }))
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1)

  // 3. Time by team member
  const byMember = {}
  te.forEach((e) => { byMember[e.member_name] = (byMember[e.member_name] || 0) + (e.duration_minutes || 0) })
  const memberRows = Object.entries(byMember).sort((a, b) => b[1] - a[1])
  const maxMember = Math.max(...memberRows.map((r) => r[1]), 1)

  // 4. Time by client
  const clientMap = Object.fromEntries(cl.map((c) => [c.id, c]))
  const byClient = {}
  te.forEach((e) => { if (e.client_id) { const c = clientMap[e.client_id]; if (c) byClient[c.name] = (byClient[c.name] || 0) + (e.duration_minutes || 0) } })
  const clientRows = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxClient = Math.max(...clientRows.map((r) => r[1]), 1)

  // 5. Task completion rate
  const done = t.filter((k) => k.status === 'done').length
  const completionRate = t.length ? Math.round((done / t.length) * 100) : 0

  // 6. Revenue by client (from invoices)
  const { data: invoices } = await supabase.from('invoices').select('client_id,total,status')
  const revByClient = {}
  ;(invoices || []).forEach((i) => { if (i.client_id) { const c = clientMap[i.client_id]; if (c) revByClient[c.name] = (revByClient[c.name] || 0) + Number(i.total || 0) } })
  const revRows = Object.entries(revByClient).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxRev = Math.max(...revRows.map((r) => r[1]), 1)

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Analytics</div><div class="page-sub">Analyse globale de l'activité</div></div>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Taux de complétion</div><div class="kpi-ico tint-success">${Icon.check(18)}</div></div><div class="kpi-value">${completionRate}%</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Taux conversion CRM</div><div class="kpi-ico tint-primary">${Icon.crm(18)}</div></div><div class="kpi-value">${d.length ? Math.round(d.filter((k) => k.stage === 'signed').length / d.length * 100) : 0}%</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Heures totales</div><div class="kpi-ico tint-warning">${Icon.timer(18)}</div></div><div class="kpi-value">${fmtDur(te.reduce((s, e) => s + (e.duration_minutes || 0), 0))}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Panier moyen</div><div class="kpi-ico tint-success">${Icon.dollar(18)}</div></div><div class="kpi-value">${d.filter((k) => k.stage === 'signed').length ? euro(d.filter((k) => k.stage === 'signed').reduce((s, k) => s + Number(k.value), 0) / d.filter((k) => k.stage === 'signed').length) : '—'}</div></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div class="card-title">Tendance revenus vs dépenses (12 mois)</div></div>
      <div class="card-pad">
        <div class="chart-bars" style="height:200px">
          ${months.map((m) => `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;height:100%;justify-content:flex-end;gap:2px">
              <div style="display:flex;gap:3px;align-items:flex-end;height:100%;width:100%;justify-content:center">
                <div class="chart-bar" style="height:${(m.income / maxBar) * 100}%;background:#2563eb" title="Revenus: ${euro(m.income)}"></div>
                <div class="chart-bar" style="height:${(m.expense / maxBar) * 100}%;background:#dc2626" title="Dépenses: ${euro(m.expense)}"></div>
              </div>
              <div class="chart-bar-label">${m.label}</div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:18px;margin-top:20px;justify-content:center">
          <div class="legend-item"><span class="legend-dot" style="background:#2563eb"></span>Revenus</div>
          <div class="legend-item"><span class="legend-dot" style="background:#dc2626"></span>Dépenses</div>
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-head"><div class="card-title">Entonnoir de conversion CRM</div></div>
        <div class="card-pad">
          ${funnel.map((f) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
                <span>${f.label}</span>
                <strong>${f.count} · ${euro(f.value)}</strong>
              </div>
              <div style="height:16px;background:var(--surface-2);border-radius:8px;overflow:hidden">
                <div style="height:100%;width:${(f.count / maxFunnel) * 100}%;background:var(--primary);border-radius:8px;transition:width .4s"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Temps par membre</div></div>
        <div class="card-pad">
          ${memberRows.length ? memberRows.map(([name, min]) => {
            const m = tm.find((tm2) => `${tm2.first_name} ${tm2.last_name}` === name)
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
                <span>${escape(name)}</span><strong>${fmtDur(min)}</strong>
              </div>
              <div style="height:12px;background:var(--surface-2);border-radius:6px;overflow:hidden">
                <div style="height:100%;width:${(min / maxMember) * 100}%;background:#0891b2;border-radius:6px;transition:width .4s"></div>
              </div>
            </div>`
          }).join('') : '<div class="empty">Aucune donnée</div>'}
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div class="card-title">Temps par client</div></div>
        <div class="card-pad">
          ${clientRows.length ? clientRows.map(([name, min]) => {
            const c = cl.find((cl2) => cl2.name === name)
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
                <span>${escape(name)}</span><strong>${fmtDur(min)}</strong>
              </div>
              <div style="height:12px;background:var(--surface-2);border-radius:6px;overflow:hidden">
                <div style="height:100%;width:${(min / maxClient) * 100}%;background:${c?.logo_color || '#64748b'};border-radius:6px;transition:width .4s"></div>
              </div>
            </div>`
          }).join('') : '<div class="empty">Aucun client lié</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Revenu par client (factures)</div></div>
        <div class="card-pad">
          ${revRows.length ? revRows.map(([name, val]) => {
            const c = cl.find((cl2) => cl2.name === name)
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
                <span>${escape(name)}</span><strong>${euro(val)}</strong>
              </div>
              <div style="height:12px;background:var(--surface-2);border-radius:6px;overflow:hidden">
                <div style="height:100%;width:${(val / maxRev) * 100}%;background:#16a34a;border-radius:6px;transition:width .4s"></div>
              </div>
            </div>`
          }).join('') : '<div class="empty">Aucune facture</div>'}
        </div>
      </div>
    </div>`
}
