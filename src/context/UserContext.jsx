import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('cylinder_tracker_user');
      if (saved && (saved === 'Suraj' || saved === 'Shivam')) {
        return saved;
      }
    } catch (e) {
      console.error('Failed to load user', e);
    }
    return 'Suraj'; // Default to Suraj
  });

  useEffect(() => {
    try {
      localStorage.setItem('cylinder_tracker_user', currentUser);
    } catch (e) {
      console.error('Failed to save user', e);
    }
  }, [currentUser]);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
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
