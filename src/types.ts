export type Category = 
  | 'MEALS'            // 급식/식당
  | 'FACILITY'         // 시설/환경
  | 'ACADEMICS'        // 학습/진로
  | 'STUDENT_COUNCIL'  // 학생회/행사
  | 'LIFE_RULES'       // 교칙/생활
  | 'OTHER';           // 기타/자유건의

export const normalizeCategory = (cat?: string): Category => {
  if (!cat) return 'OTHER';
  const c = String(cat).trim().toUpperCase();
  if (c === 'MEALS' || c === 'MEAL' || c.includes('급식') || c.includes('식당')) return 'MEALS';
  if (c === 'FACILITY' || c === 'FACILITIES' || c.includes('시설') || c.includes('환경') || c.includes('보수') || c.includes('에어컨')) return 'FACILITY';
  if (c === 'ACADEMICS' || c === 'ACADEMIC' || c.includes('학습') || c.includes('진로') || c.includes('공부') || c.includes('학업') || c.includes('수업') || c.includes('자습')) return 'ACADEMICS';
  if (c === 'STUDENT_COUNCIL' || c === 'COUNCIL' || c.includes('학생회') || c.includes('행사') || c.includes('축제')) return 'STUDENT_COUNCIL';
  if (c === 'LIFE_RULES' || c === 'LIFE' || c === 'RULES' || c === 'RULE' || c.includes('교칙') || c.includes('생활') || c.includes('규정') || c.includes('복장') || c.includes('두발')) return 'LIFE_RULES';
  if (c === 'OTHER' || c.includes('기타') || c.includes('자유') || c.includes('건의')) return 'OTHER';
  return 'OTHER';
};

export interface ExtractedMetadata {
  cleanTitle: string;
  cleanContent: string;
  pin?: string;
  category?: Category;
  authorNickname?: string;
  tags?: string[];
  comments?: Comment[];
  officialResponse?: OfficialResponse;
  isSecret?: boolean;
}

/**
 * Strip all internal metadata tags from text
 */
export const stripMetadataMarkers = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\[SECRET_POST(?::[^\]]*)?\]\s*/gi, '')
    .replace(/\[CATEGORY:[^\]]+\]\s*/gi, '')
    .replace(/\[AUTHOR:[^\]]+\]\s*/gi, '')
    .replace(/\[TAGS:[^\]]+\]\s*/gi, '')
    .replace(/\[COMMENTS:[^\]]+\]\s*/gi, '')
    .replace(/\[OFFICIAL_RESPONSE:[^\]]+\]\s*/gi, '')
    .trim();
};

export const extractMetadataFromContent = (rawTitle?: string, rawContent?: string): ExtractedMetadata => {
  const contentStr = String(rawContent || '');
  const titleStr = String(rawTitle || '');

  let pin: string | undefined;
  let category: Category | undefined;
  let authorNickname: string | undefined;
  let tags: string[] | undefined;
  let comments: Comment[] | undefined;
  let officialResponse: OfficialResponse | undefined;
  let isSecret = false;

  // 1. PIN
  const pinMatch = contentStr.match(/\[SECRET_POST(?::([^\]]*))?\]/i) || titleStr.match(/\[SECRET_POST(?::([^\]]*))?\]/i);
  if (pinMatch) {
    isSecret = true;
    if (pinMatch[1] && pinMatch[1].trim().length > 0) {
      pin = pinMatch[1].trim();
    }
  }

  // 2. Category
  const catMatch = contentStr.match(/\[CATEGORY:([^\]]+)\]/i) || titleStr.match(/\[CATEGORY:([^\]]+)\]/i);
  if (catMatch && catMatch[1]) {
    category = normalizeCategory(catMatch[1].trim());
  }

  // 3. Author Nickname
  const authorMatch = contentStr.match(/\[AUTHOR:([^\]]+)\]/i) || titleStr.match(/\[AUTHOR:([^\]]+)\]/i);
  if (authorMatch && authorMatch[1]) {
    authorNickname = authorMatch[1].trim();
  }

  // 4. Tags
  const tagsMatch = contentStr.match(/\[TAGS:([^\]]+)\]/i) || titleStr.match(/\[TAGS:([^\]]+)\]/i);
  if (tagsMatch && tagsMatch[1]) {
    tags = tagsMatch[1]
      .replace(/^[\{\[]|[\}\]]$/g, '')
      .split(',')
      .map((t) => t.replace(/["']/g, '').trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
  }

  // 5. Comments
  const commentsMatch = contentStr.match(/\[COMMENTS:([^\]]+)\]/i);
  if (commentsMatch && commentsMatch[1]) {
    try {
      const decoded = decodeURIComponent(commentsMatch[1]);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        comments = deduplicateComments(parsed);
      }
    } catch {
      try {
        const parsed = JSON.parse(commentsMatch[1]);
        if (Array.isArray(parsed)) {
          comments = deduplicateComments(parsed);
        }
      } catch {}
    }
  }

  // 6. Official Response
  const respMatch = contentStr.match(/\[OFFICIAL_RESPONSE:([^\]]+)\]/i);
  if (respMatch && respMatch[1]) {
    try {
      const decoded = decodeURIComponent(respMatch[1]);
      officialResponse = JSON.parse(decoded);
    } catch {
      try {
        officialResponse = JSON.parse(respMatch[1]);
      } catch {}
    }
  }

  const cleanTitle = stripMetadataMarkers(titleStr) || '제목 없음';
  const cleanContent = stripMetadataMarkers(contentStr);

  return {
    cleanTitle,
    cleanContent,
    pin,
    category,
    authorNickname,
    tags,
    comments,
    officialResponse,
    isSecret,
  };
};

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

