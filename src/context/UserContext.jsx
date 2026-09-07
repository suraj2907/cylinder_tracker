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

  // Map logged-in email to 'Suraj' or 'Shivam' profile identity - exact match against the two
  // partners' known account emails, not a substring guess. A substring check on email/name
  // silently defaulted to 'Suraj' for any account it didn't recognize, which is how Shivam's own
  // entries ended up permanently mislabeled as Suraj's on his phone without anyone noticing.
  const KNOWN_ACCOUNTS = {
    'surajjawrani2011@gmail.com': 'Suraj',
    'surajjawrani2022@gmail.com': 'Suraj',
    'shivam09498@gmail.com': 'Shivam'
  };
  const email = (session?.user?.email || '').toLowerCase();
  const metaName = (session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '').toLowerCase();

  let currentUser = KNOWN_ACCOUNTS[email];
  if (!currentUser) {
    // Unrecognized account - don't silently guess "Suraj". Surface something identifiable instead
    // so a wrong/new login is obvious in the UI and in saved records, not invisibly mislabeled.
    if (metaName.includes('shivam')) currentUser = 'Shivam';
    else if (metaName.includes('suraj')) currentUser = 'Suraj';
    else if (session?.user?.user_metadata?.name) currentUser = session.user.user_metadata.name.split(' ')[0];
    else if (email) currentUser = email.split('@')[0];
    else currentUser = 'Suraj';
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
