import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0)

const STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard' }
const STATUS_COLORS = { draft: 'badge-neutral', sent: 'badge-primary', paid: 'badge-success', overdue: 'badge-danger' }
const TYPE_LABELS = { invoice: 'Facture', quote: 'Devis' }
const PAYMENT_LABELS = { transfer: 'Virement', card: 'Carte', check: 'Chèque', cash: 'Espèces', other: 'Autre' }

export async function renderInvoices(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: invoices }, { data: clients }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
    supabase.from('clients').select('id,name,logo_color,email,address'),
    supabase.from('payments').select('*').order('date', { ascending: false }),
  ])
  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))
  const all = invoices || []
  const today = new Date().toISOString().slice(0, 10)
  const overdueIds = all.filter((i) => i.type === 'invoice' && i.status === 'sent' && i.due_date && i.due_date < today).map((i) => i.id)
  if (overdueIds.length) await supabase.from('invoices').update({ status: 'overdue' }).in('id', overdueIds)
  overdueIds.forEach((id) => { const item = all.find((i) => i.id === id); if (item) item.status = 'overdue' })

  const invoiceRows = all.filter((i) => i.type !== 'quote')
  const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalPending = invoiceRows.filter((i) => i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)
  const totalOverdue = invoiceRows.filter((i) => i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0)
  const totalDraft = invoiceRows.filter((i) => i.status === 'draft').reduce((s, i) => s + Number(i.total), 0)
  const quoteRows = all.filter((i) => i.type === 'quote')

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Facturation</div><div class="page-sub">${invoiceRows.length} facture(s) · ${quoteRows.length} devis · ${invoiceRows.filter((i) => i.status === 'paid').length} payée(s)</div></div>
      <div style="display:flex;gap:8px"><button class="btn" id="add-quote">${Icon.file(16)} Nouveau devis</button><button class="btn btn-primary" id="add-inv">${Icon.plus(16)} Nouvelle facture</button></div>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Encaissé</div><div class="kpi-ico tint-success">${Icon.dollar(18)}</div></div><div class="kpi-value" style="color:#16a34a">${euro(totalPaid)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">En attente</div><div class="kpi-ico tint-primary">${Icon.file(18)}</div></div><div class="kpi-value">${euro(totalPending)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">En retard</div><div class="kpi-ico tint-warning">${Icon.clock(18)}</div></div><div class="kpi-value" style="color:#dc2626">${euro(totalOverdue)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Brouillons</div><div class="kpi-ico tint-warning">${Icon.edit(18)}</div></div><div class="kpi-value">${euro(totalDraft)}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Factures et devis</div><span class="badge badge-neutral">${all.length}</span></div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Type</th><th>Numéro</th><th>Client</th><th>Date</th><th>Échéance</th><th>Statut</th><th style="text-align:right">Total</th><th></th></tr></thead>
          <tbody>
            ${all.map((inv) => {
              const c = inv.client_id ? clientMap[inv.client_id] : null
              return `<tr>
                <td><span class="badge ${inv.type === 'quote' ? 'badge-warning' : 'badge-primary'}">${TYPE_LABELS[inv.type] || 'Facture'}</span></td>
                <td style="font-weight:600">${escape(inv.number)}</td>
                <td>${c ? `<span class="tag" style="background:${c.logo_color}22;color:${c.logo_color}">${escape(c.name)}</span>` : '—'}</td>
                <td>${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : '—'}</td>
                <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                <td><span class="badge ${STATUS_COLORS[inv.status] || 'badge-neutral'}">${STATUS_LABELS[inv.status] || inv.status}</span></td>
                <td style="text-align:right;font-weight:700">${euro(inv.total)}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-ghost btn-sm" data-view="${inv.id}">${Icon.file(13)} Voir</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-edit="${inv.id}">${Icon.edit(13)}</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-del="${inv.id}">${Icon.trash(13)}</button>
                </td>
              </tr>`
            }).join('') || '<tr><td colspan="8"><div class="empty">Aucune facture. Cliquez sur "Nouvelle facture".</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`

  document.getElementById('add-inv').onclick = () => openForm(content, null, clients, 'invoice')
  document.getElementById('add-quote').onclick = () => openForm(content, null, clients, 'quote')
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, all.find((i) => i.id === b.dataset.edit), clients))
  content.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => viewInvoice(content, all.find((i) => i.id === b.dataset.view), clientMap))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette facture ?')) {
      await supabase.from('invoices').delete().eq('id', b.dataset.del)
      toast('Facture supprimée', 'success')
      renderInvoices(content)
    }
  })
}

