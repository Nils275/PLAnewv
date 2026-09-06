import { supabase } from './supabase.js'
import { getCurrentUser } from './views/login.js'

export async function logActivity(entityType, entityId, action, description, route) {
  const user = getCurrentUser()
  try {
    await supabase.from('activity_log').insert({
      entity_type: entityType,
      entity_id: entityId || '',
      action,
      description,
      user_name: user?.name || 'Système',
      route: route || '',
    })
  } catch {
    // silent fail — activity logging is non-critical
  }
}

export async function getRecentActivity(limit = 20) {
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d}j`
  return new Date(dateStr).toLocaleDateString('fr-FR')
}
