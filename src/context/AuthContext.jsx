import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

// Where emails send people back to (must also be listed in Supabase → Authentication → URL Configuration)
const SITE_URL = 'https://mangwairatinotenda3-sys.github.io/NEXUSHD/';
const AVATAR_BUCKET = 'avatars';

/* A password-reset email link brings the person back with a one-time token in
   the address. It is read once, here, before the router starts, and the
   address is cleaned so the token never stays in the history. */
function readEmailLink() {
  try {
    const hash = window.location.hash || '';
    if (!/access_token=|error_code=|error=/.test(hash)) return null;
    const params = new URLSearchParams(hash.replace(/^#\/?/, ''));
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/profile`);
    if (params.get('error') || params.get('error_code')) {
      return { error: 'This link has expired or was already used. Ask for a new one.' };
    }
    if (params.get('access_token')) {
      return {
        type: params.get('type') || 'signup',
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token') || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

const emailLink = readEmailLink();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(emailLink?.type === 'recovery');
  const [linkError, setLinkError] = useState(emailLink?.error || '');

  useEffect(() => {
    let active = true;

    const start = async () => {
      // a confirmation or reset link: sign the person in with its token
      if (emailLink?.access_token) {
        const { error } = await supabase.auth.setSession({
          access_token: emailLink.access_token,
          refresh_token: emailLink.refresh_token,
        });
        if (error && active) {
          setRecovering(false);
          setLinkError('This link has expired or was already used. Ask for a new one.');
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    };
    start().catch(() => active && setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return undefined;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile(data);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    []
  );

  const signUp = useCallback(
    (email, password, username) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: SITE_URL },
      }),
    []
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const resendConfirmation = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: SITE_URL },
    });
    return error || null;
  }, []);

  /* ---------- Forgot password ---------- */

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
    return error || null;
  }, []);

  // For the 6-digit code in the reset email: checks the code, then sets the new password
  const resetWithCode = useCallback(async (email, code, password) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) return error;
    const { error: updateError } = await supabase.auth.updateUser({ password });
    return updateError || null;
  }, []);

  // Used by the reset link, and by Change password when signed in
  const setPassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error;
    setRecovering(false);
    return null;
  }, []);

  const cancelRecovery = useCallback(async () => {
    setRecovering(false);
    await supabase.auth.signOut();
  }, []);

  /* ---------- Profile ---------- */

  const updateUsername = useCallback(
    async (username) => {
      if (!userId) return new Error('Not signed in');
      const { error } = await supabase.from('profiles').update({ username }).eq('id', userId);
      if (error) return error;
      setProfile((p) => ({ ...(p || {}), username }));
      return null;
    },
    [userId]
  );

  const saveAvatarUrl = useCallback(
    async (avatar_url) => {
      const { error } = await supabase.from('profiles').update({ avatar_url }).eq('id', userId);
      if (error) return error;
      setProfile((p) => ({ ...(p || {}), avatar_url }));
      return null;
    },
    [userId]
  );

  const uploadAvatar = useCallback(
    async (blob) => {
      if (!userId) return new Error('Not signed in');
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
      if (error) return error;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      // the number on the end makes phones load the new picture instead of the old one
      return saveAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
    },
    [userId, saveAvatarUrl]
  );

  const removeAvatar = useCallback(async () => {
    if (!userId) return new Error('Not signed in');
    await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.jpg`]);
    return saveAvatarUrl(null);
  }, [userId, saveAvatarUrl]);

  /* ---------- Delete account ---------- */

  const deleteAccount = useCallback(async () => {
    if (!userId) return new Error('Not signed in');
    await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.jpg`]);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return error;
    try {
      window.localStorage.removeItem('nexushd:watchlist');
      window.localStorage.removeItem('nexushd:watchlist-owner');
    } catch {
      /* storage unavailable */
    }
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }, [userId]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      recovering,
      linkError,
      signIn,
      signUp,
      signOut,
      resendConfirmation,
      requestPasswordReset,
      resetWithCode,
      setPassword,
      cancelRecovery,
      updateUsername,
      uploadAvatar,
      removeAvatar,
      deleteAccount,
    }),
    [
      session,
      profile,
      loading,
      recovering,
      linkError,
      signIn,
      signUp,
      signOut,
      resendConfirmation,
      requestPasswordReset,
      resetWithCode,
      setPassword,
      cancelRecovery,
      updateUsername,
      uploadAvatar,
      removeAvatar,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