async function viewInvoice(content, inv, clientMap) {
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('created_at'),
    supabase.from('payments').select('*').eq('invoice_id', inv.id).order('date', { ascending: false }),
  ])
  const c = inv.client_id ? clientMap[inv.client_id] : null
  const paidAmount = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  const outstanding = Math.max(0, Number(inv.total || 0) - paidAmount)

  content.innerHTML = `
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:14px">
        <button class="btn btn-ghost btn-icon" id="back-btn">${Icon.arrow(16)}</button>
        <div><div class="page-title">${escape(inv.number)}</div><div class="page-sub">${TYPE_LABELS[inv.type] || 'Facture'} · ${STATUS_LABELS[inv.status] || inv.status}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="print-btn">${Icon.download(16)} Exporter PDF</button>
        <button class="btn" id="email-btn">${Icon.send(16)} Préparer l'envoi</button>
        ${inv.type === 'quote' ? `<button class="btn btn-primary" id="convert-quote">Convertir en facture</button>` : outstanding > 0 ? `<button class="btn btn-primary" id="add-payment">Ajouter un paiement</button>` : ''}
      </div>
    </div>

    <div class="card" style="max-width:800px;margin:0 auto" id="invoice-print">
      <div style="padding:32px">
        <div style="display:flex;justify-content:space-between;margin-bottom:30px">
          <div>
            <div style="font-size:24px;font-weight:800">${inv.type === 'quote' ? 'DEVIS' : 'FACTURE'}</div>
            <div style="font-size:14px;color:var(--text-3);margin-top:4px">${escape(inv.number)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:600">Date: ${new Date(inv.issue_date).toLocaleDateString('fr-FR')}</div>
            ${inv.due_date ? `<div style="font-size:13px;color:var(--text-3);margin-top:4px">Échéance: ${new Date(inv.due_date).toLocaleDateString('fr-FR')}</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Client</div>
          <div style="font-size:16px;font-weight:700">${c ? escape(c.name) : '—'}</div>
          ${c?.company ? `<div style="font-size:13px;color:var(--text-2)">${escape(c.company)}</div>` : ''}
          ${c?.address ? `<div style="font-size:13px;color:var(--text-3)">${escape(c.address)}</div>` : ''}
          ${c?.email ? `<div style="font-size:13px;color:var(--text-3)">${escape(c.email)}</div>` : ''}
        </div>

        <table class="table" style="margin-bottom:20px">
          <thead><tr><th>Description</th><th style="text-align:right">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${(items || []).map((it) => `<tr>
              <td>${escape(it.description)}</td>
              <td style="text-align:right">${it.quantity}</td>
              <td style="text-align:right">${euro(it.unit_price)}</td>
              <td style="text-align:right;font-weight:600">${euro(it.total)}</td>
            </tr>`).join('') || '<tr><td colspan="4"><div class="empty">Aucune ligne</div></td></tr>'}
          </tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
          <div style="width:280px">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Sous-total HT</span><span>${euro(inv.subtotal)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:var(--text-3)"><span>TVA (${inv.tax_rate || 0}%)</span><span>${euro(inv.tax_amount)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:800;border-top:2px solid var(--border);margin-top:4px"><span>Total TTC</span><span>${euro(inv.total)}</span></div>
            ${inv.type !== 'quote' && paidAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#16a34a"><span>Déjà payé</span><span>-${euro(paidAmount)}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:700;color:${outstanding ? '#d97706' : '#16a34a'}"><span>Reste à payer</span><span>${euro(outstanding)}</span></div>` : ''}
          </div>
        </div>

        ${inv.type !== 'quote' && (payments || []).length ? `<div style="margin:18px 0"><div style="font-size:14px;font-weight:700;margin-bottom:8px">Paiements reçus</div>${payments.map((p) => `<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border);font-size:13px"><span>${new Date(p.date).toLocaleDateString('fr-FR')} · ${PAYMENT_LABELS[p.method] || p.method}${p.reference ? ` · ${escape(p.reference)}` : ''}</span><strong style="color:#16a34a">${euro(p.amount)}</strong></div>`).join('')}</div>` : ''}

        ${inv.notes ? `<div style="padding:14px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--text-2);margin-top:20px">${escape(inv.notes)}</div>` : ''}
        ${inv.status === 'paid' && inv.paid_date ? `<div style="margin-top:16px;text-align:center"><span class="badge badge-success">Payée le ${new Date(inv.paid_date).toLocaleDateString('fr-FR')}</span></div>` : ''}
      </div>
    </div>`

  document.getElementById('back-btn').onclick = () => renderInvoices(content)
  document.getElementById('print-btn').onclick = () => {
    const el = document.getElementById('invoice-print')
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>${inv.number}</title><style>
      body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a1a}
      h1{font-size:24px;margin:0 0 4px}
      .meta{font-size:13px;color:#666;margin-bottom:24px}
      .client{margin-bottom:20px} .client b{font-size:16px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{text-align:left;font-size:11px;text-transform:uppercase;color:#666;padding:8px;border-bottom:2px solid #ddd}
      td{padding:10px 8px;border-bottom:1px solid #eee;font-size:14px}
      .right{text-align:right}
      .totals{margin-left:auto;width:300px}
      .totals div{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
      .totals .grand{font-size:18px;font-weight:800;border-top:2px solid #ddd;padding-top:10px;margin-top:4px}
      .notes{padding:14px;background:#f5f5f5;border-radius:8px;font-size:13px;margin-top:20px}
    </style></head><body>${el.innerHTML}</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }
  const emailBtn = document.getElementById('email-btn')
  if (emailBtn) emailBtn.onclick = () => {
    if (!c?.email) { toast('Ajoutez un email au client avant l’envoi', 'error'); return }
    const subject = `${TYPE_LABELS[inv.type] || 'Facture'} ${inv.number}`
    const body = `Bonjour ${c.name},%0D%0A%0D%0AVeuillez trouver ${inv.type === 'quote' ? 'notre devis' : 'notre facture'} ${inv.number} d’un montant de ${euro(inv.total)}.%0D%0A%0D%0ACordialement`
    window.location.href = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${body}`
    supabase.from('invoices').update({ status: inv.type === 'invoice' && inv.status === 'draft' ? 'sent' : inv.status, sent_date: new Date().toISOString().slice(0, 10), email: c.email }).eq('id', inv.id)
  }

  const paymentBtn = document.getElementById('add-payment')
  if (paymentBtn) paymentBtn.onclick = () => addPayment(content, inv, outstanding)

  const convertBtn = document.getElementById('convert-quote')
  if (convertBtn) convertBtn.onclick = async () => {
    const nextNumber = await getNextNumber('invoice')
    await supabase.from('invoices').update({ type: 'invoice', number: nextNumber, status: 'draft' }).eq('id', inv.id)
    toast('Devis converti en facture', 'success')
    viewInvoice(content, { ...inv, type: 'invoice', number: nextNumber, status: 'draft' }, clientMap)
  }

  const markPaid = document.getElementById('mark-paid')
  if (markPaid) markPaid.onclick = () => addPayment(content, inv, outstanding)
}

