import { createClient } from '@supabase/supabase-js';
import { Suggestion, Category, Status } from '../types';

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
  const isSecret = row.is_anonymous ?? row.is_secret ?? false;
  return {
    id: String(row.id),
    category: (row.category as Category) || 'OTHER',
    title: row.title || '제목 없음',
    content: row.content || '',
    authorNickname: row.author_name || row.author_nickname || row.author || '익명의 삼진인',
    isSecret,
    secretPin: row.secret_pin ? String(row.secret_pin) : undefined,
    upvotes: Number(row.likes ?? row.upvotes ?? 0),
    status: mapStatusFromDB(row.status),
    tags: Array.isArray(row.tags) ? row.tags : ['#마산삼진고', '#건의사항'],
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
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch error:', error);
    throw new Error(error.message);
  }

  return (data || []).map(mapRowToSuggestion);
};

/**
 * 2. 건의사항 등록: 제목, 내용, 카테고리, 익명 여부, 작성자 이름을 DB suggestions 테이블에 INSERT
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
  const insertData = {
    title: payload.title.trim(),
    content: payload.content.trim(),
    category: payload.category,
    is_anonymous: payload.isSecret,
    author_name: payload.authorNickname.trim() || '익명의 삼진인',
    likes: 0,
    status: '접수중',
  };

  const { data, error } = await supabase
    .from('suggestions')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    throw new Error(error.message);
  }

  return mapRowToSuggestion(data);
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
