import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { RegisterValues } from '@/lib/validation';
import type { AccountStatus, Profile, Student, UserRole } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  student: Student | null;
  loading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  status: AccountStatus | null;
  isActive: boolean;
  isPending: boolean;
  isRejected: boolean;
  isLocked: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (values: RegisterValues) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (userId: string) => {
    const p = await authService.getProfile(userId);
    setProfile(p);
    if (p?.role === 'student' && p.status === 'active') {
      const s = await authService.getStudentByUserId(userId);
      setStudent(s);
    } else {
      setStudent(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!session?.user) return;
    await loadUser(session.user.id);
  }, [loadUser, session?.user]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    authService
      .getSession()
      .then(async (s) => {
        if (!active) return;
        setSession(s);
        if (s?.user) await loadUser(s.user.id);
      })
      .finally(() => active && setLoading(false));

    const { data: sub } = authService.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        void loadUser(s.user.id);
      } else {
        setProfile(null);
        setStudent(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUser]);

  // Pick up lock / status changes without requiring sign-out
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !isSupabaseConfigured) return;

    // Unique name avoids Strict Mode / remount colliding with an already-subscribed channel
    const channel = supabase
      .channel(`profile-self-${userId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          void loadUser(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id, loadUser]);

  const status = profile?.status ?? null;
  const isLocked = Boolean(profile?.is_locked);
  const isActive = status === 'active' && !isLocked;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      student,
      loading,
      isAuthenticated: Boolean(session),
      role: profile?.role ?? null,
      status,
      isActive,
      isPending: status === 'pending',
      isRejected: status === 'rejected',
      isLocked,
      isTeacher: isActive && (profile?.role === 'teacher' || profile?.role === 'admin'),
      isStudent: isActive && profile?.role === 'student',
      isAdmin: isActive && profile?.role === 'admin',
      async signIn(email, password) {
        await authService.signIn(email, password);
      },
      async signUp(values) {
        await authService.signUp(values);
      },
      async signOut() {
        await authService.signOut();
        setProfile(null);
        setStudent(null);
      },
      refresh,
    }),
    [session, profile, student, loading, status, isActive, isLocked, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