/**
 * Safely merge and deduplicate comments, preventing double rendering from optimistic updates vs server responses.
 */
export const deduplicateComments = (comments?: (Comment | null | undefined)[]): Comment[] => {
  if (!Array.isArray(comments)) return [];
  const result: Comment[] = [];
  const seenIds = new Set<string>();

  for (const c of comments) {
    if (!c || !c.content) continue;
    const cleanContent = c.content.trim();
    const cleanNick = (c.authorNickname || '익명의 삼진인').trim();

    // Check if exact ID already seen
    if (c.id && seenIds.has(c.id)) {
      continue;
    }

    // Check if matching content + author exists (e.g. optimistic temp ID vs server ID)
    const existingIndex = result.findIndex((existing) => {
      if (existing.id && c.id && existing.id === c.id) return true;
      const sameContent = existing.content.trim() === cleanContent;
      const sameAuthor = (existing.authorNickname || '').trim() === cleanNick;
      const sameOfficial = Boolean(existing.isOfficial) === Boolean(c.isOfficial);

      if (sameContent && sameAuthor && sameOfficial) {
        // If created within 60 seconds of each other, consider them the same comment
        const t1 = new Date(existing.createdAt).getTime();
        const t2 = new Date(c.createdAt).getTime();
        if (isNaN(t1) || isNaN(t2) || Math.abs(t1 - t2) < 60000) {
          return true;
        }
      }
      return false;
    });

    if (existingIndex !== -1) {
      const existing = result[existingIndex];
      // If existing is temporary (starts with 'comment-') and new one is server assigned (e.g. 'c-'), prefer server version
      if (existing.id?.startsWith('comment-') && !c.id?.startsWith('comment-')) {
        seenIds.delete(existing.id);
        result[existingIndex] = c;
        if (c.id) seenIds.add(c.id);
      }
      continue;
    }

    if (c.id) seenIds.add(c.id);
    result.push(c);
  }

  return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

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

/**
 * Universal check whether a suggestion is a secret post
 */
export const isSecretSuggestion = (s?: Suggestion | null | any): boolean => {
  if (!s) return false;
  if (s.isSecret === true) return true;
  if (s.secretPin && String(s.secretPin).trim().length > 0) return true;
  if (Array.isArray(s.tags) && (s.tags.includes('#비밀글') || s.tags.includes('비밀글'))) return true;
  const content = String(s.content || '');
  if (content.startsWith('🔒 비밀글입니다') || content.includes('[SECRET_POST]')) return true;
  const title = String(s.title || '');
  if (title.includes('[SECRET_POST]')) return true;
  return false;
};

/**
 * Get all post IDs that this browser / user is authorized to view unmasked
 */
export const getUnlockedPostIds = (): string[] => {
  try {
    const myIds: string[] = JSON.parse(localStorage.getItem('samjin_my_post_ids') || '[]');
    const unlockedIds: string[] = JSON.parse(localStorage.getItem('samjin_unlocked_post_ids') || '[]');
    const all = new Set([...myIds.map(String), ...unlockedIds.map(String)]);
    return Array.from(all);
  } catch {
    return [];
  }
};

/**
 * Check if a post is currently unlocked for this user on this browser
 */
export const isPostUnlocked = (id: string, isAdmin: boolean = false): boolean => {
  if (isAdmin) return true;
  const stringId = String(id);
  const unlocked = getUnlockedPostIds();
  return unlocked.includes(stringId);
};

/**
 * Mark a post as unlocked in this browser
 */
export const markPostAsUnlocked = (id: string): void => {
  try {
    const stringId = String(id);
    const existing: string[] = JSON.parse(localStorage.getItem('samjin_unlocked_post_ids') || '[]');
    if (!existing.map(String).includes(stringId)) {
      existing.push(stringId);
      localStorage.setItem('samjin_unlocked_post_ids', JSON.stringify(existing));
    }
  } catch (e) {
    console.error(e);
  }
};
