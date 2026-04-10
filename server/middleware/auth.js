import { supabase } from '../supabase.js';

// Verifies Bearer token and attaches user profile to req.user
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = header.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: profile, error: dbErr } = await supabase
    .from('users')
    .select('id, name, email, role, year, division, subject')
    .eq('id', user.id)
    .single();

  if (dbErr || !profile) {
    return res.status(401).json({ error: 'User profile not found' });
  }

  req.user = profile;
  next();
}

// Gate to admin/super_admin only
export function requireAdmin(req, res, next) {
  if (!['admin', 'super_admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
