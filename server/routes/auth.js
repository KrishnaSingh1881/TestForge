import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// POST /api/auth/register
// Creates Supabase auth user + inserts into public.users via service role
router.post('/register', async (req, res) => {
  const { name, email, password, role, year, division, subject } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }

  if (!['student', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be student or admin' });
  }

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm for dev; set to false in prod with email flow
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // 2. Insert into public.users using the auth user's id
  const { error: dbError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      name,
      email,
      role,
      year:     role === 'student' ? (year     ?? null) : null,
      division: role === 'student' ? (division ?? null) : null,
      subject:  role === 'admin'   ? (subject  ?? null) : null,
    });

  if (dbError) {
    // Rollback: delete the auth user if profile insert fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: dbError.message });
  }

  return res.status(201).json({ message: 'User registered successfully' });
});

// POST /api/auth/login
// Returns Supabase session (access_token + refresh_token)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.json({ session: data.session, user: data.user });
});

// GET /api/auth/me
// Returns the public.users profile for the authenticated user
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // Verify the JWT and get the user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: profile, error: dbError } = await supabase
    .from('users')
    .select('id, name, email, role, year, division, subject, created_at')
    .eq('id', user.id)
    .single();

  if (dbError) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  return res.json({ user: profile });
});

export default router;
