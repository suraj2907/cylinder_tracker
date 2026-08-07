import { useState, useEffect } from 'react';

export const TABS = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "batches", label: "📦 Batches & Supply" },
  { id: "payments", label: "💰 Cashflow & Wallet" },
  { id: "calendar", label: "📅 Calendar Log" },
  { id: "restaurants", label: "🏪 Restaurants" },
  { id: "gasPredictor", label: "🔮 Gas Predictor" },
  { id: "add", label: "➕ Add Entry" },
];

const VALID_TAB_IDS = TABS.map(t => t.id);

export function useHashNavigation() {
  const [tab, setTab] = useState(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      
      // Skip tab initialization if the hash is actually a Supabase auth callback
      if (hash && (hash.includes('access_token=') || hash.includes('error=') || hash.includes('refresh_token='))) {
        return "dashboard";
      }

      if (hash && VALID_TAB_IDS.includes(hash)) {
        return hash;
      }
      const savedTab = localStorage.getItem('cylinder_active_tab');
      if (savedTab && VALID_TAB_IDS.includes(savedTab)) {
        return savedTab;
      }
    } catch (e) {
      console.error('Error loading tab state', e);
    }
    return "dashboard";
  });

  useEffect(() => {
    const hash = window.location.hash;
    // DO NOT overwrite the hash if it is a Supabase authentication callback
    if (hash.includes('access_token=') || hash.includes('error=') || hash.includes('refresh_token=')) {
      return;
    }
    // DO NOT overwrite the hash if the URL contains a query code (PKCE flow callback)
    if (window.location.search.includes('code=')) {
      return;
    }

    try {
      localStorage.setItem('cylinder_active_tab', tab);
      window.location.hash = tab;
    } catch (e) {
      console.error('Error saving tab state', e);
    }
  }, [tab]);

  // Sync state if hash changes via browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      
      // Skip routing changes for OAuth parameters
      if (hash && (hash.includes('access_token=') || hash.includes('error=') || hash.includes('refresh_token='))) {
        return;
      }

      if (hash && VALID_TAB_IDS.includes(hash)) {
        setTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return { tab, setTab, TABS };
}
