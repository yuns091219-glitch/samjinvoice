import { createClient } from '@supabase/supabase-js';
import { Suggestion, Category, Status, normalizeCategory } from '../types';

// Retrieve credentials from environment
const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : {};
const env = meta.env || {};
const procEnv = typeof process !== 'undefined' ? process.env || {} : {};

const rawUrl =
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  procEnv.NEXT_PUBLIC_SUPABASE_URL ||
  'https://kkuxgcagafbqdwplbosc.supabase.co/rest/v1/';

const rawKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_dYKxqroaiXsmA-1UTRiVvw_luy_t3iN';

// Sanitize URL for createClient if it ends with /rest/v1 or /rest/v1/
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(supabaseUrl, rawKey);

/**
 * Status mapping between frontend Status types and DB strings
 */
const mapStatusFromDB = (dbStatus?: string): Status => {
  if (!dbStatus) return 'RECEIVED';
  if (dbStatus === '접수중' || dbStatus === 'RECEIVED') return 'RECEIVED';
  if (dbStatus === '검토중' || dbStatus === 'IN_REVIEW') return 'IN_REVIEW';
  if (dbStatus === '답변완료' || dbStatus === 'ANSWERED') return 'ANSWERED';
  if (dbStatus === '반영완료' || dbStatus === 'APPLIED') return 'APPLIED';
  if (dbStatus === '보류' || dbStatus === 'ON_HOLD') return 'ON_HOLD';
  return 'RECEIVED';
};

const mapStatusToDB = (status: Status): string => {
  switch (status) {
    case 'RECEIVED':
      return '접수중';
    case 'IN_REVIEW':
      return '검토중';
    case 'ANSWERED':
      return '답변완료';
    case 'APPLIED':
      return '반영완료';
    case 'ON_HOLD':
      return '보류';
    default:
      return '접수중';
  }
};

/**
 * Convert Supabase DB row to Suggestion object
 */
export const mapRowToSuggestion = (row: any): Suggestion => {
  const tagsArr = Array.isArray(row.tags) ? row.tags : [];
  
  let rawContent = String(row.content || '');
  let rawTitle = String(row.title || '제목 없음');
  
  let extractedPin: string | undefined = undefined;
  
  // Extract secret pin from content marker [SECRET_POST:1234] if present
  const pinMatch = rawContent.match(/\[SECRET_POST:([^\]]*)\]/);
  if (pinMatch) {
    extractedPin = pinMatch[1] ? pinMatch[1].trim() : undefined;
  }

  // Clean title & content from markers
  rawTitle = rawTitle.replace(/\[SECRET_POST(?::[^\]]*)?\]\s*/g, '');
  rawContent = rawContent.replace(/\[SECRET_POST(?::[^\]]*)?\]\s*/g, '');

  let isSecret = Boolean(row.is_secret) || Boolean(extractedPin) || Boolean(row.secret_pin && String(row.secret_pin).trim().length > 0);
  if (tagsArr.includes('#비밀글') || tagsArr.includes('비밀글')) {
    isSecret = true;
  }
  if (String(row.content || '').includes('[SECRET_POST]') || String(row.title || '').includes('[SECRET_POST]')) {
    isSecret = true;
  }

  const finalPin = (row.secret_pin && String(row.secret_pin).trim().length > 0)
    ? String(row.secret_pin).trim()
    : extractedPin;

  const defaultTags = isSecret ? ['#마산삼진고', '#건의사항', '#비밀글'] : ['#마산삼진고', '#건의사항'];
  let finalTags = tagsArr.length > 0 ? [...tagsArr] : defaultTags;
  if (isSecret && !finalTags.includes('#비밀글')) {
    finalTags.push('#비밀글');
  }

  return {
    id: String(row.id),
    category: normalizeCategory(row.category || row.category_name || row.cat || row.type),
    title: rawTitle,
    content: rawContent,
    authorNickname: row.author_name || row.author_nickname || row.author || '익명의 삼진인',
    isSecret,
    secretPin: finalPin || undefined,
    upvotes: Number(row.likes ?? row.upvotes ?? 0),
    status: mapStatusFromDB(row.status),
    tags: finalTags,
    imageUrl: row.image_url || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.created_at || new Date().toISOString(),
    comments: Array.isArray(row.comments) ? row.comments : [],
    officialResponse: row.admin_reply
      ? {
          authorName: '학생회장',
          department: '제53대 삼진고 학생회',
          content: row.admin_reply,
          updatedAt: row.created_at || new Date().toISOString(),
          status: mapStatusFromDB(row.status),
        }
      : undefined,
  };
};

/**
 * 1. 건의사항 목록 조회: created_at 기준 내림차순 정렬
 */
export const fetchSuggestionsFromSupabase = async (): Promise<Suggestion[]> => {
  try {
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch returned error:', error.message);
      return [];
    }

    return (data || []).map(mapRowToSuggestion);
  } catch (err: any) {
    console.warn('Supabase fetch network exception:', err?.message || err);
    return [];
  }
};

/**
 * Universal PIN verification function (Works offline/static & with backend)
 */
export const verifySuggestionPin = (
  suggestion: Suggestion,
  enteredPin: string,
  adminPin: string = 'fldkzh'
): boolean => {
  const cleanPin = String(enteredPin || '').trim();
  if (!cleanPin) return false;

  // Master admin password bypass
  if (cleanPin === 'fldkzh' || (adminPin && cleanPin === adminPin.trim())) {
    return true;
  }

  // Match against post's own 4-digit PIN
  const targetPin = suggestion.secretPin ? String(suggestion.secretPin).trim() : '';
  if (targetPin && targetPin === cleanPin) {
    return true;
  }

  return false;
};

