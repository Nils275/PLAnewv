import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtDur = (m) => { const h = Math.floor(m / 60); const mm = m % 60; return `${h}h${String(mm).padStart(2, '0')}` }

export async function renderReports(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data: clients } = await supabase.from('clients').select('*').order('name', { ascending: true })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Rapports clients</div><div class="page-sub">Générez un rapport d'activité par client</div></div>
    </div>

    <div class="grid grid-3">
      ${(clients || []).map((c) => clientReportCard(c)).join('') || '<div class="empty">Aucun client.</div>'}
    </div>`

  content.querySelectorAll('[data-report]').forEach((b) => b.onclick = () => generateReport(content, clients.find((c) => c.id === b.dataset.report)))
}

function clientReportCard(c) {
  return `
    <div class="card card-pad" style="cursor:pointer" data-report="${c.id}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div class="avatar lg" style="background:${c.logo_color};width:42px;height:42px;border-radius:10px;font-size:16px">${escape(initials(c.name, c.company || ''))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px">${escape(c.name)}</div>
          ${c.company ? `<div style="font-size:12px;color:var(--text-3)">${escape(c.company)}</div>` : ''}
        </div>
        ${Icon.chart(20)}
      </div>
      <div style="font-size:12px;color:var(--text-3)">Cliquez pour générer le rapport d'activité complet</div>
    </div>`
}

async function generateReport(content, client) {
  content.innerHTML = `<div class="spinner"></div>`

  const [{ data: tasks }, { data: projects }, { data: timeEntries }, { data: invoices }, { data: deals }, { data: docs }] = await Promise.all([
    supabase.from('tasks').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    supabase.from('projects').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    supabase.from('time_entries').select('*').eq('client_id', client.id).order('date', { ascending: false }),
    supabase.from('invoices').select('*').eq('client_id', client.id).order('issue_date', { ascending: false }),
    supabase.from('crm_deals').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
  ])

  const t = tasks || []
  const p = projects || []
  const te = timeEntries || []
  const inv = invoices || []
  const dl = deals || []

  const totalMin = te.reduce((s, e) => s + (e.duration_minutes || 0), 0)
  const billableMin = te.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0)
  const billableAmount = te.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes || 0) * Number(e.hourly_rate || 0) / 60, 0)
  const doneTasks = t.filter((k) => k.status === 'done').length
  const activeTasks = t.filter((k) => k.status !== 'done').length
  const totalBudget = p.reduce((s, pr) => s + Number(pr.budget || 0), 0)
  const totalProgress = p.length ? Math.round(p.reduce((s, pr) => s + (pr.progress || 0), 0) / p.length) : 0
  const totalBilled = inv.reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPaid = inv.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
  const signedDeals = dl.filter((d) => d.stage === 'signed').reduce((s, d) => s + Number(d.value || 0), 0)

  content.innerHTML = `
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:14px">
        <button class="btn btn-ghost btn-icon" id="back-btn">${Icon.arrow(16)}</button>
        <div class="avatar lg" style="background:${client.logo_color};width:48px;height:48px;border-radius:12px;font-size:18px">${escape(initials(client.name, client.company || ''))}</div>
        <div><div class="page-title">Rapport — ${escape(client.name)}</div><div class="page-sub">Généré le ${new Date().toLocaleDateString('fr-FR')}</div></div>
      </div>
      <button class="btn btn-primary" id="print-btn">${Icon.download(16)} Exporter PDF</button>
    </div>

    <div id="report-print" style="max-width:800px;margin:0 auto">
      <div class="grid grid-4" style="margin-bottom:18px">
        <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Heures totales</div><div class="kpi-ico tint-primary">${Icon.timer(18)}</div></div><div class="kpi-value">${fmtDur(totalMin)}</div></div>
        <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Facturable</div><div class="kpi-ico tint-success">${Icon.dollar(18)}</div></div><div class="kpi-value" style="color:#16a34a">${euro(billableAmount)}</div></div>
        <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Tâches</div><div class="kpi-ico tint-warning">${Icon.tasks(18)}</div></div><div class="kpi-value">${doneTasks}/${t.length}</div></div>
        <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Facturé</div><div class="kpi-ico tint-success">${Icon.file(18)}</div></div><div class="kpi-value">${euro(totalBilled)}</div></div>
      </div>

      <div class="card" style="margin-bottom:18px">
        <div class="card-head"><div class="card-title">Projets (${p.length})</div><span class="badge badge-neutral">Budget total: ${euro(totalBudget)}</span></div>
        <div style="padding:8px">
          ${p.length ? p.map((pr) => `
            <div style="padding:10px;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <div style="font-weight:600;font-size:13px">${escape(pr.name)}</div>
                <span class="badge ${pr.status === 'active' ? 'badge-success' : pr.status === 'completed' ? 'badge-primary' : 'badge-warning'}">${pr.status}</span>
              </div>
              <div style="font-size:12px;color:var(--text-3);margin-bottom:6px">${escape(pr.description || '')}</div>
              <div class="progress"><div class="progress-fill" style="width:${pr.progress || 0}%;background:${pr.color || 'var(--primary)'}"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:4px"><span>${pr.progress || 0}%</span><span>Budget: ${euro(pr.budget)}</span></div>
            </div>`).join('') : '<div class="empty">Aucun projet</div>'}
        </div>
      </div>

      <div class="card" style="margin-bottom:18px">
        <div class="card-head"><div class="card-title">Tâches (${t.length})</div><span class="badge badge-neutral">${activeTasks} actives</span></div>
        <div style="padding:8px">
          ${t.length ? t.slice(0, 15).map((k) => `
            <div style="padding:8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <span class="priority-dot priority-${k.priority}"></span>
              <div style="flex:1;font-size:13px;font-weight:500">${escape(k.title)}</div>
              <span class="badge ${k.status === 'done' ? 'badge-success' : 'badge-neutral'}">${k.status === 'done' ? 'Terminé' : k.status === 'doing' ? 'En cours' : 'À faire'}</span>
            </div>`).join('') : '<div class="empty">Aucune tâche</div>'}
        </div>
      </div>

      <div class="card" style="margin-bottom:18px">
        <div class="card-head"><div class="card-title">Suivi du temps</div><span class="badge badge-primary">${fmtDur(billableMin)} fact.</span></div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr><th>Date</th><th>Description</th><th>Membre</th><th>Durée</th><th style="text-align:right">Montant</th></tr></thead>
            <tbody>
              ${te.length ? te.slice(0, 15).map((e) => `<tr>
                <td>${e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—'}</td>
                <td>${escape(e.description)}</td>
                <td>${escape(e.member_name || '—')}</td>
                <td>${fmtDur(e.duration_minutes || 0)}</td>
                <td style="text-align:right">${e.billable ? euro((e.duration_minutes || 0) * Number(e.hourly_rate || 0) / 60) : '—'}</td>
              </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Aucune entrée</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px">
        <div class="card-head"><div class="card-title">Factures (${inv.length})</div><span class="badge badge-success">${euro(totalPaid)} encaissé</span></div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
              ${inv.length ? inv.map((i) => `<tr>
                <td style="font-weight:600">${escape(i.number)}</td>
                <td>${new Date(i.issue_date).toLocaleDateString('fr-FR')}</td>
                <td><span class="badge ${i.status === 'paid' ? 'badge-success' : i.status === 'overdue' ? 'badge-danger' : 'badge-neutral'}">${i.status}</span></td>
                <td style="text-align:right;font-weight:600">${euro(i.total)}</td>
              </tr>`).join('') : '<tr><td colspan="4"><div class="empty">Aucune facture</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      ${dl.length ? `<div class="card" style="margin-bottom:18px">
        <div class="card-head"><div class="card-title">Opportunités CRM (${dl.length})</div><span class="badge badge-success">${euro(signedDeals)} signé</span></div>
        <div style="padding:8px">
          ${dl.map((d) => `<div style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
            <div><div style="font-weight:600;font-size:13px">${escape(d.company)}</div><div style="font-size:11px;color:var(--text-3)">${escape(d.contact || '')}</div></div>
            <div style="text-align:right"><div style="font-weight:600">${euro(d.value)}</div><span class="badge ${d.stage === 'signed' ? 'badge-success' : 'badge-neutral'}">${d.stage}</span></div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${(docs || []).length ? `<div class="card">
        <div class="card-head"><div class="card-title">Documents (${(docs || []).length})</div></div>
        <div style="padding:8px">
          ${(docs || []).map((d) => `<div style="padding:8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
            ${Icon.briefcase(15)}
            <div style="flex:1;font-size:13px;font-weight:500">${escape(d.name)}</div>
            <div style="font-size:11px;color:var(--text-3)">${escape(d.type || 'Fichier')}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`

  document.getElementById('back-btn').onclick = () => renderReports(content)
  document.getElementById('print-btn').onclick = () => {
    const el = document.getElementById('report-print')
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Rapport ${client.name}</title><style>
      body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a1a}
      h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #ddd;padding-bottom:4px}
      .meta{font-size:13px;color:#666;margin-bottom:24px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
      .kpi{border:1px solid #eee;border-radius:8px;padding:12px} .kpi .l{font-size:11px;color:#666;text-transform:uppercase} .kpi .v{font-size:20px;font-weight:700;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{text-align:left;font-size:11px;text-transform:uppercase;color:#666;padding:8px;border-bottom:2px solid #ddd}
      td{padding:8px;border-bottom:1px solid #eee;font-size:13px}
      .right{text-align:right} .bar{height:8px;background:#eee;border-radius:4px;overflow:hidden} .bar div{height:100%;border-radius:4px}
    </style></head><body>
      <h1>Rapport d'activité — ${escape(client.name)}</h1>
      <div class="meta">${escape(client.company || '')} · ${new Date().toLocaleDateString('fr-FR')}</div>
      <div class="kpis">
        <div class="kpi"><div class="l">Heures totales</div><div class="v">${fmtDur(totalMin)}</div></div>
        <div class="kpi"><div class="l">Facturable</div><div class="v">${euro(billableAmount)}</div></div>
        <div class="kpi"><div class="l">Tâches</div><div class="v">${doneTasks}/${t.length}</div></div>
        <div class="kpi"><div class="l">Facturé</div><div class="v">${euro(totalBilled)}</div></div>
      </div>
      ${el.innerHTML}
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }
}
