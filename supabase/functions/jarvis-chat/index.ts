// JARVIS assistant v6 — data-driven responses, no external AI dependency
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const userName = body.user_name || "";
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    const query = (lastUserMsg?.content || "").toLowerCase().trim();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const reply = await processQuery(query, supabase);
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ reply: "Désolé, problème technique. Réessayez." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function fmtEuro(n) { return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + "€"; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : ""; }

async function safeQuery(supabase, table, select, opts) {
  opts = opts || {};
  try {
    let q = supabase.from(table).select(select);
    if (opts.order) q = q.order(opts.order.col, { ascending: opts.order.ascending ?? false });
    if (opts.limit) q = q.limit(opts.limit);
    const res = await q;
    return res.data || [];
  } catch (e) { return []; }
}

async function processQuery(query, supabase) {
  if (!query) return "Bonjour" + (userName ? " " + userName : "") + " ! Je suis votre assistant. J'ai accès à toutes vos données : clients, projets, tâches, finances, factures, CRM, événements, agenda et actualités. Que puis-je faire pour vous ?";
  if (/^(bonjour|salut|coucou|hello|hey|bonsoir)/i.test(query))
    return "Bonjour" + (userName ? " " + userName : "") + " ! J'ai accès à toutes vos données : clients, projets, tâches, finances, factures, CRM, événements sportifs, réseaux sociaux, agenda et actualités. Que puis-je faire pour vous ?";
  if (/qui es.tu|ton nom|présente|que peux.tu|aide|help/i.test(query))
    return "Je suis votre assistant IA. Voici ce que je peux faire :\n\n1. \"ajoute le client Oups-Club\"\n2. \"crée une tâche: maquette Instagram, Julien, 31 août\"\n3. \"crée le projet Campagne F1\"\n4. \"montre-moi les tâches\"\n5. \"quels sont nos clients ?\"\n6. \"montre-moi les factures\"\n7. \"bilan financier\"\n8. \"vue d'ensemble\"\n9. Posez-moi une question sur vos données !";
  if (/merci/i.test(query)) return "Avec plaisir !";

  const clientMatch = query.match(/(?:ajoute|cr[ée]e|nouveau|ajouter)\s+(?:le\s+)?(?:client|compte)\s+(.+)/i);
  if (clientMatch) return await createClient(supabase, clientMatch[1].trim());
  if (/(?:cr[ée]e|ajoute|ajouter|cr[ée]er)\s+(?:moi\s+)?(?:une\s+)?(?:la\s+)?t[âa]che/i.test(query) || /t[âa]che\s*:/i.test(query))
    return await createTask(query, supabase);
  const projectMatch = query.match(/(?:cr[ée]e|ajoute|nouveau)\s+(?:le\s+)?projet\s+(.+)/i);
  if (projectMatch) return await createProject(supabase, projectMatch[1].trim());

  if (/(?:liste|affiche|montre|quelles sont)\s+(?:les\s+)?t[âa]ches/i.test(query) || /mes t[âa]ches/i.test(query)) return await listTasks(supabase);
  if (/(?:liste|affiche|montre|quels sont)\s+(?:les\s+)?clients/i.test(query)) return await listClients(supabase);
  if (/(?:liste|affiche|montre|quelles sont)\s+(?:les\s+)?factures/i.test(query)) return await listInvoices(supabase);
  if (/(?:liste|affiche|montre|quels sont)\s+(?:les\s+)?(?:[ée]v[ée]nements|courses|rallyes)/i.test(query)) return await listEvents(supabase);
  if (/(?:liste|affiche|montre|quels sont)\s+(?:les\s+)?projets/i.test(query)) return await listProjects(supabase);
  if (/(?:liste|affiche|montre|quels sont)\s+(?:les\s+)?(?:paiements|transactions)/i.test(query)) return await listPayments(supabase);
  if (/(?:liste|affiche|montre|quels sont)\s+(?:les\s+)?(?:membres|équipe)/i.test(query)) return await listTeam(supabase);

  if (/(?:combien|total|r[ée]sum[ée]|synth[èe]se|bilan)/i.test(query) && /financ/i.test(query)) return await financeSummary(supabase);
  if (/(?:revenu|chiffre|ca|recette|encaiss)/i.test(query)) return await revenueInfo(supabase);
  if (/(?:d[ée]pense|co[ûu]t|charge)/i.test(query) && !/travail|workload/i.test(query)) return await expenseInfo(supabase);

  if (/(?:tableau|dashboard|overview|r[ée]sum[ée]|synth[èe]se|bilan g[ée]n[ée]ral|vue d'ensemble)/i.test(query)) return await overview(supabase);

  if (/(?:combien|nombre|total)/i.test(query) && /projet/i.test(query)) return await countProjects(supabase);
  if (/(?:combien|nombre|total)/i.test(query) && /client/i.test(query)) return await countClients(supabase);
  if (/(?:combien|nombre|total)/i.test(query) && /t[âa]che/i.test(query)) return await countTasks(supabase);
  if (/(?:combien|nombre|total)/i.test(query) && /facture/i.test(query)) return await countInvoices(supabase);

  if (/statut|progression|avancement/i.test(query) && /projet/i.test(query)) return await projectStatus(supabase);
  if (/statut|avancement/i.test(query) && /t[âa]che/i.test(query)) return await taskStatus(supabase);

  if (/(?:en retard|overdue|d[ée]pass[ée]e)/i.test(query) && /t[âa]che/i.test(query)) return await overdueTasks(supabase);
  if (/(?:en retard|overdue|impay[ée]e)/i.test(query) && /facture/i.test(query)) return await overdueInvoices(supabase);

  if (/(?:[àa] venir|prochain|pr[ée]vu)/i.test(query) && /(?:[ée]v[ée]nement|course|rallye)/i.test(query)) return await upcomingEvents(supabase);
  if (/agenda/i.test(query)) return await agendaItems(supabase);

  if (/(?:qu'est.ce que j|qu'est.ce qu'il me|que me reste|il me reste quoi|j'ai quoi|mes t[âa]ches (?:d'|de)aujourd|aujourd'hui)/i.test(query) && /(?:t[âa]che|faire|reste|quoi)/i.test(query)) return await todayTasks(supabase);
  if (/(?:demain)/i.test(query) && /(?:t[âa]che|rendez|rdv|agenda|pr[ée]vu|quoi)/i.test(query)) return await tomorrowTasks(supabase);

  if (/(?:r[ée]seau|social|post|instagram|linkedin|facebook)/i.test(query)) return await socialInfo(supabase);
  if (/(?:crm|pipeline|opportunit|prospect)/i.test(query)) return await crmInfo(supabase);
  if (/(?:temps|suivi|productiv|heure)/i.test(query)) return await timeInfo(supabase);
  if (/(?:actualit|news|presse)/i.test(query)) return await newsInfo(supabase);
  if (/(?:charge|workload|occup)/i.test(query)) return await teamWorkload(supabase);
  if (/(?:meilleur|top|principal)/i.test(query) && /client/i.test(query)) return await topClients(supabase);

  return await contextAnswer(query, supabase);
}

async function createClient(supabase, name) {
  name = name.replace(/[.,;:!?]+$/, "").trim();
  const parts = name.split(",");
  const clientName = parts[0].trim();
  const company = (parts[1] || "").trim();
  const existingRes = await supabase.from("clients").select("id").ilike("name", clientName).maybeSingle();
  if (existingRes.data) return 'Le client "' + clientName + '" existe déjà.';
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#ea580c", "#0891b2", "#ca8a04"];
  const insRes = await supabase.from("clients").insert({ name: clientName, company, logo_color: colors[Math.floor(Math.random() * colors.length)], status: "active" }).select().single();
  if (insRes.error) return "Erreur: " + insRes.error.message;
  return "Client créé !\n\nNom: " + clientName + (company ? "\nEntreprise: " + company : "") + "\nStatut: Actif";
}

async function createTask(query, supabase) {
  let title = "";
  const colonMatch = query.match(/t[âa]che\s*:\s*(.+)/i);
  if (colonMatch) title = colonMatch[1].trim();
  else { const m = query.match(/t[âa]che(?:\s+(?:pour|à|au|d[ue]\s+))?\s+(.+)/i); title = m ? m[1].trim() : "Nouvelle tâche"; }
  title = title.split(/\s+(?:pour|à|au|d[ue]\s+|par|avant|pour le)\s+/i)[0].trim().replace(/[.,;:!?]+$/, "").trim();

  const teamRes = await supabase.from("team_members").select("*");
  let assignee = "";
  if (teamRes.data) for (const m of teamRes.data) { if (query.includes(m.first_name.toLowerCase()) || query.includes((m.first_name + " " + m.last_name).toLowerCase())) { assignee = m.first_name + " " + m.last_name; break; } }

  let dueDate = null;
  const months = { "janvier": "01", "février": "02", "fevrier": "02", "mars": "03", "avril": "04", "mai": "05", "juin": "06", "juillet": "07", "août": "08", "aout": "08", "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12", "decembre": "12" };
  const dayMatch = query.match(/(?:avant|pour le|pour|deadline)\s+(\d{1,2})\s*([a-zéûôà]+)/i);
  const dateMatch = query.match(/(\d{1,2})\s*([a-zéûôà]+)\s*(\d{4})?/i);
  let day = null, month = null, year = null;
  if (dayMatch) { day = dayMatch[1].padStart(2, "0"); month = months[dayMatch[2].toLowerCase()] || null; }
  else if (dateMatch) { day = dateMatch[1].padStart(2, "0"); month = months[dateMatch[2].toLowerCase()] || null; if (dateMatch[3]) year = dateMatch[3]; }
  if (day && month) { if (!year) { const now = new Date(); year = String(now.getFullYear()); if (new Date(year + "-" + month + "-" + day) < now) year = String(now.getFullYear() + 1); } dueDate = year + "-" + month + "-" + day; }

  let clientId = null, clientName = "";
  const clientsRes = await supabase.from("clients").select("*");
  if (clientsRes.data) for (const c of clientsRes.data) { if (query.includes(c.name.toLowerCase())) { clientId = c.id; clientName = c.name; break; } }

  let priority = "medium";
  if (/priorit[ée]\s*(?:haute|élevée|high)/i.test(query) || /urgent/i.test(query)) priority = "high";
  else if (/priorit[ée]\s*(?:basse|low)/i.test(query)) priority = "low";

  const payload = { title, status: "todo", priority, assignee: assignee || "", due_date: dueDate, client_id: clientId };
  if (clientId) { const projRes = await supabase.from("projects").select("id").eq("client_id", clientId).maybeSingle(); if (projRes.data) payload.project_id = projRes.data.id; }
  const insRes = await supabase.from("tasks").insert(payload).select().single();
  if (insRes.error) return "Erreur: " + insRes.error.message;

  let r = "Tâche créée !\n\nTitre: " + title + "\nPriorité: " + (priority === "high" ? "Haute" : priority === "low" ? "Basse" : "Moyenne") + "\n";
  if (assignee) r += "Assignée à: " + assignee + "\n";
  if (dueDate) r += "Date limite: " + fmtDate(dueDate) + "\n";
  if (clientName) r += "Client: " + clientName + "\n";
  return r;
}

async function createProject(supabase, name) {
  name = name.replace(/[.,;:!?]+$/, "").trim();
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#ea580c", "#0891b2"];
  const res = await supabase.from("projects").insert({ name, status: "planning", color: colors[Math.floor(Math.random() * colors.length)] }).select().single();
  if (res.error) return "Erreur: " + res.error.message;
  return 'Projet "' + name + '" créé !';
}

async function listTasks(supabase) {
  const res = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(15);
  if (!res.data || !res.data.length) return "Aucune tâche.";
  const sl = { todo: "À faire", doing: "En cours", review: "Revue", done: "Terminé" };
  let r = res.data.length + " tâches:\n\n";
  for (const t of res.data) r += "• " + t.title + " [" + (sl[t.status] || t.status) + "]" + (t.assignee ? " — " + t.assignee : "") + (t.due_date ? " — " + fmtDate(t.due_date) : "") + "\n";
  return r;
}

async function listClients(supabase) {
  const res = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (!res.data || !res.data.length) return "Aucun client.";
  let r = res.data.length + " client(s):\n\n";
  for (const c of res.data) r += "• " + c.name + (c.company ? " (" + c.company + ")" : "") + " — " + (c.status === "active" ? "Actif" : "Inactif") + "\n";
  return r;
}

async function listInvoices(supabase) {
  const res = await supabase.from("invoices").select("*").order("issue_date", { ascending: false }).limit(15);
  if (!res.data || !res.data.length) return "Aucune facture.";
  let r = res.data.length + " factures:\n\n";
  for (const i of res.data) r += "• " + i.number + " [" + (i.type === "quote" ? "Devis" : "Facture") + "] — " + i.status + " — " + fmtEuro(Number(i.total)) + "\n";
  return r;
}

async function listEvents(supabase) {
  const res = await supabase.from("sport_events").select("*").order("start_date", { ascending: false }).limit(10);
  if (!res.data || !res.data.length) return "Aucun événement.";
  const sl = { upcoming: "À venir", live: "En direct", completed: "Terminé", cancelled: "Annulé" };
  let r = res.data.length + " événements:\n\n";
  for (const e of res.data) { r += "• " + e.name + " [" + (sl[e.status] || e.status) + "]" + (e.discipline ? " — " + e.discipline : "") + (e.start_date ? " | " + fmtDate(e.start_date) : ""); if (e.position) r += " | " + e.position + "e"; r += "\n"; }
  return r;
}

async function listProjects(supabase) {
  const res = await supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(15);
  if (!res.data || !res.data.length) return "Aucun projet.";
  let r = res.data.length + " projets:\n\n";
  for (const p of res.data) r += "• " + p.name + " [" + p.status + "] — " + (p.progress || 0) + "%" + (p.budget ? " — Budget: " + fmtEuro(Number(p.budget)) : "") + "\n";
  return r;
}

async function listPayments(supabase) {
  const res = await supabase.from("payments").select("*").order("date", { ascending: false }).limit(10);
  if (!res.data || !res.data.length) return "Aucun paiement.";
  let r = res.data.length + " paiements:\n\n";
  for (const p of res.data) r += "• " + fmtDate(p.date) + " — " + fmtEuro(Number(p.amount)) + " — " + p.method + "\n";
  return r;
}

async function listTeam(supabase) {
  const res = await supabase.from("team_members").select("*").order("first_name");
  if (!res.data || !res.data.length) return "Aucun membre.";
  let r = res.data.length + " membres:\n\n";
  for (const m of res.data) r += "• " + m.first_name + " " + m.last_name + " — " + (m.role || "") + (m.department ? " | " + m.department : "") + "\n";
  return r;
}

async function financeSummary(supabase) {
  const [txRes, invRes, payRes] = await Promise.all([
    supabase.from("transactions").select("*"),
    supabase.from("invoices").select("*").eq("type", "invoice"),
    supabase.from("payments").select("*"),
  ]);
  const inc = (txRes.data || []).filter(function(t) { return t.type === "income"; }).reduce(function(s, t) { return s + Number(t.amount); }, 0);
  const exp = (txRes.data || []).filter(function(t) { return t.type === "expense"; }).reduce(function(s, t) { return s + Number(t.amount); }, 0);
  const ti = (invRes.data || []).reduce(function(s, i) { return s + Number(i.total); }, 0);
  const tp = (payRes.data || []).reduce(function(s, p) { return s + Number(p.amount); }, 0);
  const to = (invRes.data || []).filter(function(i) { return i.status === "overdue"; }).reduce(function(s, i) { return s + Number(i.total); }, 0);
  return "=== BILAN FINANCIER ===\n\nRevenus: " + fmtEuro(inc) + "\nDépenses: " + fmtEuro(exp) + "\nRésultat: " + fmtEuro(inc - exp) + "\n\nTotal facturé: " + fmtEuro(ti) + "\nPaiements reçus: " + fmtEuro(tp) + "\nFactures en retard: " + fmtEuro(to);
}

async function revenueInfo(supabase) {
  const txRes = await supabase.from("transactions").select("*").eq("type", "income").order("date", { ascending: false }).limit(10);
  const payRes = await supabase.from("payments").select("*").order("date", { ascending: false }).limit(10);
  const txTotal = (txRes.data || []).reduce(function(s, t) { return s + Number(t.amount); }, 0);
  const payTotal = (payRes.data || []).reduce(function(s, p) { return s + Number(p.amount); }, 0);
  let r = "=== REVENUS ===\n\nTransactions: " + fmtEuro(txTotal) + "\nPaiements: " + fmtEuro(payTotal) + "\nTotal: " + fmtEuro(txTotal + payTotal) + "\n";
  if (txRes.data && txRes.data.length) { r += "\nDernières transactions:\n"; for (const t of txRes.data.slice(0, 5)) r += "• " + fmtDate(t.date) + " — " + t.label + " — " + fmtEuro(Number(t.amount)) + "\n"; }
  return r;
}

async function expenseInfo(supabase) {
  const txRes = await supabase.from("transactions").select("*").eq("type", "expense").order("date", { ascending: false }).limit(10);
  const total = (txRes.data || []).reduce(function(s, t) { return s + Number(t.amount); }, 0);
  let r = "=== DÉPENSES ===\n\nTotal: " + fmtEuro(total) + "\n";
  if (txRes.data && txRes.data.length) { r += "\nDernières dépenses:\n"; for (const t of txRes.data) r += "• " + fmtDate(t.date) + " — " + t.label + " — " + fmtEuro(Number(t.amount)) + "\n"; }
  return r;
}

async function overview(supabase) {
  const [clients, projects, tasks, invoices, events, social, deals] = await Promise.all([
    safeQuery(supabase, "clients", "id,status"),
    safeQuery(supabase, "projects", "id,status"),
    safeQuery(supabase, "tasks", "id,status"),
    safeQuery(supabase, "invoices", "id,type,status,total"),
    safeQuery(supabase, "sport_events", "id,status"),
    safeQuery(supabase, "social_posts", "id,status"),
    safeQuery(supabase, "crm_deals", "id,stage,value"),
  ]);
  const ac = clients.filter(function(c) { return c.status === "active"; }).length;
  const ap = projects.filter(function(p) { return p.status !== "completed" && p.status !== "cancelled"; }).length;
  const pt = tasks.filter(function(t) { return t.status !== "done"; }).length;
  const dt = tasks.filter(function(t) { return t.status === "done"; }).length;
  const io = invoices.filter(function(i) { return i.type !== "quote"; });
  const paid = io.filter(function(i) { return i.status === "paid"; }).length;
  const over = io.filter(function(i) { return i.status === "overdue"; }).length;
  const ue = events.filter(function(e) { return e.status === "upcoming"; }).length;
  const sp = social.filter(function(s) { return s.status === "scheduled"; }).length;
  const pv = deals.filter(function(d) { return d.stage !== "signed" && d.stage !== "lost"; }).reduce(function(s, d) { return s + Number(d.value); }, 0);
  return "=== VUE D'ENSEMBLE ===\n\nClients actifs: " + ac + " / " + clients.length + "\nProjets en cours: " + ap + " / " + projects.length + "\nTâches: " + pt + " en cours, " + dt + " terminées\n\nFactures: " + io.length + " (" + paid + " payées, " + over + " en retard)\nÉvénements à venir: " + ue + "\nPosts programmés: " + sp + "\nPipeline CRM: " + fmtEuro(pv);
}

async function countProjects(supabase) {
  const res = await supabase.from("projects").select("*");
  const active = (res.data || []).filter(function(p) { return p.status !== "completed" && p.status !== "cancelled"; }).length;
  return "Vous avez " + (res.data ? res.data.length : 0) + " projets, dont " + active + " en cours.";
}
async function countClients(supabase) {
  const res = await supabase.from("clients").select("*");
  const active = (res.data || []).filter(function(c) { return c.status === "active"; }).length;
  return "Vous avez " + (res.data ? res.data.length : 0) + " clients, dont " + active + " actifs.";
}
async function countTasks(supabase) {
  const res = await supabase.from("tasks").select("*");
  const todo = (res.data || []).filter(function(t) { return t.status === "todo"; }).length;
  const doing = (res.data || []).filter(function(t) { return t.status === "doing"; }).length;
  const done = (res.data || []).filter(function(t) { return t.status === "done"; }).length;
  return "Vous avez " + (res.data ? res.data.length : 0) + " tâches: " + todo + " à faire, " + doing + " en cours, " + done + " terminées.";
}
async function countInvoices(supabase) {
  const res = await supabase.from("invoices").select("*");
  const inv = (res.data || []).filter(function(i) { return i.type !== "quote"; });
  const quotes = (res.data || []).filter(function(i) { return i.type === "quote"; });
  const paid = inv.filter(function(i) { return i.status === "paid"; }).length;
  const over = inv.filter(function(i) { return i.status === "overdue"; }).length;
  return "Vous avez " + inv.length + " factures (" + paid + " payées, " + over + " en retard) et " + quotes.length + " devis.";
}

async function projectStatus(supabase) {
  const res = await supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(10);
  if (!res.data || !res.data.length) return "Aucun projet.";
  const sl = { planning: "Planification", active: "En cours", on_hold: "En pause", completed: "Terminé", cancelled: "Annulé" };
  let r = "=== PROJETS ===\n\n";
  for (const p of res.data) r += "• " + p.name + " [" + (sl[p.status] || p.status) + "] — " + (p.progress || 0) + "%" + (p.budget ? " — " + fmtEuro(Number(p.budget)) : "") + "\n";
  return r;
}

async function taskStatus(supabase) {
  const res = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(15);
  if (!res.data || !res.data.length) return "Aucune tâche.";
  const sl = { todo: "À faire", doing: "En cours", review: "Revue", done: "Terminé" };
  let r = "=== TÂCHES ===\n\n";
  for (const t of res.data) r += "• " + t.title + " [" + (sl[t.status] || t.status) + "]" + (t.assignee ? " — " + t.assignee : "") + (t.due_date ? " — " + fmtDate(t.due_date) : "") + "\n";
  return r;
}

async function overdueTasks(supabase) {
  const res = await supabase.from("tasks").select("*").neq("status", "done").order("due_date", { ascending: true });
  const today = new Date().toISOString().slice(0, 10);
  const over = (res.data || []).filter(function(t) { return t.due_date && t.due_date < today; });
  if (!over.length) return "Aucune tâche en retard.";
  let r = "=== TÂCHES EN RETARD (" + over.length + ") ===\n\n";
  for (const t of over) r += "• " + t.title + (t.assignee ? " — " + t.assignee : "") + " — " + fmtDate(t.due_date) + "\n";
  return r;
}

async function overdueInvoices(supabase) {
  const res = await supabase.from("invoices").select("*").eq("status", "overdue");
  if (!res.data || !res.data.length) return "Aucune facture en retard.";
  let r = "=== FACTURES EN RETARD (" + res.data.length + ") ===\n\n";
  for (const i of res.data) r += "• " + i.number + " — " + fmtEuro(Number(i.total)) + " — " + fmtDate(i.due_date) + "\n";
  return r;
}

async function upcomingEvents(supabase) {
  const res = await supabase.from("sport_events").select("*").eq("status", "upcoming").order("start_date", { ascending: true }).limit(10);
  if (!res.data || !res.data.length) return "Aucun événement à venir.";
  let r = "=== ÉVÉNEMENTS À VENIR ===\n\n";
  for (const e of res.data) r += "• " + e.name + (e.discipline ? " — " + e.discipline : "") + (e.location ? " | " + e.location : "") + (e.start_date ? " | " + fmtDate(e.start_date) : "") + "\n";
  return r;
}

async function agendaItems(supabase) {
  const today = new Date().toISOString().slice(0, 10);
  const res = await supabase.from("agenda_events").select("*").gte("date", today).order("date", { ascending: true }).limit(10);
  if (!res.data || !res.data.length) return "Aucun événement d'agenda à venir.";
  let r = "=== AGENDA ===\n\n";
  for (const a of res.data) r += "• " + fmtDate(a.date) + " — " + a.title + (a.type ? " [" + a.type + "]" : "") + "\n";
  return r;
}

async function socialInfo(supabase) {
  const res = await supabase.from("social_posts").select("*").order("scheduled_date", { ascending: false }).limit(15);
  if (!res.data || !res.data.length) return "Aucun post.";
  const sl = { idea: "Idée", draft: "Brouillon", scheduled: "Programmé", published: "Publié" };
  let r = "=== RÉSEAUX SOCIAUX ===\n\nTotal: " + res.data.length + " posts\n\n";
  for (const s of res.data.slice(0, 8)) r += "• " + s.title + " [" + s.platform + "] " + (sl[s.status] || s.status) + (s.scheduled_date ? " — " + fmtDate(s.scheduled_date) : "") + "\n";
  return r;
}

async function crmInfo(supabase) {
  const res = await supabase.from("crm_deals").select("*").order("created_at", { ascending: false });
  if (!res.data || !res.data.length) return "Aucune opportunité CRM.";
  const sl = { prospect: "Prospect", contacted: "Contacté", meeting: "RDV", proposal: "Proposition", negotiation: "Négociation", signed: "Signé", lost: "Perdu" };
  const signed = res.data.filter(function(d) { return d.stage === "signed"; });
  const active = res.data.filter(function(d) { return d.stage !== "signed" && d.stage !== "lost"; });
  const pv = active.reduce(function(s, d) { return s + Number(d.value); }, 0);
  const sv = signed.reduce(function(s, d) { return s + Number(d.value); }, 0);
  let r = "=== CRM ===\n\nPipeline: " + fmtEuro(pv) + " (" + active.length + " opportunités)\nSigné: " + fmtEuro(sv) + " (" + signed.length + " deals)\n\n";
  for (const d of res.data.slice(0, 10)) r += "• " + d.company + " [" + (sl[d.stage] || d.stage) + "] — " + fmtEuro(Number(d.value)) + "\n";
  return r;
}

async function timeInfo(supabase) {
  const res = await supabase.from("time_entries").select("*").order("date", { ascending: false }).limit(20);
  if (!res.data || !res.data.length) return "Aucun suivi du temps.";
  const tm = res.data.reduce(function(s, e) { return s + (e.duration_minutes || 0); }, 0);
  const bm = res.data.filter(function(e) { return e.billable; }).reduce(function(s, e) { return s + (e.duration_minutes || 0); }, 0);
  const ba = res.data.filter(function(e) { return e.billable; }).reduce(function(s, e) { return s + (e.duration_minutes || 0) * Number(e.hourly_rate || 0) / 60; }, 0);
  let r = "=== SUIVI DU TEMPS ===\n\nTotal: " + Math.floor(tm / 60) + "h" + (tm % 60) + "min\nFacturable: " + Math.floor(bm / 60) + "h" + (bm % 60) + "min\nValeur: " + fmtEuro(ba) + "\n\n";
  for (const e of res.data.slice(0, 8)) r += "• " + fmtDate(e.date) + " — " + e.description + " — " + Math.floor((e.duration_minutes || 0) / 60) + "h" + ((e.duration_minutes || 0) % 60) + "min\n";
  return r;
}

async function newsInfo(supabase) {
  const res = await supabase.from("press_articles").select("*").order("published_at", { ascending: false }).limit(10);
  if (!res.data || !res.data.length) return "Aucune actualité.";
  let r = "=== ACTUALITÉS SPORT AUTO ===\n\n";
  for (const n of res.data) r += "• " + n.title + (n.source ? " (" + n.source + ")" : "") + (n.published_at ? " — " + fmtDate(n.published_at) : "") + "\n";
  return r;
}

async function teamWorkload(supabase) {
  const [teamRes, tasksRes] = await Promise.all([
    supabase.from("team_members").select("*"),
    supabase.from("tasks").select("*").neq("status", "done"),
  ]);
  if (!teamRes.data || !teamRes.data.length) return "Aucun membre.";
  const wl = {};
  for (const m of teamRes.data) wl[m.first_name + " " + m.last_name] = 0;
  for (const t of (tasksRes.data || [])) if (t.assignee && wl[t.assignee] !== undefined) wl[t.assignee]++;
  let r = "=== CHARGE DE TRAVAIL ===\n\n";
  const sorted = Object.keys(wl).sort(function(a, b) { return wl[b] - wl[a]; });
  for (const name of sorted) r += "• " + name + ": " + wl[name] + " tâche" + (wl[name] > 1 ? "s" : "") + " en cours\n";
  return r;
}

async function topClients(supabase) {
  const [clientsRes, invoicesRes] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("invoices").select("*").neq("type", "quote"),
  ]);
  if (!clientsRes.data || !clientsRes.data.length) return "Aucun client.";
  const totals = {};
  for (const i of (invoicesRes.data || [])) if (i.client_id) totals[i.client_id] = (totals[i.client_id] || 0) + Number(i.total);
  const ranked = clientsRes.data.map(function(c) { return { name: c.name, company: c.company, total: totals[c.id] || 0 }; }).sort(function(a, b) { return b.total - a.total; }).slice(0, 5);
  let r = "=== TOP CLIENTS ===\n\n";
  for (const c of ranked) r += "• " + c.name + (c.company ? " (" + c.company + ")" : "") + " — " + fmtEuro(c.total) + "\n";
  return r;
}

async function todayTasks(supabase) {
  const today = new Date().toISOString().slice(0, 10);
  const [taskRes, eventRes, agendaRes] = await Promise.all([
    supabase.from("tasks").select("*").neq("status", "done").order("due_date", { ascending: true }),
    supabase.from("sport_events").select("*").eq("status", "upcoming").gte("start_date", today).limit(3),
    supabase.from("agenda_events").select("*").gte("date", today).lte("date", today + "T23:59:59").order("date", { ascending: true }).limit(5),
  ]);
  const tasks = (taskRes.data || []).filter(function(t) { return t.due_date && t.due_date.slice(0, 10) === today; });
  const overdue = (taskRes.data || []).filter(function(t) { return t.due_date && t.due_date.slice(0, 10) < today; });
  const sl = { todo: "À faire", doing: "En cours", review: "Revue", done: "Terminé" };
  const pl = { high: "🔴", medium: "🟠", low: "🟢" };
  let r = "=== AUJOURD'HUI ===\n\n";
  if (overdue.length) {
    r += "⚠️ " + overdue.length + " tâche(s) en retard:\n";
    for (const t of overdue) r += "• " + (pl[t.priority] || "🟠") + " " + t.title + (t.assignee ? " — " + t.assignee : "") + " — prévue " + fmtDate(t.due_date) + "\n";
    r += "\n";
  }
  if (tasks.length) {
    r += "À faire aujourd'hui (" + tasks.length + "):\n";
    for (const t of tasks) r += "• " + (pl[t.priority] || "🟠") + " " + t.title + (t.assignee ? " — " + t.assignee : "") + "\n";
  } else {
    r += "Aucune tâche prévue pour aujourd'hui.\n";
  }
  if ((agendaRes.data || []).length) {
    r += "\nAgenda:\n";
    for (const a of agendaRes.data) r += "• " + a.title + (a.type ? " [" + a.type + "]" : "") + "\n";
  }
  if ((eventRes.data || []).length) {
    r += "\nÉvénements à venir:\n";
    for (const e of eventRes.data) r += "• " + e.name + " — " + fmtDate(e.start_date) + "\n";
  }
  if (overdue.length) r += "\nVous avez " + overdue.length + " tâche(s) en retard à traiter en priorité.";
  return r;
}

async function tomorrowTasks(supabase) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const taskRes = await supabase.from("tasks").select("*").neq("status", "done").order("due_date", { ascending: true });
  const tasks = (taskRes.data || []).filter(function(t) { return t.due_date && t.due_date.slice(0, 10) === tomorrow; });
  const pl = { high: "🔴", medium: "🟠", low: "🟢" };
  let r = "=== DEMAIN ===\n\n";
  if (tasks.length) {
    r += tasks.length + " tâche(s) prévue(s):\n";
    for (const t of tasks) r += "• " + (pl[t.priority] || "🟠") + " " + t.title + (t.assignee ? " — " + t.assignee : "") + "\n";
  } else {
    r += "Aucune tâche prévue pour demain.";
  }
  return r;
}