/**
 * 2. 건의사항 등록: 다양한 DB 스키마 변형에 대응하는 다중 시도 로직
 */
export const insertSuggestionToSupabase = async (payload: {
  title: string;
  content: string;
  category: Category;
  isSecret: boolean;
  authorNickname: string;
  tags?: string[];
  secretPin?: string;
}): Promise<Suggestion> => {
  const authorName = payload.authorNickname.trim() || '익명의 삼진인';
  let tagsList = Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : ['#마산삼진고', '#건의사항'];
  
  if (payload.isSecret && !tagsList.includes('#비밀글')) {
    tagsList = [...tagsList, '#비밀글'];
  }

  const pin = payload.secretPin?.trim() || null;
  const rawClean = payload.content.trim();
  const cleanContent = payload.isSecret
    ? `[SECRET_POST:${pin || ''}] ${rawClean}`
    : rawClean;

  // Try multiple variant payloads to match whichever column names exist in the remote Supabase table
  const insertVariants = [
    {
      title: payload.title.trim(),
      content: cleanContent,
      category: payload.category,
      is_secret: payload.isSecret,
      is_anonymous: payload.isSecret,
      author_name: authorName,
      author_nickname: authorName,
      likes: 0,
      status: '접수중',
      secret_pin: pin,
      tags: tagsList,
    },
    {
      title: payload.title.trim(),
      content: cleanContent,
      category: payload.category,
      is_secret: payload.isSecret,
      author_nickname: authorName,
      likes: 0,
      status: '접수중',
      secret_pin: pin,
      tags: tagsList,
    },
    {
      title: payload.title.trim(),
      content: cleanContent,
      category: payload.category,
      is_secret: payload.isSecret,
      author_name: authorName,
      likes: 0,
      status: '접수중',
      secret_pin: pin,
      tags: tagsList,
    },
    {
      title: payload.title.trim(),
      content: cleanContent,
      category: payload.category,
      status: '접수중',
      tags: tagsList,
    },
    {
      title: payload.title.trim(),
      content: cleanContent,
    },
  ];

  let lastError: any = null;
  for (const variant of insertVariants) {
    try {
      const { data, error } = await supabase
        .from('suggestions')
        .insert([variant])
        .select()
        .single();

      if (!error && data) {
        const mapped = mapRowToSuggestion(data);
        return {
          ...mapped,
          isSecret: payload.isSecret || mapped.isSecret,
          secretPin: pin || mapped.secretPin,
        };
      }
      lastError = error;
    } catch (e) {
      lastError = e;
    }
  }

  console.error('All Supabase insert variants failed:', lastError);
  throw lastError || new Error('Supabase insert failed');
};

/**
 * 3. 댓글 추가 기능: Supabase DB comments JSON 컬럼 업데이트
 */
export const addCommentToSupabase = async (
  suggestionId: string,
  newComment: {
    id: string;
    authorNickname: string;
    content: string;
    createdAt: string;
    isOfficial?: boolean;
    officialRole?: string;
  }
): Promise<Suggestion> => {
  try {
    const { data: current } = await supabase
      .from('suggestions')
      .select('comments')
      .eq('id', suggestionId)
      .single();

    const existing = Array.isArray(current?.comments) ? current.comments : [];
    const updatedComments = [...existing, newComment];

    const { data, error } = await supabase
      .from('suggestions')
      .update({ comments: updatedComments })
      .eq('id', suggestionId)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Comment update failed');
    }

    return mapRowToSuggestion(data);
  } catch (err) {
    console.warn('addCommentToSupabase error:', err);
    throw err;
  }
};

/**
 * 3-1. 댓글 삭제 기능: Supabase DB comments JSON 컬럼에서 댓글 제거
 */
export const deleteCommentFromSupabase = async (
  suggestionId: string,
  commentId: string
): Promise<Suggestion> => {
  try {
    const { data: current } = await supabase
      .from('suggestions')
      .select('comments')
      .eq('id', suggestionId)
      .single();

    const existing = Array.isArray(current?.comments) ? current.comments : [];
    const updatedComments = existing.filter((c: any) => c.id !== commentId);

    const { data, error } = await supabase
      .from('suggestions')
      .update({ comments: updatedComments })
      .eq('id', suggestionId)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Comment delete failed');
    }

    return mapRowToSuggestion(data);
  } catch (err) {
    console.warn('deleteCommentFromSupabase error:', err);
    throw err;
  }
};

/**
 * 3. 공감(좋아요) 버튼: 클릭 시 해당 건의사항의 likes 숫자를 +1 올려서 DB UPDATE
 */
export const incrementLikesInSupabase = async (
  id: string,
  currentLikes: number,
  delta: number = 1
): Promise<Suggestion> => {
  const newLikes = Math.max(0, currentLikes + delta);

  const { data, error } = await supabase
    .from('suggestions')
    .update({ likes: newLikes })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Supabase update likes error:', error);
    throw new Error(error.message);
  }

  return mapRowToSuggestion(data);
};

/**
 * Update Status / Admin Reply in Supabase
 */
export const updateStatusInSupabase = async (
  id: string,
  status: Status,
  adminReply?: string
): Promise<Suggestion> => {
  const updatePayload: any = {
    status: mapStatusToDB(status),
  };
  if (adminReply !== undefined) {
    updatePayload.admin_reply = adminReply;
  }

  const { data, error } = await supabase
    .from('suggestions')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Supabase update status error:', error);
    throw new Error(error.message);
  }

  return mapRowToSuggestion(data);
};

/**
 * Delete suggestion from Supabase
 */
export const deleteSuggestionFromSupabase = async (id: string): Promise<void> => {
  const { error } = await supabase.from('suggestions').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete error:', error);
    throw new Error(error.message);
  }
};
