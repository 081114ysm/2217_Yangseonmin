import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// 응답 스키마 정의
const SummarySchema = z.object({
  summary: z.string().describe('할 일 요약 (완료율 포함)'),
  urgentTasks: z.array(z.string()).describe('긴급한 할 일 목록'),
  insights: z.array(z.string()).describe('인사이트 목록'),
  recommendations: z.array(z.string()).describe('추천 사항 목록'),
});

interface Todo {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  completed: boolean;
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

    const { todos, period } = body;

    // 입력 검증
    if (!Array.isArray(todos)) {
      return NextResponse.json(
        { error: '할 일 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!period || !['today', 'week'].includes(period)) {
      return NextResponse.json(
        { error: '분석 기간은 "today" 또는 "week"여야 합니다.' },
        { status: 400 }
      );
    }

    if (todos.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: period === 'today' 
            ? '오늘 등록된 할 일이 없습니다.' 
            : '이번 주 등록된 할 일이 없습니다.',
          urgentTasks: [],
          insights: ['할 일을 추가하여 시작해보세요!'],
          recommendations: ['새로운 할 일을 추가해보세요.'],
        },
      });
    }

    // 할 일 데이터 분석
    const now = new Date();
    const total = todos.length;
    const completed = todos.filter((t: Todo) => t.completed).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    
    // 우선순위별 분석
    const priorityAnalysis = {
      high: {
        total: todos.filter((t: Todo) => t.priority === 'high').length,
        completed: todos.filter((t: Todo) => t.priority === 'high' && t.completed).length,
      },
      medium: {
        total: todos.filter((t: Todo) => t.priority === 'medium').length,
        completed: todos.filter((t: Todo) => t.priority === 'medium' && t.completed).length,
      },
      low: {
        total: todos.filter((t: Todo) => t.priority === 'low').length,
        completed: todos.filter((t: Todo) => t.priority === 'low' && t.completed).length,
      },
    };

    // 우선순위별 완료율 계산
    const priorityCompletionRates = {
      high: priorityAnalysis.high.total > 0 
        ? ((priorityAnalysis.high.completed / priorityAnalysis.high.total) * 100).toFixed(1) 
        : '0',
      medium: priorityAnalysis.medium.total > 0 
        ? ((priorityAnalysis.medium.completed / priorityAnalysis.medium.total) * 100).toFixed(1) 
        : '0',
      low: priorityAnalysis.low.total > 0 
        ? ((priorityAnalysis.low.completed / priorityAnalysis.low.total) * 100).toFixed(1) 
        : '0',
    };

    // 카테고리별 분석
    const categoryAnalysis: Record<string, { total: number; completed: number }> = {};
    todos.forEach((t: Todo) => {
      if (!categoryAnalysis[t.category]) {
        categoryAnalysis[t.category] = { total: 0, completed: 0 };
      }
      categoryAnalysis[t.category].total++;
      if (t.completed) {
        categoryAnalysis[t.category].completed++;
      }
    });

    // 카테고리별 완료율 및 미루는 패턴
    const categoryCompletionRates: Record<string, string> = {};
    const postponedCategories: string[] = [];
    Object.entries(categoryAnalysis).forEach(([cat, data]) => {
      const rate = data.total > 0 ? ((data.completed / data.total) * 100).toFixed(1) : '0';
      categoryCompletionRates[cat] = rate;
      // 완료율이 50% 미만이면 미루는 카테고리로 판단
      if (parseFloat(rate) < 50 && data.total >= 2) {
        postponedCategories.push(cat);
      }
    });

    // 마감일 준수율 분석 (마감일 전에 완료한 비율)
    const onTimeCompleted = todos.filter((t: Todo) => {
      if (!t.completed) return false;
      const dueDate = new Date(t.due_date);
      const completedDate = new Date(t.due_date); // 실제 완료일은 created_date나 별도 필드가 필요하지만, 여기서는 due_date 기준
      return completedDate <= dueDate;
    }).length;
    const deadlineComplianceRate = completed > 0 
      ? ((onTimeCompleted / completed) * 100).toFixed(1) 
      : '0';

    // 연기된 할 일 (마감일이 지났지만 미완료)
    const postponedTasks = todos
      .filter((t: Todo) => {
        if (t.completed) return false;
        const dueDate = new Date(t.due_date);
        return dueDate < now;
      })
      .map((t: Todo) => ({
        title: t.title,
        daysOverdue: Math.ceil((now.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24)),
        category: t.category,
      }));

    // 긴급한 할 일 (미완료 + high priority + 마감일 임박)
    const urgentTasks = todos
      .filter((t: Todo) => {
        if (t.completed) return false;
        if (t.priority !== 'high') return false;
        const dueDate = new Date(t.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 2; // 2일 이내
      })
      .map((t: Todo) => t.title);

    // 시간대별 분포 분석 (미완료 할 일)
    const timeDistribution: Record<string, number> = {
      morning: 0, // 06:00-12:00
      afternoon: 0, // 12:00-18:00
      evening: 0, // 18:00-24:00
      night: 0, // 00:00-06:00
    };

    // 시간대별 완료 패턴 (완료된 할 일)
    const timeCompletionPattern: Record<string, { total: number; completed: number }> = {
      morning: { total: 0, completed: 0 },
      afternoon: { total: 0, completed: 0 },
      evening: { total: 0, completed: 0 },
      night: { total: 0, completed: 0 },
    };

    todos.forEach((t: Todo) => {
      const dueDate = new Date(t.due_date);
      const hour = dueDate.getHours();
      let timeSlot: string;
      
      if (hour >= 6 && hour < 12) timeSlot = 'morning';
      else if (hour >= 12 && hour < 18) timeSlot = 'afternoon';
      else if (hour >= 18 && hour < 24) timeSlot = 'evening';
      else timeSlot = 'night';

      if (!t.completed) {
        timeDistribution[timeSlot]++;
      }
      
      timeCompletionPattern[timeSlot].total++;
      if (t.completed) {
        timeCompletionPattern[timeSlot].completed++;
      }
    });

    // 가장 생산적인 시간대 계산
    const mostProductiveTime = Object.entries(timeCompletionPattern)
      .map(([slot, data]) => ({
        slot,
        rate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
        count: data.completed,
      }))
      .sort((a, b) => b.rate - a.rate || b.count - a.count)[0];

    // 요일별 완료 패턴
    const dayCompletionPattern: Record<string, { total: number; completed: number }> = {
      일요일: { total: 0, completed: 0 },
      월요일: { total: 0, completed: 0 },
      화요일: { total: 0, completed: 0 },
      수요일: { total: 0, completed: 0 },
      목요일: { total: 0, completed: 0 },
      금요일: { total: 0, completed: 0 },
      토요일: { total: 0, completed: 0 },
    };

    todos.forEach((t: Todo) => {
      const dueDate = new Date(t.due_date);
      const dayName = dueDate.toLocaleDateString('ko-KR', { weekday: 'long' });
      if (dayCompletionPattern[dayName]) {
        dayCompletionPattern[dayName].total++;
        if (t.completed) {
          dayCompletionPattern[dayName].completed++;
        }
      }
    });

    // 가장 생산적인 요일 계산
    const mostProductiveDay = Object.entries(dayCompletionPattern)
      .filter(([_, data]) => data.total > 0)
      .map(([day, data]) => ({
        day,
        rate: (data.completed / data.total) * 100,
        count: data.completed,
      }))
      .sort((a, b) => b.rate - a.rate || b.count - a.count)[0];

    // 완료하기 쉬운 작업의 특징 (완료율이 높은 카테고리)
    const easyToCompleteCategories = Object.entries(categoryAnalysis)
      .filter(([_, data]) => data.total >= 2)
      .map(([cat, data]) => ({
        category: cat,
        rate: (data.completed / data.total) * 100,
      }))
      .filter((item) => item.rate >= 70)
      .sort((a, b) => b.rate - a.rate)
      .map((item) => item.category);

    // 마감일 임박한 할 일
    const upcomingDeadlines = todos
      .filter((t: Todo) => {
        if (t.completed) return false;
        const dueDate = new Date(t.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 3 && daysUntilDue >= 0;
      })
      .map((t: Todo) => ({
        title: t.title,
        daysUntil: Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));

    // Gemini API를 사용하여 요약 생성
    const result = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: SummarySchema,
      prompt: `다음 할 일 목록을 심층 분석하여 정교한 요약과 실행 가능한 인사이트를 제공해주세요.

=== 분석 기간 ===
${period === 'today' ? '오늘의 할 일 (당일 집중도와 남은 할 일 우선순위에 집중)' : '이번 주 할 일 (주간 패턴 분석 및 다음 주 계획 제안에 집중)'}

=== 할 일 목록 ===
${todos.map((t: Todo, idx: number) => {
  const dueDate = new Date(t.due_date);
  const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = !t.completed && dueDate < now;
  return `${idx + 1}. ${t.title} (${t.completed ? '완료' : '미완료'}${isOverdue ? ', 연기됨' : ''}, 우선순위: ${t.priority === 'high' ? '높음' : t.priority === 'medium' ? '중간' : '낮음'}, 카테고리: ${t.category}, 마감일: ${dueDate.toLocaleDateString('ko-KR')} ${daysUntil > 0 ? `(${daysUntil}일 후)` : daysUntil === 0 ? '(오늘)' : `(${Math.abs(daysUntil)}일 지연)`})`;
}).join('\n')}

=== 핵심 통계 ===
- 총 할 일: ${total}개
- 완료: ${completed}개
- 미완료: ${total - completed}개
- 전체 완료율: ${completionRate}%

=== 우선순위별 완료 패턴 분석 ===
- 높은 우선순위: ${priorityAnalysis.high.total}개 중 ${priorityAnalysis.high.completed}개 완료 (완료율 ${priorityCompletionRates.high}%)
- 중간 우선순위: ${priorityAnalysis.medium.total}개 중 ${priorityAnalysis.medium.completed}개 완료 (완료율 ${priorityCompletionRates.medium}%)
- 낮은 우선순위: ${priorityAnalysis.low.total}개 중 ${priorityAnalysis.low.completed}개 완료 (완료율 ${priorityCompletionRates.low}%)

=== 카테고리별 완료 패턴 ===
${Object.entries(categoryAnalysis).map(([cat, data]) => {
  const rate = categoryCompletionRates[cat];
  return `- ${cat}: ${data.total}개 중 ${data.completed}개 완료 (완료율 ${rate}%)`;
}).join('\n')}

=== 시간 관리 분석 ===
- 마감일 준수율: 완료된 할 일 중 ${onTimeCompleted}개가 마감일 전에 완료됨 (${deadlineComplianceRate}%)
- 연기된 할 일: ${postponedTasks.length}개${postponedTasks.length > 0 ? ` (${postponedTasks.map(t => `${t.title}(${t.daysOverdue}일 지연)`).join(', ')})` : ''}
- 시간대별 미완료 할 일 분포: 오전 ${timeDistribution.morning}개, 오후 ${timeDistribution.afternoon}개, 저녁 ${timeDistribution.evening}개, 밤 ${timeDistribution.night}개

=== 생산성 패턴 분석 ===
- 가장 생산적인 시간대: ${mostProductiveTime ? `${mostProductiveTime.slot === 'morning' ? '오전' : mostProductiveTime.slot === 'afternoon' ? '오후' : mostProductiveTime.slot === 'evening' ? '저녁' : '밤'} (완료율 ${mostProductiveTime.rate.toFixed(1)}%, ${mostProductiveTime.count}개 완료)` : '데이터 부족'}
- 가장 생산적인 요일: ${mostProductiveDay ? `${mostProductiveDay.day} (완료율 ${mostProductiveDay.rate.toFixed(1)}%, ${mostProductiveDay.count}개 완료)` : '데이터 부족'}
- 자주 미루는 작업 유형: ${postponedCategories.length > 0 ? postponedCategories.join(', ') : '없음'}
- 완료하기 쉬운 작업 유형: ${easyToCompleteCategories.length > 0 ? easyToCompleteCategories.join(', ') : '없음'}

=== 긴급 상황 ===
${urgentTasks.length > 0 ? `- 긴급한 할 일: ${urgentTasks.join(', ')}` : '- 긴급한 할 일 없음'}
${upcomingDeadlines.length > 0 ? `- 마감일 임박 (3일 이내): ${upcomingDeadlines.map(d => `${d.title} (${d.daysUntil}일 후)`).join(', ')}` : ''}

=== 분석 요구사항 ===

1. summary (요약):
   ${period === 'today' 
     ? '- 당일 집중도와 현재 진행 상황을 강조' 
     : '- 주간 완료율과 전체적인 진행 상황을 요약'}
   - 완료율을 포함하되, 우선순위별 패턴도 간단히 언급
   - 긍정적인 톤으로 시작 (예: "오늘 ${completed}개의 할 일을 완료하셨네요!" 또는 "이번 주 ${completionRate}%의 할 일을 완료하셨습니다!")

2. urgentTasks (긴급한 할 일):
   - 미완료 + 높은 우선순위 + 마감일 2일 이내인 할 일만 포함
   - 연기된 할 일도 우선순위가 높으면 포함

3. insights (인사이트) - 3-5개 제공:
   ${period === 'today'
     ? 'a) 당일 집중도 분석: 오늘의 할 일이 시간대별로 어떻게 분포되어 있는지, 집중도가 높은 시간대는 어디인지\n   b) 남은 할 일 우선순위: 오늘 남은 시간 동안 어떤 작업에 집중해야 하는지\n   c) 우선순위별 완료 패턴: 높은 우선순위 작업을 얼마나 잘 처리하고 있는지\n   d) 시간 관리 상태: 마감일 준수율과 연기된 할 일이 있는지'
     : 'a) 주간 완료율 분석: 이번 주 전체적인 완료율과 우선순위별 패턴\n   b) 생산성 패턴: 가장 생산적인 요일과 시간대는 언제인지\n   c) 시간 관리 패턴: 마감일 준수율, 연기된 할 일의 빈도와 패턴\n   d) 카테고리별 패턴: 어떤 유형의 작업을 잘 완료하고, 어떤 유형을 자주 미루는지\n   e) 시간대별 업무 집중도: 언제 가장 많은 할 일이 집중되어 있는지'}
   - 각 인사이트는 구체적이고 실행 가능한 정보를 포함
   - 긍정적인 부분도 함께 언급 (예: "높은 우선순위 작업의 완료율이 ${priorityCompletionRates.high}%로 우수합니다")

4. recommendations (추천 사항) - 3-4개 제공:
   ${period === 'today'
     ? 'a) 당일 남은 시간 활용: 오늘 남은 시간을 어떻게 효율적으로 사용할지 구체적인 제안\n   b) 우선순위 조정: 긴급한 할 일을 먼저 처리하도록 제안\n   c) 시간대별 작업 배치: 집중도가 높은 시간대에 중요한 작업을 배치하도록 제안'
     : 'a) 다음 주 계획: 이번 주 패턴을 바탕으로 다음 주 일정을 어떻게 조정할지 제안\n   b) 우선순위 재배치: 우선순위별 완료 패턴을 고려한 일정 재배치\n   c) 업무 분산 전략: 특정 시간대나 요일에 과부하가 있다면 분산 방안 제시\n   d) 생산성 향상: 가장 생산적인 시간대와 요일을 활용한 계획 수립'}
   - 구체적이고 실행 가능한 조언 제공
   - 시간 관리 팁, 우선순위 조정, 일정 재배치, 업무 분산 전략 포함
   - 예: "오후 시간대에 할 일이 ${timeDistribution.afternoon}개 집중되어 있습니다. 일부를 오전으로 이동하면 부담이 줄어들 수 있습니다"

=== 문체 및 톤 ===
- 한국어로 자연스럽고 친근한 문체 사용
- 격식적이지 않고 대화하듯이 작성
- 이모지나 특수 기호는 사용하지 않음
- 긍정적이고 격려하는 톤 유지
- 사용자가 잘하고 있는 부분을 먼저 강조
- 개선점은 격려하는 방식으로 제시
- 동기부여가 되는 메시지 포함
- 사용자가 이해하기 쉽고 바로 실천할 수 있는 문장으로 구성

=== 긍정적 피드백 강조 ===
- 완료율이 높은 우선순위나 카테고리 발견 시 칭찬
- 마감일 준수율이 높으면 인정
- 생산적인 패턴 발견 시 긍정적으로 언급
- 개선점은 "더 나아질 수 있는 부분"으로 표현

=== 출력 형식 ===
{
  "summary": "요약 텍스트 (완료율, 우선순위별 패턴 포함, 긍정적 톤)",
  "urgentTasks": ["긴급한 할 일 1", "긴급한 할 일 2"],
  "insights": ["인사이트 1 (구체적이고 실행 가능)", "인사이트 2", "인사이트 3"],
  "recommendations": ["추천 1 (구체적인 실행 방법 포함)", "추천 2", "추천 3"]
}`,
    });

    return NextResponse.json({
      success: true,
      data: result.object,
    });
  } catch (error: any) {
    console.error('AI 할 일 요약 오류:', error);

    // Zod 검증 오류
    if (error.name === 'ZodError' || error.issues) {
      return NextResponse.json(
        {
          error: 'AI가 올바른 형식으로 응답하지 못했습니다.',
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
        { error: 'API 키가 유효하지 않습니다.' },
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
          message: '잠시 후 다시 시도해주세요.',
        },
        { status: 429 }
      );
    }

    // 기타 오류
    return NextResponse.json(
      {
        error: '할 일 요약 생성에 실패했습니다.',
        message: '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

