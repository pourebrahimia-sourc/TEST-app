import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

function getSiteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, email, password, name, access_token, refresh_token } = req.body || {};

  if (type === 'google') {
    const origin = getSiteOrigin(req);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/result.html`,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ url: data.url });
  }

  if (type === 'login') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ user: data.user, session: data.session || null });
  }

  if (type === 'signup') {
    const trimmedName = (name || '').trim();
    if (!email || !password || !trimmedName) return res.status(400).json({ error: 'Missing name, email or password' });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: trimmedName } }
    });
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.user?.id) return res.status(400).json({ error: 'Signup failed' });

    const userId = data.user.id;
    try {
      const { data: existingWallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', userId).maybeSingle();
      if (!existingWallet) await supabaseAdmin.from('wallets').insert([{ user_id: userId, balance: 10 }]);
    } catch {}
    try {
      const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
      if (!existingUser) await supabaseAdmin.from('users').insert([{ id: userId, name: trimmedName }]);
    } catch {}

    return res.json({ user: data.user, session: data.session || null });
  }

  if (type === 'forgot') {
    const origin = getSiteOrigin(req);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password.html` });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  }

  if (type === 'update-password') {
    if (!access_token || !refresh_token || !password) return res.status(400).json({ error: 'Missing token or password' });
    const temp = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { session }, error: sessionError } = await temp.auth.setSession({ access_token, refresh_token });
    if (sessionError || !session) return res.status(400).json({ error: 'Invalid session' });
    const { error } = await temp.auth.updateUser({ password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid type' });
}
