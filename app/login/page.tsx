'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, CheckCircle2, Brain, Zap } from 'lucide-react';
import { createSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 이미 로그인된 경우 메인 페이지로 리다이렉트
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // 이미 로그인된 경우 메인 페이지로 리다이렉트
        router.push('/');
        return;
      }

      setIsCheckingAuth(false);

      // 인증 상태 변경 감지
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          router.push('/');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    checkAuth();
  }, [router]);

  // 인증 확인 중에는 로딩 표시
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 유효성 검사
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    // 비밀번호 공백 검사
    if (password.trim() !== password || password.length === 0) {
      setError('비밀번호에 공백이 포함될 수 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseClient();

      // Supabase 로그인
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // 사용자 친화적인 에러 메시지
        if (signInError.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.');
        } else if (signInError.message.includes('Invalid email')) {
          setError('유효하지 않은 이메일 주소입니다.');
        } else {
          setError('로그인에 실패했습니다. 다시 시도해주세요.');
        }
        return;
      }

      // 로그인 성공
      if (data.session) {
        // 메인 페이지로 이동
        router.push('/');
        router.refresh(); // 서버 컴포넌트 새로고침
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex flex-col justify-center space-y-6 px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                AI To-Do
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              AI가 함께하는 스마트한 할 일 관리
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <FeatureItem
              icon={<Brain className="h-5 w-5" />}
              title="AI 자동 생성"
              description="자연어로 입력하면 AI가 구조화된 할 일로 변환"
            />
            <FeatureItem
              icon={<Zap className="h-5 w-5" />}
              title="스마트 분석"
              description="일일/주간 요약으로 생산성을 한눈에 확인"
            />
            <FeatureItem
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="체계적 관리"
              description="우선순위, 카테고리, 마감일로 효율적으로 정리"
            />
          </div>

          <div className="pt-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 border-2 border-white dark:border-gray-900"
                  />
                ))}
              </div>
              <span>이미 <strong className="text-foreground">1,000+</strong> 명이 사용중</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md shadow-2xl border-2">
            <CardHeader className="space-y-2">
              <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  AI To-Do
                </h1>
              </div>
              <CardTitle className="text-2xl">로그인</CardTitle>
              <CardDescription>
                계정에 로그인하여 할 일을 관리하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      로그인 중...
                    </span>
                  ) : (
                    '로그인'
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="text-sm text-center text-muted-foreground">
                아직 계정이 없으신가요?{' '}
                <Link
                  href="/signup"
                  className="text-primary hover:underline font-medium"
                >
                  회원가입
                </Link>
              </div>
              <div className="text-xs text-center text-muted-foreground">
                <Link href="/forgot-password" className="hover:underline">
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

