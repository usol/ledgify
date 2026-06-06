import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, name, role, email }
  const [loading, setLoading] = useState(true);

  // 현재 세션 유저의 profile(name, role) 조회
  const loadProfile = async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", sessionUser.id)
      .single();

    if (error || !data) {
      setUser(null);
      return;
    }
    setUser({
      id: sessionUser.id,
      email: sessionUser.email,
      name: data.name,
      role: data.role,
    });
  };

  useEffect(() => {
    // 초기 세션 복원
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await loadProfile(session?.user ?? null);
      setLoading(false);
    });

    // 세션 변화 감지 (로그인/로그아웃/토큰갱신)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadProfile(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    // onAuthStateChange 가 profile 로딩을 처리
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
