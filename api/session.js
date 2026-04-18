import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json({ data: { session: null } });
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.json({ data: { session: null } });
    const user = data.user;

    let profileName = user.user_metadata?.name || 'User';
    let balance = 0;

    try {
      const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
      if (profile?.name) profileName = profile.name;
    } catch {}

    try {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      if (wallet?.balance !== undefined && wallet?.balance !== null) balance = wallet.balance;
    } catch {}

    return res.json({ data: { session: { user, profileName, balance } } });
  } catch {
    return res.json({ data: { session: null } });
  }
}
