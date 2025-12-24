'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, CheckCircle2, Brain, Zap, Mail } from 'lucide-react';
import { createSupabaseClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 유효성 검사
    if (!email || !password || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    // 비밀번호 일치 확인
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 길이 검사
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    // 이용약관 동의 확인
    if (!agreedToTerms) {
      setError('서비스 이용약관에 동의해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseClient();
      
      // Supabase 회원가입
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || null,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        // 사용자 친화적인 에러 메시지
        if (signUpError.message.includes('already registered')) {
          setError('이미 가입된 이메일입니다. 로그인 페이지로 이동해주세요.');
        } else if (signUpError.message.includes('Invalid email')) {
          setError('유효하지 않은 이메일 주소입니다.');
        } else if (signUpError.message.includes('Password')) {
          setError('비밀번호가 너무 약합니다. 더 강력한 비밀번호를 사용해주세요.');
        } else {
          setError(signUpError.message || '회원가입에 실패했습니다. 다시 시도해주세요.');
        }
        return;
      }

      // 회원가입 성공
      if (data.user) {
        // 이메일 확인이 필요한 경우
        if (data.user.identities && data.user.identities.length === 0) {
          setSuccess('이미 가입된 이메일입니다. 이메일을 확인하거나 로그인해주세요.');
        } else {
          // 이메일 확인 필요 (Supabase 설정에서 이메일 확인 활성화된 경우)
          setSuccess(
            '회원가입이 완료되었습니다! 이메일을 확인하여 계정을 활성화해주세요. 이메일 확인 후 로그인할 수 있습니다.'
          );
          
          // 3초 후 로그인 페이지로 이동
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Signup error:', err);
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

        {/* Right Side - Signup Form */}
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
              <CardTitle className="text-2xl">회원가입</CardTitle>
              <CardDescription>
                무료로 시작하고 AI 할 일 관리를 경험하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">이름 (선택)</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="홍길동"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
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
                    placeholder="최소 6자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <Link href="/terms" className="text-primary hover:underline">
                      이용약관
                    </Link>
                    {' '}및{' '}
                    <Link href="/privacy" className="text-primary hover:underline">
                      개인정보처리방침
                    </Link>
                    에 동의합니다
                  </label>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800">
                    <Mail className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !!success}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      가입 중...
                    </span>
                  ) : (
                    '회원가입'
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="text-sm text-center text-muted-foreground">
                이미 계정이 있으신가요?{' '}
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium"
                >
                  로그인
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

