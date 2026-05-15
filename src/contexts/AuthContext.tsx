import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  matches_played: number;
  matches_won: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  loadingProfile: boolean;
  fetchProfile: (userId: string) => Promise<void>;
  upsertProfile: (username: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  loadingProfile: false,
  fetchProfile: async () => {},
  upsertProfile: async () => ({ error: null })
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchProfile = async (userId: string) => {
    setLoadingProfile(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError || !profileData) {
        setProfile(null);
        return;
      }

      const { count: played } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'completed');

      const { count: won } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('winner_id', userId)
        .eq('status', 'completed');

      setProfile({
        ...profileData,
        matches_played: played ?? 0,
        matches_won: won ?? 0,
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const upsertProfile = async (username: string) => {
    if (!user) return { error: 'No user' };
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id, 
        username,
        email: user.email  // Store email for searchability
      })
      .select()
      .single();

    if (!error && data) {
      setProfile({ ...data, matches_played: profile?.matches_played ?? 0, matches_won: profile?.matches_won ?? 0 });
    }
    return { error };
  };


  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      loadingProfile, 
      fetchProfile, 
      upsertProfile 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
