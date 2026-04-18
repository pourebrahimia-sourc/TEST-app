import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userData.user.id).maybeSingle();
    return res.json({ balance: wallet?.balance || 0, userId: userData.user.id });
  } catch {
    return res.json({ balance: 0, userId: userData.user.id });
  }
}
