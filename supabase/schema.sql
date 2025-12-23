-- ============================================================================
-- AI 기반 할 일 관리(To-Do) 서비스 데이터베이스 스키마
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. 사용자 프로필 테이블 (public.users)
-- ============================================================================
-- auth.users와 1:1로 연결되는 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 사용자 프로필 테이블 인덱스
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);

-- 사용자 프로필 테이블 코멘트
COMMENT ON TABLE public.users IS '사용자 프로필 정보를 저장하는 테이블 (auth.users와 1:1 관계)';
COMMENT ON COLUMN public.users.id IS 'auth.users(id)와 동일한 UUID';
COMMENT ON COLUMN public.users.email IS '사용자 이메일 (auth.users.email과 동기화)';
COMMENT ON COLUMN public.users.full_name IS '사용자 이름';
COMMENT ON COLUMN public.users.avatar_url IS '프로필 이미지 URL';

-- ============================================================================
-- 2. 할 일(To-Do) 테이블 (public.todos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 할 일 테이블 인덱스
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS todos_due_date_idx ON public.todos(due_date);
CREATE INDEX IF NOT EXISTS todos_priority_idx ON public.todos(priority);
CREATE INDEX IF NOT EXISTS todos_category_idx ON public.todos(category);
CREATE INDEX IF NOT EXISTS todos_completed_idx ON public.todos(completed);
CREATE INDEX IF NOT EXISTS todos_created_date_idx ON public.todos(created_date);

-- 할 일 테이블 코멘트
COMMENT ON TABLE public.todos IS '사용자별 할 일 관리 테이블';
COMMENT ON COLUMN public.todos.id IS '할 일 고유 ID';
COMMENT ON COLUMN public.todos.user_id IS '할 일 소유자 ID (users 테이블 참조)';
COMMENT ON COLUMN public.todos.title IS '할 일 제목 (필수)';
COMMENT ON COLUMN public.todos.description IS '할 일 상세 설명';
COMMENT ON COLUMN public.todos.created_date IS '할 일 생성일';
COMMENT ON COLUMN public.todos.due_date IS '할 일 마감일 (필수)';
COMMENT ON COLUMN public.todos.priority IS '우선순위 (high/medium/low)';
COMMENT ON COLUMN public.todos.category IS '카테고리 (업무/개인/학습/기타)';
COMMENT ON COLUMN public.todos.completed IS '완료 여부';

-- ============================================================================
-- 3. Row Level Security (RLS) 정책
-- ============================================================================

-- 3.1 사용자 프로필 테이블 RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 사용자 프로필 읽기 정책 (본인만)
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 사용자 프로필 생성 정책 (본인만)
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 사용자 프로필 수정 정책 (본인만)
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 사용자 프로필 삭제 정책 (본인만)
CREATE POLICY "Users can delete own profile"
  ON public.users
  FOR DELETE
  USING (auth.uid() = id);

-- 3.2 할 일 테이블 RLS 활성화
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- 할 일 읽기 정책 (본인 소유만)
CREATE POLICY "Users can view own todos"
  ON public.todos
  FOR SELECT
  USING (auth.uid() = user_id);

-- 할 일 생성 정책 (본인 소유만)
CREATE POLICY "Users can insert own todos"
  ON public.todos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 할 일 수정 정책 (본인 소유만)
CREATE POLICY "Users can update own todos"
  ON public.todos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 할 일 삭제 정책 (본인 소유만)
CREATE POLICY "Users can delete own todos"
  ON public.todos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. 트리거 함수 (updated_at 자동 업데이트)
-- ============================================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users 테이블 updated_at 트리거
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- todos 테이블 updated_at 트리거
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. 회원가입 시 자동 프로필 생성 함수
-- ============================================================================

-- auth.users에 새 사용자가 생성되면 자동으로 public.users 프로필 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users 생성 시 트리거
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. 샘플 데이터 (선택사항 - 테스트용)
-- ============================================================================

-- 샘플 데이터는 실제 사용자 가입 후 자동으로 생성됩니다
-- 아래는 참고용 쿼리입니다:

/*
-- 샘플 할 일 데이터 (실제 user_id로 교체 필요)
INSERT INTO public.todos (user_id, title, description, due_date, priority, category, completed)
VALUES
  (
    'YOUR_USER_ID_HERE',
    '프로젝트 기획서 작성',
    '신규 서비스 기획서 초안 작성 및 팀원 검토 요청',
    NOW() + INTERVAL '2 days',
    'high',
    '업무',
    false
  ),
  (
    'YOUR_USER_ID_HERE',
    'Next.js 공부하기',
    'App Router와 Server Components 개념 학습',
    NOW() + INTERVAL '5 days',
    'medium',
    '학습',
    false
  ),
  (
    'YOUR_USER_ID_HERE',
    '운동하기',
    '헬스장 가서 1시간 운동',
    NOW(),
    'low',
    '개인',
    true
  );
*/

-- ============================================================================
-- 완료!
-- ============================================================================
-- 이 SQL 파일을 Supabase SQL Editor에서 실행하면 됩니다.
-- 순서:
-- 1. Supabase Dashboard 접속
-- 2. SQL Editor 메뉴 선택
-- 3. 이 파일의 내용을 붙여넣기
-- 4. 'Run' 버튼 클릭
-- ============================================================================

