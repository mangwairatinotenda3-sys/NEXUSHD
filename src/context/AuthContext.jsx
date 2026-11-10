import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
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
      supabase.auth.signUp({ email, password, options: { data: { username } } }),
    []
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

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

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      updateUsername,
    }),
    [session, profile, loading, signIn, signUp, signOut, updateUsername]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