async function contextAnswer(query, supabase) {
  const [clients, projects, tasks, invoices, events, team] = await Promise.all([
    safeQuery(supabase, "clients", "name,company,status"),
    safeQuery(supabase, "projects", "name,status,progress,budget"),
    safeQuery(supabase, "tasks", "title,status,assignee"),
    safeQuery(supabase, "invoices", "number,type,status,total"),
    safeQuery(supabase, "sport_events", "name,discipline,status"),
    safeQuery(supabase, "team_members", "first_name,last_name,role"),
  ]);
  for (const c of clients) if (query.includes(c.name.toLowerCase())) return "Client: " + c.name + (c.company ? " (" + c.company + ")" : "") + "\nStatut: " + (c.status === "active" ? "Actif" : "Inactif");
  for (const p of projects) if (query.includes(p.name.toLowerCase())) return "Projet: " + p.name + "\nStatut: " + p.status + "\nProgression: " + (p.progress || 0) + "%" + (p.budget ? "\nBudget: " + fmtEuro(Number(p.budget)) : "");
  for (const m of team) if (query.includes(m.first_name.toLowerCase())) { const mt = tasks.filter(function(t) { return t.assignee && t.assignee.includes(m.first_name); }); return m.first_name + " " + m.last_name + " — " + (m.role || "Membre") + "\nTâches: " + mt.length; }
  return "Voici un résumé:\n• " + clients.length + " clients\n• " + projects.length + " projets\n• " + tasks.length + " tâches\n• " + invoices.length + " factures\n• " + events.length + " événements\n• " + team.length + " membres\n\nPosez-moi une question plus précise !";
}
