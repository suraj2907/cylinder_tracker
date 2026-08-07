import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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

  // Map logged-in email to existing 'Suraj' or 'Shivam' profile identity
  const email = session?.user?.email;
  const currentUser = email 
    ? (email.toLowerCase().includes('shivam') ? 'Shivam' : 'Suraj') 
    : 'Suraj';

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
