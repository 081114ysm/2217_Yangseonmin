import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// 상수 정의
const INPUT_MIN_LENGTH = 2;
const INPUT_MAX_LENGTH = 500;
const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 100;

// 응답 스키마 정의
const TodoSchema = z.object({
  title: z.string().describe('할 일 제목'),
  due_date: z.string().describe('마감일 (YYYY-MM-DD 형식)'),
  due_time: z.string().describe('마감 시간 (HH:mm 형식, 시간이 없으면 "09:00")'),
  priority: z.enum(['high', 'medium', 'low']).describe('우선순위'),
  category: z.enum(['업무', '개인', '학습', '건강', '기타']).describe('카테고리'),
});

// 입력 검증 함수
function validateInput(input: string): { valid: boolean; error?: string } {
  // 빈 문자열 체크
  if (!input || input.trim().length === 0) {
    return { valid: false, error: '입력 텍스트가 필요합니다.' };
  }

  // 최소 길이 체크 (공백 제거 후)
  const trimmedLength = input.trim().length;
  if (trimmedLength < INPUT_MIN_LENGTH) {
    return {
      valid: false,
      error: `입력은 최소 ${INPUT_MIN_LENGTH}자 이상이어야 합니다. (현재: ${trimmedLength}자)`,
    };
  }

  // 최대 길이 체크 (원본 길이 기준)
  if (input.length > INPUT_MAX_LENGTH) {
    return {
      valid: false,
      error: `입력은 최대 ${INPUT_MAX_LENGTH}자까지 가능합니다. (현재: ${input.length}자)`,
    };
  }

  // 특수 문자나 이모지 체크 (문제가 되는 문자만 필터링)
  // 제어 문자나 보이지 않는 문자 체크
  const controlCharRegex = /[\x00-\x1F\x7F-\x9F]/;
  if (controlCharRegex.test(input)) {
    return {
      valid: false,
      error: '입력에 허용되지 않는 문자가 포함되어 있습니다.',
    };
  }

  return { valid: true };
}

// 입력 전처리 함수
function preprocessInput(input: string): string {
  // 앞뒤 공백 제거
  let processed = input.trim();

  // 연속된 공백을 하나로 통합
  processed = processed.replace(/\s+/g, ' ');

  // 대소문자 정규화 (한글은 영향 없음, 영문만 처리)
  // 한글 입력이 주로 사용되므로 특별한 대소문자 변환은 하지 않음
  // 필요시 processed = processed.toLowerCase() 추가 가능

  return processed;
}

// 후처리 함수
function postprocessTodoData(
  todoData: z.infer<typeof TodoSchema>,
  currentDate: string
): z.infer<typeof TodoSchema> {
  // 제목 길이 조정
  let title = todoData.title.trim();
  if (title.length < TITLE_MIN_LENGTH) {
    title = '할 일';
  } else if (title.length > TITLE_MAX_LENGTH) {
    title = title.substring(0, TITLE_MAX_LENGTH - 3) + '...';
  }

  // 날짜 검증 및 과거 날짜 처리
  let dueDate = todoData.due_date;
  try {
    const inputDate = new Date(dueDate);
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    inputDate.setHours(0, 0, 0, 0);

    // 과거 날짜인 경우 오늘로 변경
    if (inputDate < today) {
      dueDate = currentDate;
    }
  } catch (error) {
    // 날짜 파싱 실패 시 오늘로 설정
    dueDate = currentDate;
  }

  // 시간 검증
  let dueTime = todoData.due_time;
  if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(dueTime)) {
    dueTime = '09:00';
  }

  // 우선순위 기본값
  const priority = todoData.priority || 'medium';

  // 카테고리 기본값
  const category = todoData.category || '기타';

  return {
    title,
    due_date: dueDate,
    due_time: dueTime,
    priority,
    category,
  };
}

