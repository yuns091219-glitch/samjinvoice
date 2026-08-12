export type Category = 
  | 'MEALS'            // 급식/식당
  | 'FACILITY'         // 시설/환경
  | 'ACADEMICS'        // 학습/진로
  | 'STUDENT_COUNCIL'  // 학생회/행사
  | 'LIFE_RULES'       // 교칙/생활
  | 'OTHER';           // 기타/자유건의

export type Status = 
  | 'RECEIVED'   // 접수됨 (🟡)
  | 'IN_REVIEW'  // 검토 중 (🔵)
  | 'ANSWERED'   // 답변 완료 (🟢)
  | 'APPLIED'    // 반영 완료 (🟣)
  | 'ON_HOLD';   // 보류 (⚪)

export interface Comment {
  id: string;
  authorNickname: string;
  isOfficial: boolean;
  officialRole?: string; // 예: '학생회 부회장', '행정실'
  content: string;
  createdAt: string;
}

export interface OfficialResponse {
  authorName: string;      // 예: '학생회장 김삼진', '학생지도부 교사'
  department: string;      // 예: '제53대 삼진고 학생회', '행정실'
  content: string;
  updatedAt: string;
  status: Status;
}

export interface Suggestion {
  id: string;
  category: Category;
  title: string;
  content: string;
  authorNickname: string;
  isSecret: boolean;
  secretPin?: string;      // 4-digit PIN to edit/delete/view if secret
  upvotes: number;
  status: Status;
  tags: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  officialResponse?: OfficialResponse;
  aiSummary?: string;
  aiCategoryReasoning?: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  isImportant?: boolean;
}

export interface LunchMenu {
  date: string;
  menuItems: string[];
  kcal: string;
  infoNotice?: string;
}

export interface AdminStats {
  totalSuggestions: number;
  receivedCount: number;
  inReviewCount: number;
  answeredCount: number;
  appliedCount: number;
  onHoldCount: number;
  categoryCounts: Record<Category, number>;
  topTags: { tag: string; count: number }[];
}

export interface GeminiResponseDraft {
  summary: string;
  suggestedStatus: Status;
  draftResponse: string;
  actionItems: string[];
}