async function addPayment(content, inv, outstanding) {
  await modal('Ajouter un paiement', (body) => {
    body.innerHTML = `<div class="field"><label>Montant reçu (€)</label><input type="number" id="p-amount" value="${outstanding.toFixed(2)}" min="0.01" step="0.01"></div>
      <div class="field"><label>Mode de paiement</label><select id="p-method">${Object.entries(PAYMENT_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>Référence</label><input id="p-ref" placeholder="Numéro de virement, reçu..."></div>
      <div class="field"><label>Date</label><input type="date" id="p-date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label>Notes</label><textarea id="p-notes"></textarea></div>`
  }, async () => {
    const amount = Number(document.getElementById('p-amount').value) || 0
    if (!amount || amount > outstanding + 0.01) { toast(`Le montant doit être inférieur ou égal à ${euro(outstanding)}`, 'error'); return false }
    const { error } = await supabase.from('payments').insert({ invoice_id: inv.id, amount, method: document.getElementById('p-method').value, reference: document.getElementById('p-ref').value.trim(), date: document.getElementById('p-date').value, notes: document.getElementById('p-notes').value.trim() })
    if (error) { toast('Impossible d’enregistrer le paiement', 'error'); return false }
    const nextStatus = amount >= outstanding - 0.01 ? 'paid' : 'sent'
    await supabase.from('invoices').update({ status: nextStatus, paid_date: nextStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null }).eq('id', inv.id)
    toast(nextStatus === 'paid' ? 'Facture soldée' : 'Paiement enregistré', 'success')
    renderInvoices(content)
  })
}

