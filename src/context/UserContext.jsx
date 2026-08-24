import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const devFallbackSession = { user: { email: 'surajjawrani2022@gmail.com' } };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || (isDev ? devFallbackSession : null));
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || (isDev ? devFallbackSession : null));
      setLoading(false);
    });

    return () => {
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const loginWithGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  const logout = () => supabase.auth.signOut();

  // Map logged-in email / Google account metadata to 'Suraj' or 'Shivam' profile identity
  const email = (session?.user?.email || '').toLowerCase();
  const metaName = (session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '').toLowerCase();
  
  let currentUser = 'Suraj';
  if (email.includes('shivam') || metaName.includes('shivam')) {
    currentUser = 'Shivam';
  } else if (email.includes('suraj') || metaName.includes('suraj')) {
    currentUser = 'Suraj';
  } else if (session?.user?.user_metadata?.name) {
    currentUser = session.user.user_metadata.name.split(' ')[0];
  } else if (email) {
    currentUser = email.split('@')[0];
  }

  return (
    <UserContext.Provider value={{ session, currentUser, login, loginWithGoogle, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