export async function POST(request: NextRequest) {
  try {
    // API 키 확인
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 요청 본문 파싱
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다. JSON 형식으로 요청해주세요.' },
        { status: 400 }
      );
    }

    const { input } = body;

    // 입력 타입 검증
    if (typeof input !== 'string') {
      return NextResponse.json(
        { error: '입력은 문자열 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // 입력 검증
    const validation = validateInput(input);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || '입력 검증에 실패했습니다.' },
        { status: 400 }
      );
    }

    // 입력 전처리
    const processedInput = preprocessInput(input);

    // 현재 날짜 정보를 컨텍스트로 제공
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5);
    const currentDay = now.toLocaleDateString('ko-KR', { weekday: 'long' });
    const currentDayOfWeek = now.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일

    // 이번 주와 다음 주의 요일 계산을 위한 정보
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayNamesEn = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Gemini API를 사용하여 구조화된 데이터 생성
    // gemini-2.5-flash가 지원되지 않을 경우 gemini-2.0-flash-exp 또는 gemini-1.5-flash로 변경 가능
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: TodoSchema,
      prompt: `다음 자연어 입력을 할 일 데이터로 JSON 형식으로 변환해주세요.

현재 날짜: ${currentDate} (${currentDay})
현재 시간: ${currentTime}
현재 요일: ${dayNames[currentDayOfWeek]}

입력: "${processedInput}"

=== 반드시 준수할 변환 규칙 ===

1. 제목(title):
   - 핵심 내용만 간결하게 추출
   - 불필요한 날짜/시간 표현 제거
   - 예: "내일 오후 3시까지 중요한 팀 회의 준비하기" -> "팀 회의 준비"

2. 날짜(due_date) - YYYY-MM-DD 형식으로 반환:
   - "오늘" -> ${currentDate} (현재 날짜)
   - "내일" -> ${getTomorrowDate()} (현재 날짜 + 1일)
   - "모레" -> ${getDayAfterTomorrowDate()} (현재 날짜 + 2일)
   - "이번 주 [요일]" -> 가장 가까운 해당 요일의 날짜 계산
     * 예: "이번 주 금요일" -> 이번 주 금요일 날짜 (${getThisWeekFriday()})
   - "다음 주 [요일]" -> 다음 주의 해당 요일 날짜 계산
     * 예: "다음 주 월요일" -> 다음 주 월요일 날짜 (${getNextWeekMonday()})
   - 날짜가 명시되지 않으면 ${currentDate} (오늘)로 설정

3. 시간(due_time) - HH:mm 형식으로 반환 (24시간 형식):
   - "아침" -> 09:00
   - "점심" -> 12:00
   - "오후" -> 14:00
   - "저녁" -> 18:00
   - "밤" -> 21:00
   - "오전/오후 [시간]시" -> 24시간 형식으로 변환
     * 예: "오전 10시" -> 10:00
     * 예: "오후 3시" -> 15:00
     * 예: "오후 3시 30분" -> 15:30
   - 시간이 명시되지 않으면 "09:00"을 기본값으로 사용

4. 우선순위(priority) - 반드시 다음 키워드 기준으로 판단:
   - "high": 다음 키워드 중 하나라도 포함되면 "high"
     * "급하게", "중요한", "빨리", "꼭", "반드시"
   - "medium": 다음 경우에 "medium"
     * "보통", "적당히" 키워드가 포함된 경우
     * 우선순위 관련 키워드가 전혀 없는 경우
   - "low": 다음 키워드 중 하나라도 포함되면 "low"
     * "여유롭게", "천천히", "언젠가"

5. 카테고리(category) - 반드시 다음 키워드 기준으로 분류:
   - "업무": 다음 키워드 중 하나라도 포함되면 "업무"
     * "회의", "보고서", "프로젝트", "업무"
   - "개인": 다음 키워드 중 하나라도 포함되면 "개인"
     * "쇼핑", "친구", "가족", "개인"
   - "건강": 다음 키워드 중 하나라도 포함되면 "건강"
     * "운동", "병원", "건강", "요가"
   - "학습": 다음 키워드 중 하나라도 포함되면 "학습"
     * "공부", "책", "강의", "학습"
   - 위 키워드가 모두 없으면 "기타"

=== 출력 형식 ===
반드시 다음 JSON 형식을 정확히 준수하세요:
{
  "title": "할 일 제목",
  "due_date": "YYYY-MM-DD",
  "due_time": "HH:mm",
  "priority": "high|medium|low",
  "category": "업무|개인|학습|건강|기타"
}

=== 예시 ===
입력: "내일 오후 3시까지 중요한 팀 회의 준비하기"
출력: {
  "title": "팀 회의 준비",
  "due_date": "${getTomorrowDate()}",
  "due_time": "15:00",
  "priority": "high",
  "category": "업무"
}

입력: "이번 주 금요일 점심에 친구 만나기"
출력: {
  "title": "친구 만나기",
  "due_date": "${getThisWeekFriday()}",
  "due_time": "12:00",
  "priority": "medium",
  "category": "개인"
}

입력: "다음 주 월요일 아침에 운동하기"
출력: {
  "title": "운동하기",
  "due_date": "${getNextWeekMonday()}",
  "due_time": "09:00",
  "priority": "medium",
  "category": "건강"
}`,
    });

    // 결과 검증 및 후처리
    let todoData = result.object;

    // 후처리 적용
    todoData = postprocessTodoData(todoData, currentDate);

    // 날짜와 시간을 결합하여 ISO 문자열 생성
    const dueDateTime = combineDateAndTime(todoData.due_date, todoData.due_time);

    return NextResponse.json({
      success: true,
      data: {
        title: todoData.title,
        description: undefined,
        due_date: dueDateTime,
        priority: todoData.priority,
        category: todoData.category,
      },
    });
  } catch (error: any) {
    console.error('AI 할 일 생성 오류:', error);

    // Zod 검증 오류 (AI 응답 형식 오류)
    if (error.name === 'ZodError' || error.issues) {
      return NextResponse.json(
        {
          error: 'AI가 올바른 형식으로 응답하지 못했습니다. 입력을 다시 확인해주세요.',
          details:
            process.env.NODE_ENV === 'development'
              ? error.message || JSON.stringify(error.issues)
              : undefined,
        },
        { status: 400 }
      );
    }

    // API 키 오류
    if (
      error.message?.includes('API key') ||
      error.message?.includes('API_KEY') ||
      error.status === 401
    ) {
      return NextResponse.json(
        { error: 'API 키가 유효하지 않습니다. 서버 설정을 확인해주세요.' },
        { status: 401 }
      );
    }

    // Rate limit / Quota 오류
    if (
      error.message?.includes('rate limit') ||
      error.message?.includes('quota') ||
      error.message?.includes('429') ||
      error.status === 429
    ) {
      return NextResponse.json(
        {
          error: 'API 사용량 한도를 초과했습니다.',
          message: '잠시 후 다시 시도해주세요. 일반적으로 몇 분 후에 다시 시도할 수 있습니다.',
        },
        { status: 429 }
      );
    }

    // 네트워크 오류
    if (
      error.message?.includes('network') ||
      error.message?.includes('fetch') ||
      error.message?.includes('ECONNREFUSED')
    ) {
      return NextResponse.json(
        {
          error: '네트워크 오류가 발생했습니다.',
          message: '인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.',
        },
        { status: 500 }
      );
    }

    // AI 처리 실패 (400 에러)
    if (error.status === 400 || error.message?.includes('invalid')) {
      return NextResponse.json(
        {
          error: 'AI 처리에 실패했습니다.',
          message: '입력 내용을 확인하고 다시 시도해주세요.',
          details:
            process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 400 }
      );
    }

    // 기타 오류
    return NextResponse.json(
      {
        error: '할 일 생성에 실패했습니다.',
        message: '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

// 날짜와 시간을 결합하여 ISO 문자열로 변환
function combineDateAndTime(dateStr: string, timeStr: string): string {
  try {
    // 날짜 파싱
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // 시간 파싱
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Date 객체 생성 (로컬 시간대 기준)
    const date = new Date(year, month - 1, day, hours, minutes, 0);

    // ISO 문자열로 변환
    return date.toISOString();
  } catch (error) {
    console.error('날짜/시간 결합 오류:', error);
    // 오류 발생 시 기본값 반환
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    return today.toISOString();
  }
}

// 내일 날짜를 YYYY-MM-DD 형식으로 반환
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// 모레 날짜를 YYYY-MM-DD 형식으로 반환
function getDayAfterTomorrowDate(): string {
  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  return dayAfterTomorrow.toISOString().split('T')[0];
}

// 이번 주 금요일 날짜를 YYYY-MM-DD 형식으로 반환
// 오늘이 금요일이면 오늘, 금요일 이후면 다음 주 금요일, 금요일 이전이면 이번 주 금요일
function getThisWeekFriday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일요일, 1=월요일, ..., 5=금요일, 6=토요일
  let daysUntilFriday: number;
  
  if (dayOfWeek === 5) {
    // 오늘이 금요일이면 오늘
    daysUntilFriday = 0;
  } else if (dayOfWeek > 5) {
    // 오늘이 토요일이면 다음 주 금요일
    daysUntilFriday = 7 - dayOfWeek + 5;
  } else {
    // 오늘이 금요일 이전이면 이번 주 금요일
    daysUntilFriday = 5 - dayOfWeek;
  }
  
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);
  return friday.toISOString().split('T')[0];
}

// 다음 주 월요일 날짜를 YYYY-MM-DD 형식으로 반환
function getNextWeekMonday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
  const daysUntilNextMonday = (1 - dayOfWeek + 7) % 7 || 7; // 다음 월요일까지 남은 일수
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilNextMonday);
  return nextMonday.toISOString().split('T')[0];
}

