# PRD (제품 요구사항 정의서)
## AI 기반 할 일 관리(To-Do) 서비스

---

## 1. 제품 개요

### 1.1 목적
본 제품은 사용자의 할 일을 효율적으로 관리하고, AI를 활용해 할 일 생성 및 요약·분석을 제공하는 웹 기반 To-Do 관리 서비스이다.  
Supabase Auth를 통한 인증, CRUD 기반 할 일 관리, 검색/필터/정렬, AI 기능을 핵심 가치로 한다.

### 1.2 타겟 사용자
- 개인 일정 및 업무를 체계적으로 관리하고 싶은 사용자
- 학습, 업무, 개인 목표를 동시에 관리하는 학생 및 직장인

### 1.3 핵심 가치
- 간편한 할 일 관리
- AI 기반 자동화(생성, 요약, 분석)
- 직관적인 UI/UX

---

## 2. 주요 기능 요구사항

### 2.1 사용자 인증 (Authentication)

#### 기능 설명
- 이메일/비밀번호 기반 회원가입 및 로그인
- Supabase Auth 사용

#### 세부 요구사항
- 회원가입 시 이메일 인증 지원
- 로그인 상태 유지 (세션 관리)
- 로그아웃 기능 제공

---

### 2.2 할 일 관리 (CRUD)

#### 기능 설명
사용자는 자신의 할 일을 생성, 조회, 수정, 삭제할 수 있다.

#### 할 일 데이터 필드
| 필드명 | 타입 | 설명 |
|------|------|------|
| id | UUID | 할 일 고유 ID |
| user_id | UUID | 사용자 ID (users 테이블 참조) |
| title | string | 할 일 제목 |
| description | text | 할 일 설명 |
| created_date | datetime | 생성일 |
| due_date | datetime | 마감일 |
| priority | enum | high / medium / low |
| category | string | 업무 / 개인 / 학습 등 |
| completed | boolean | 완료 여부 |

#### 세부 요구사항
- 할 일 생성 시 필수값: title, due_date
- 수정 시 모든 필드 수정 가능
- 삭제 시 소프트 삭제 고려 가능 (추후 확장)

---

### 2.3 검색, 필터, 정렬 기능

#### 검색
- 제목(title), 설명(description) 기준 부분 검색

#### 필터
- 우선순위: 높음 / 중간 / 낮음
- 카테고리: 업무 / 개인 / 학습 등
- 진행 상태:
  - 진행 중 (completed = false && due_date >= today)
  - 완료 (completed = true)
  - 지연 (completed = false && due_date < today)

#### 정렬
- 우선순위순
- 마감일순
- 생성일순

---

### 2.4 AI 할 일 생성 기능

#### 기능 설명
사용자가 자연어로 입력한 문장을 AI가 분석하여 구조화된 할 일 데이터로 변환한다.

#### 입력 예시
"내일 오전 10시에 팀 회의 준비"

#### 출력 예시
```json
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 작성하기",
  "created_date": "YYYY-MM-DD HH:MM",
  "due_date": "YYYY-MM-DD 10:00",
  "priority": "high",
  "category": "업무",
  "completed": false
}
```

#### 세부 요구사항
- Google Gemini API 사용
- 날짜/시간 자동 파싱
- 사용자가 최종 저장 전 수정 가능

---

### 2.5 AI 요약 및 분석 기능

#### 기능 설명
버튼 클릭 한 번으로 전체 할 일을 AI가 분석하여 요약 결과 제공

#### 요약 종류
- 일일 요약
  - 오늘 완료된 할 일 목록
  - 남은 할 일 요약
- 주간 요약
  - 이번 주 전체 할 일 수
  - 완료율(%)
  - 주요 미완료 작업

---

## 3. 화면 구성 (UI/UX)

### 3.1 로그인 / 회원가입 화면
- 이메일 / 비밀번호 입력 폼
- 로그인 / 회원가입 전환
- 인증 에러 메시지 표시

### 3.2 할 일 관리 메인 화면
- 상단: 검색창, 필터, 정렬 옵션
- 중앙: 할 일 목록
- 하단/플로팅 버튼: 할 일 추가
- AI 기능:
  - 자연어 할 일 생성 입력창
  - AI 요약 및 분석 버튼

### 3.3 통계 및 분석 화면 (확장)
- 주간/월간 완료율 차트
- 카테고리별 할 일 비율
- 활동량 시각화

---

## 4. 기술 스택

### 프론트엔드
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui

### 백엔드 / 인프라
- Supabase
  - Auth
  - PostgreSQL
  - Row Level Security(RLS)

### AI
- Google Gemini API (AI SDK 활용)

---

## 5. 데이터 구조 (Supabase)

### 5.1 users
- Supabase Auth 기본 테이블 사용
- 주요 필드: id, email, created_at

### 5.2 todos
```sql
todos (
  id uuid primary key,
  user_id uuid references auth.users(id),
  title text not null,
  description text,
  created_date timestamptz default now(),
  due_date timestamptz,
  priority text,
  category text,
  completed boolean default false
)
```

#### 보안 정책 (RLS)
- user_id = auth.uid() 인 데이터만 접근 가능

---

## 6. 비기능 요구사항

- 반응형 디자인 (모바일/데스크톱)
- 평균 응답 시간 1초 이내
- AI 요청 실패 시 사용자 친화적 에러 처리

---

## 7. 향후 확장 계획

- 알림 기능 (이메일/푸시)
- 캘린더 연동
- 팀/공유 할 일 기능
- 다국어 지원

---

## 8. 성공 지표 (KPI)

- 일일 활성 사용자(DAU)
- 할 일 생성 대비 완료율
- AI 기능 사용률
