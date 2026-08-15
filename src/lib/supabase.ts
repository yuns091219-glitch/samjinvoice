import { createClient } from '@supabase/supabase-js';
import { Suggestion, Category, Status, normalizeCategory, stripMetadataMarkers, extractMetadataFromContent, deduplicateComments } from '../types';

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
  const extracted = extractMetadataFromContent(row.title, row.content);

  let tagsArr: string[] = [];
  if (Array.isArray(row.tags)) {
    tagsArr = row.tags
      .map((t: any) => String(t).replace(/^[\{\[]|[\}\]]$/g, '').replace(/["']/g, '').trim())
      .filter(Boolean);
  } else if (typeof row.tags === 'string' && row.tags.trim().length > 0) {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) {
        tagsArr = parsed
          .map((t: any) => String(t).replace(/["']/g, '').trim())
          .filter(Boolean);
      } else {
        tagsArr = row.tags
          .replace(/^[\{\[]|[\}\]]$/g, '')
          .split(',')
          .map((t: string) => t.replace(/["']/g, '').trim())
          .filter(Boolean);
      }
    } catch {
      tagsArr = row.tags
        .replace(/^[\{\[]|[\}\]]$/g, '')
        .split(',')
        .map((t: string) => t.replace(/["']/g, '').trim())
        .filter(Boolean);
    }
  }

  // Combine tags extracted from content markers and row.tags
  const combinedRawTags = [
    ...(Array.isArray(extracted.tags) ? extracted.tags : []),
    ...tagsArr,
  ];

  let effectiveTags = Array.from(
    new Set(
      combinedRawTags
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .filter((t) => t.length > 1)
    )
  );

  if (effectiveTags.length === 0) {
    effectiveTags = ['#마산삼진고', '#건의사항'];
  }

  let isSecret = Boolean(
    row.is_secret ||
    extracted.isSecret ||
    Boolean(extracted.pin) ||
    Boolean(row.secret_pin && String(row.secret_pin).trim().length > 0)
  );

  if (effectiveTags.includes('#비밀글') || effectiveTags.includes('비밀글')) {
    isSecret = true;
  }

  const finalPin = (row.secret_pin && String(row.secret_pin).trim().length > 0)
    ? String(row.secret_pin).trim()
    : extracted.pin;

  // Format tags with leading #
  const formattedTags = effectiveTags.map((t) => (t.startsWith('#') ? t : `#${t}`));
  let finalTags = formattedTags.length > 0 ? formattedTags : ['#마산삼진고', '#건의사항'];
  if (isSecret && !finalTags.includes('#비밀글')) {
    finalTags.push('#비밀글');
  }

  let parsedComments: any[] = [];
  if (Array.isArray(row.comments)) {
    parsedComments = row.comments;
  } else if (typeof row.comments === 'string' && row.comments.trim().length > 0) {
    try {
      const p = JSON.parse(row.comments);
      if (Array.isArray(p)) parsedComments = p;
    } catch {
      parsedComments = [];
    }
  }

  const resolvedAuthor =
    extracted.authorNickname ||
    (row.author_name && row.author_name !== '익명의 삼진인' ? row.author_name : undefined) ||
    (row.author_nickname && row.author_nickname !== '익명의 삼진인' ? row.author_nickname : undefined) ||
    (row.author && row.author !== '익명의 삼진인' ? row.author : undefined) ||
    (row.nickname && row.nickname !== '익명의 삼진인' ? row.nickname : undefined) ||
    (row.writer && row.writer !== '익명의 삼진인' ? row.writer : undefined) ||
    (row.user_name && row.user_name !== '익명의 삼진인' ? row.user_name : undefined) ||
    (row.username && row.username !== '익명의 삼진인' ? row.username : undefined) ||
    row.name ||
    '익명의 삼진인';

  const resolvedCategory = normalizeCategory(
    extracted.category ||
    row.category ||
    row.category_name ||
    row.category_type ||
    row.category_id ||
    row.topic ||
    row.division ||
    row.kind ||
    row.cat ||
    row.type
  );

  return {
    id: String(row.id),
    category: resolvedCategory,
    title: extracted.cleanTitle || '제목 없음',
    content: extracted.cleanContent,
    authorNickname: resolvedAuthor,
    isSecret,
    secretPin: finalPin || undefined,
    upvotes: Number(row.likes ?? row.upvotes ?? 0),
    status: mapStatusFromDB(row.status),
    tags: finalTags,
    imageUrl: row.image_url || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.created_at || new Date().toISOString(),
    comments: deduplicateComments(parsedComments),
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
  const rawClean = stripMetadataMarkers(payload.content);
  const rawTitleClean = stripMetadataMarkers(payload.title);

  // Encode metadata in content string so nothing is lost even if DB columns are missing
  const categoryTag = `[CATEGORY:${payload.category}]`;
  const authorTag = `[AUTHOR:${authorName}]`;
  const tagsTag = `[TAGS:${tagsList.join(',')}]`;
  const secretTag = payload.isSecret ? `[SECRET_POST:${pin || ''}]` : '';

  const cleanContent = `${secretTag}${categoryTag}${authorTag}${tagsTag} ${rawClean}`.trim();

  // Try multiple variant payloads to match whichever column names exist in the remote Supabase table
  const insertVariants = [
    {
      title: rawTitleClean,
      content: cleanContent,
      category: payload.category,
      category_name: payload.category,
      is_secret: payload.isSecret,
      is_anonymous: payload.isSecret,
      author_name: authorName,
      author_nickname: authorName,
      nickname: authorName,
      writer: authorName,
      likes: 0,
      status: '접수중',
      secret_pin: pin,
      tags: tagsList,
    },
    {
      title: rawTitleClean,
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
      title: rawTitleClean,
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
      title: rawTitleClean,
      content: cleanContent,
      category: payload.category,
      author_name: authorName,
      author_nickname: authorName,
      status: '접수중',
      tags: tagsList,
    },
    {
      title: rawTitleClean,
      content: cleanContent,
      category: payload.category,
      status: '접수중',
      tags: tagsList,
    },
    {
      title: rawTitleClean,
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
          category: payload.category || mapped.category,
          authorNickname: authorName || mapped.authorNickname,
          isSecret: payload.isSecret || mapped.isSecret,
          tags: tagsList.length > 0 ? tagsList : mapped.tags,
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
 * 3. 댓글 추가 기능: Supabase DB comments 컬럼 (JSON/String/Table) 업데이트
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
      .select('*')
      .eq('id', suggestionId)
      .single();

    let existing: any[] = [];
    if (current) {
      if (Array.isArray(current.comments)) {
        existing = current.comments;
      } else if (typeof current.comments === 'string' && current.comments.trim().length > 0) {
        try {
          const p = JSON.parse(current.comments);
          if (Array.isArray(p)) existing = p;
        } catch {
          existing = [];
        }
      }
    }

    // Deduplicate comment if already exists
    const updatedComments = deduplicateComments([...existing, newComment]);

    // Variant 1: JSON array update
    let res = await supabase
      .from('suggestions')
      .update({ comments: updatedComments })
      .eq('id', suggestionId)
      .select()
      .single();

    if (!res.error && res.data) {
      const mapped = mapRowToSuggestion(res.data);
      mapped.comments = updatedComments;
      return mapped;
    }

    // Variant 2: JSON stringified update
    res = await supabase
      .from('suggestions')
      .update({ comments: JSON.stringify(updatedComments) })
      .eq('id', suggestionId)
      .select()
      .single();

    if (!res.error && res.data) {
      const mapped = mapRowToSuggestion(res.data);
      mapped.comments = updatedComments;
      return mapped;
    }

    // Variant 3: If separate comments table exists
    try {
      await supabase.from('comments').insert([
        {
          id: newComment.id,
          suggestion_id: suggestionId,
          author_nickname: newComment.authorNickname,
          content: newComment.content,
          is_official: Boolean(newComment.isOfficial),
          official_role: newComment.officialRole,
          created_at: newComment.createdAt,
        },
      ]);
    } catch {}

    if (current) {
      const mapped = mapRowToSuggestion(current);
      mapped.comments = updatedComments;
      return mapped;
    }

    throw new Error('Comment update failed on all variants');
  } catch (err) {
    console.warn('addCommentToSupabase warning:', err);
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
      .select('*')
      .eq('id', suggestionId)
      .single();

    let existing: any[] = [];
    if (current) {
      if (Array.isArray(current.comments)) {
        existing = current.comments;
      } else if (typeof current.comments === 'string' && current.comments.trim().length > 0) {
        try {
          const p = JSON.parse(current.comments);
          if (Array.isArray(p)) existing = p;
        } catch {
          existing = [];
        }
      }
    }

    const updatedComments = existing.filter((c: any) => c.id !== commentId);

    // Variant 1: JSON array update
    let res = await supabase
      .from('suggestions')
      .update({ comments: updatedComments })
      .eq('id', suggestionId)
      .select()
      .single();

    if (!res.error && res.data) {
      const mapped = mapRowToSuggestion(res.data);
      mapped.comments = updatedComments;
      return mapped;
    }

    // Variant 2: JSON stringified update
    res = await supabase
      .from('suggestions')
      .update({ comments: JSON.stringify(updatedComments) })
      .eq('id', suggestionId)
      .select()
      .single();

    if (!res.error && res.data) {
      const mapped = mapRowToSuggestion(res.data);
      mapped.comments = updatedComments;
      return mapped;
    }

    try {
      await supabase.from('comments').delete().eq('id', commentId);
    } catch {}

    if (current) {
      const mapped = mapRowToSuggestion(current);
      mapped.comments = updatedComments;
      return mapped;
    }

    throw new Error('Comment delete failed');
  } catch (err) {
    console.warn('deleteCommentFromSupabase warning:', err);
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