async function getNextNumber(type) {
  const { data } = await supabase.from('invoices').select('number,type').eq('type', type)
  const prefix = type === 'quote' ? 'DEV' : 'FAC'
  const year = new Date().getFullYear()
  const nums = (data || []).map((i) => Number(String(i.number).split('-').pop())).filter(Number.isFinite)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`
}

async function openForm(content, inv, clients, requestedType = 'invoice') {
  const isNew = !inv
  const invoiceType = inv?.type || requestedType
  const defaultNumber = inv?.number || await getNextNumber(invoiceType)
  const [{ data: timeEntries }, { data: deals }] = await Promise.all([
    supabase.from('time_entries').select('*').eq('billable', true).order('date', { ascending: false }),
    supabase.from('crm_deals').select('*').eq('stage', 'signed').order('created_at', { ascending: false }),
  ])

  let items = []
  if (inv) {
    const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('created_at')
    items = data || []
  }

  await modal(inv ? `Modifier le ${invoiceType === 'quote' ? 'devis' : 'facture'}` : `Nouveau ${invoiceType === 'quote' ? 'devis' : 'facture'}`, (body) => {
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Numéro</label><input id="f-number" value="${escape(defaultNumber)}"></div>
        <div class="field"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${inv?.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date d'émission</label><input type="date" id="f-issue" value="${inv?.issue_date || new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>Échéance</label><input type="date" id="f-due" value="${inv?.due_date || ''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${inv?.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>TVA (%)</label><input type="number" id="f-tax" value="${inv?.tax_rate ?? 20}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Remise (%)</label><input type="number" id="f-discount" value="${inv?.discount_percent || 0}" min="0" max="100"></div>
        <div class="field"><label>Récurrence</label><select id="f-recurring"><option value="">Non récurrente</option><option value="monthly" ${inv?.recurring_interval === 'monthly' ? 'selected' : ''}>Chaque mois</option><option value="quarterly" ${inv?.recurring_interval === 'quarterly' ? 'selected' : ''}>Chaque trimestre</option><option value="yearly" ${inv?.recurring_interval === 'yearly' ? 'selected' : ''}>Chaque année</option></select></div>
      </div>

      <div style="margin:16px 0 8px;font-size:14px;font-weight:600">Lignes de facturation</div>
      <div id="items-list"></div>
      <button class="btn btn-ghost btn-sm" id="add-item" style="margin-top:8px">${Icon.plus(14)} Ajouter une ligne</button>

      ${isNew && (timeEntries || []).length ? `
      <div style="margin:16px 0 8px;font-size:13px;color:var(--text-2)">Importer depuis le suivi du temps :</div>
      <button class="btn btn-ghost btn-sm" id="import-time">${Icon.link(14)} Importer les heures facturables</button>` : ''}

      <div class="field" style="margin-top:14px"><label>Notes</label><textarea id="f-notes">${escape(inv?.notes || '')}</textarea></div>`
  }, async () => {
    const payload = {
      number: document.getElementById('f-number').value.trim(),
      type: invoiceType,
      client_id: document.getElementById('f-client').value || null,
      issue_date: document.getElementById('f-issue').value,
      due_date: document.getElementById('f-due').value || null,
      status: document.getElementById('f-status').value,
      tax_rate: Number(document.getElementById('f-tax').value) || 0,
      discount_percent: Number(document.getElementById('f-discount').value) || 0,
      recurring: Boolean(document.getElementById('f-recurring').value),
      recurring_interval: document.getElementById('f-recurring').value,
      notes: document.getElementById('f-notes').value.trim(),
    }
    if (!payload.number) { toast('Numéro requis', 'error'); return false }

    const itemRows = [...body.querySelectorAll('.item-row')]
    const itemData = itemRows.map((r) => ({
      description: r.querySelector('.i-desc').value.trim(),
      quantity: Number(r.querySelector('.i-qty').value) || 0,
      unit_price: Number(r.querySelector('.i-price').value) || 0,
    })).filter((i) => i.description)

    const subtotal = itemData.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const discountAmount = subtotal * (payload.discount_percent / 100)
    const discountedSubtotal = subtotal - discountAmount
    const taxAmount = discountedSubtotal * (payload.tax_rate / 100)
    const total = discountedSubtotal + taxAmount
    payload.discount_amount = discountAmount
    payload.subtotal = discountedSubtotal
    payload.tax_amount = taxAmount
    payload.total = total

    let invoiceId
    if (inv) {
      const { data } = await supabase.from('invoices').update(payload).eq('id', inv.id).select()
      invoiceId = inv.id
      await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
    } else {
      const { data } = await supabase.from('invoices').insert(payload).select().single()
      invoiceId = data.id
    }

    if (itemData.length) {
      await supabase.from('invoice_items').insert(itemData.map((i) => ({ ...i, total: i.quantity * i.unit_price, invoice_id: invoiceId })))
    }

    toast(inv ? 'Facture mise à jour' : 'Facture créée', 'success')
    renderInvoices(content)
  })

  const itemsList = body.querySelector('#items-list')
  const addItem = (desc = '', qty = 1, price = 0) => {
    const row = document.createElement('div')
    row.className = 'item-row'
    row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center'
    row.innerHTML = `
      <input class="i-desc" placeholder="Description" value="${escape(desc)}" style="flex:1">
      <input class="i-qty" type="number" value="${qty}" style="width:60px" placeholder="Qté">
      <input class="i-price" type="number" value="${price}" style="width:100px" placeholder="Prix unit.">
      <button class="btn btn-ghost btn-sm btn-icon del-item">${Icon.trash(13)}</button>`
    row.querySelector('.del-item').onclick = () => row.remove()
    itemsList.appendChild(row)
  }

  if (items.length) items.forEach((it) => addItem(it.description, it.quantity, it.unit_price))
  else addItem()

  body.querySelector('#add-item').onclick = () => addItem()

  const importBtn = body.querySelector('#import-time')
  if (importBtn) importBtn.onclick = () => {
    const selectedClient = body.querySelector('#f-client').value
    const relevant = (timeEntries || []).filter((e) => !selectedClient || e.client_id === selectedClient)
    if (!relevant.length) { toast('Aucune heure facturable pour ce client', 'info'); return }
    relevant.forEach((e) => {
      const hours = (e.duration_minutes || 0) / 60
      addItem(e.description || 'Travail', hours.toFixed(2), Number(e.hourly_rate) || 50)
    })
    toast(`${relevant.length} entrée(s) importée(s)`, 'success')
  }
}

function generateNumber() {
  return 'FAC-'
}
