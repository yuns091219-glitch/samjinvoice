import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { INITIAL_NOTICES, INITIAL_SUGGESTIONS, TODAY_LUNCH } from './src/data/initialData';
import { Suggestion, Status, Category, Comment, OfficialResponse } from './src/types';
import {
  supabase,
  fetchSuggestionsFromSupabase,
  insertSuggestionToSupabase,
  incrementLikesInSupabase,
  updateStatusInSupabase,
  deleteSuggestionFromSupabase,
  addCommentToSupabase,
  deleteCommentFromSupabase,
} from './src/lib/supabase';

// In-memory data store for the session
let suggestionsStore: Suggestion[] = [...INITIAL_SUGGESTIONS];
let noticesStore = [...INITIAL_NOTICES];
let lunchStore = { ...TODAY_LUNCH };

// Global persistent maps for PINs, unmasked contents, author nicknames, categories, and tags across sessions
const secretPinStore = new Map<string, string>();
const originalContentStore = new Map<string, string>();
const authorNicknameStore = new Map<string, string>();
const categoryStore = new Map<string, Category>();
const tagsStore = new Map<string, string[]>();

// Global persistent comments map
const COMMENTS_FILE = path.join(process.cwd(), 'data_comments.json');
function loadPersistedComments(): Record<string, Comment[]> {
  try {
    if (fs.existsSync(COMMENTS_FILE)) {
      const data = fs.readFileSync(COMMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn('Error reading comments file:', e);
  }
  return {};
}

function savePersistedComments(data: Record<string, Comment[]>) {
  try {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing comments file:', e);
  }
}

const persistentCommentsStore: Record<string, Comment[]> = loadPersistedComments();

function deduplicateCommentList(comments: (Comment | null | undefined)[]): Comment[] {
  if (!Array.isArray(comments)) return [];
  const result: Comment[] = [];
  const seenIds = new Set<string>();

  for (const c of comments) {
    if (!c || !c.content) continue;
    const cleanContent = c.content.trim();
    const cleanNick = (c.authorNickname || '익명').trim();

    if (c.id && seenIds.has(c.id)) continue;

    const existingIndex = result.findIndex((existing) => {
      if (existing.id && c.id && existing.id === c.id) return true;
      const sameContent = existing.content.trim() === cleanContent;
      const sameAuthor = (existing.authorNickname || '').trim() === cleanNick;
      const sameOfficial = Boolean(existing.isOfficial) === Boolean(c.isOfficial);

      if (sameContent && sameAuthor && sameOfficial) {
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
}

function getCombinedComments(suggestionId: string, directComments: Comment[] = []): Comment[] {
  const stringId = String(suggestionId);
  const fileComments = persistentCommentsStore[stringId] || [];
  return deduplicateCommentList([...fileComments, ...directComments]);
}

function saveCombinedComment(suggestionId: string, newComment: Comment): Comment[] {
  const stringId = String(suggestionId);
  const existing = persistentCommentsStore[stringId] || [];
  const updated = deduplicateCommentList([...existing, newComment]);
  persistentCommentsStore[stringId] = updated;
  savePersistedComments(persistentCommentsStore);
  return updated;
}

function removeCombinedComment(suggestionId: string, commentId: string): Comment[] {
  const stringId = String(suggestionId);
  const existing = persistentCommentsStore[stringId] || [];
  const updated = existing.filter((c) => c.id !== commentId);
  persistentCommentsStore[stringId] = updated;
  savePersistedComments(persistentCommentsStore);
  return updated;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini AI Client lazily/safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', school: '마산삼진고등학교 익명 건의함' });
  });

  // Get all notices
  app.get('/api/notices', (req, res) => {
    res.json(noticesStore);
  });

  // Get today's lunch
  app.get('/api/lunch', (req, res) => {
    res.json(lunchStore);
  });

function formatSafeSuggestion(item: Suggestion, isAdminUser: boolean = false, keepUnmaskedIfVerified: boolean = false): Suggestion {
  const stringId = String(item.id);
  const effectivePin = item.secretPin || secretPinStore.get(stringId);
  const effectiveAuthor = authorNicknameStore.get(stringId) || item.authorNickname || '익명의 삼진인';
  const effectiveCategory = categoryStore.get(stringId) || (item.category && item.category !== 'OTHER' ? item.category : undefined) || 'OTHER';
  
  const rawTags = [
    ...(tagsStore.get(stringId) || []),
    ...(Array.isArray(item.tags) ? item.tags : []),
  ];
  let itemTags = Array.from(
    new Set(
      rawTags
        .map((t: string) => (t.startsWith('#') ? t : `#${t}`))
        .filter((t: string) => t.length > 1)
    )
  );
  if (itemTags.length === 0) {
    itemTags = ['#마산삼진고', '#건의사항'];
  }

  const isItemSecret = Boolean(
    item.isSecret ||
      (Array.isArray(itemTags) && (itemTags.includes('#비밀글') || itemTags.includes('비밀글'))) ||
      effectivePin ||
      secretPinStore.has(stringId)
  );

  if (isItemSecret && !itemTags.includes('#비밀글')) {
    itemTags.push('#비밀글');
  }

  const { secretPin, ...safeItem } = item;

  if (isItemSecret && !isAdminUser && !keepUnmaskedIfVerified) {
    return {
      ...safeItem,
      id: stringId,
      category: effectiveCategory,
      authorNickname: effectiveAuthor,
      isSecret: true,
      tags: itemTags,
      content: '🔒 비밀글입니다. 작성 시 설정한 4자리 비밀번호(PIN)를 입력하면 확인하실 수 있습니다.',
    };
  }

  return {
    ...safeItem,
    id: stringId,
    category: effectiveCategory,
    authorNickname: effectiveAuthor,
    isSecret: isItemSecret,
    tags: itemTags,
  };
}

  // Get suggestions with optional category, status, search filtering (Supabase)
  app.get('/api/suggestions', async (req, res) => {
    const { category, status, search, sort, isAdmin, adminPin } = req.query;

    try {
      let filtered = await fetchSuggestionsFromSupabase();

      // If Supabase table is empty, seed/fallback with initial items if desired
      if (filtered.length === 0 && suggestionsStore.length > 0) {
        filtered = [...suggestionsStore];
      }

      if (category && category !== 'ALL') {
        const catStr = String(category).trim().toUpperCase();
        filtered = filtered.filter((s) => {
          const sc = String(s.category).trim().toUpperCase();
          if (catStr === sc) return true;
          if (catStr === 'MEALS' && (sc.includes('급식') || sc.includes('식당') || sc === 'MEAL')) return true;
          if (catStr === 'FACILITY' && (sc.includes('시설') || sc.includes('환경') || sc === 'FACILITIES')) return true;
          if (catStr === 'ACADEMICS' && (sc.includes('학습') || sc.includes('진로') || sc === 'ACADEMIC')) return true;
          if (catStr === 'STUDENT_COUNCIL' && (sc.includes('학생회') || sc.includes('행사'))) return true;
          if (catStr === 'LIFE_RULES' && (sc.includes('교칙') || sc.includes('생활'))) return true;
          if (catStr === 'OTHER' && (sc.includes('기타') || sc.includes('자유'))) return true;
          return false;
        });
      }

      if (status && status !== 'ALL') {
        filtered = filtered.filter((s) => s.status === status);
      }

      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.content.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q)) ||
            s.authorNickname.toLowerCase().includes(q)
        );
      }

      // Sort options: 'latest', 'upvotes', 'comments'
      if (sort === 'upvotes') {
        filtered.sort((a, b) => b.upvotes - a.upvotes);
      } else if (sort === 'comments') {
        filtered.sort((a, b) => b.comments.length - a.comments.length);
      } else {
        // default 'latest'
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';

      const safeList = filtered.map((item) => {
        const memItem = suggestionsStore.find((s) => String(s.id) === String(item.id));
        const comments = getCombinedComments(
          String(item.id),
          [...(Array.isArray(item.comments) ? item.comments : []), ...(memItem && Array.isArray(memItem.comments) ? memItem.comments : [])]
        );

        const stringId = String(item.id);
        const effectivePin = item.secretPin || memItem?.secretPin || secretPinStore.get(stringId);
        if (effectivePin) {
          secretPinStore.set(stringId, String(effectivePin).trim());
        }

        if (item.authorNickname && item.authorNickname !== '익명의 삼진인') {
          authorNicknameStore.set(stringId, item.authorNickname);
        } else if (memItem?.authorNickname && memItem.authorNickname !== '익명의 삼진인') {
          authorNicknameStore.set(stringId, memItem.authorNickname);
        }

        if (item.category && item.category !== 'OTHER') {
          categoryStore.set(stringId, item.category);
        } else if (memItem?.category && memItem.category !== 'OTHER') {
          categoryStore.set(stringId, memItem.category);
        }

        const candidateTags = [
          ...(tagsStore.get(stringId) || []),
          ...(Array.isArray(item.tags) ? item.tags : []),
          ...(Array.isArray(memItem?.tags) ? memItem.tags : []),
        ];
        const uniqueTags = Array.from(
          new Set(
            candidateTags
              .map((t) => (t.startsWith('#') ? t : `#${t}`))
              .filter((t) => t.length > 1)
          )
        );
        if (uniqueTags.length > 0) {
          tagsStore.set(stringId, uniqueTags);
        }

        if (item.content && !item.content.startsWith('🔒 비밀글입니다')) {
          originalContentStore.set(stringId, item.content);
        } else if (memItem?.content && !memItem.content.startsWith('🔒 비밀글입니다')) {
          originalContentStore.set(stringId, memItem.content);
        }

        const formatted = formatSafeSuggestion(
          {
            ...item,
            comments,
            secretPin: effectivePin,
          },
          isAdminUser
        );

        return formatted;
      });

      res.json(safeList);
    } catch (err: any) {
      console.error('Error fetching suggestions from Supabase:', err);
      // Fallback to in-memory store if DB error occurs with proper secret masking
      const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';
      const safeMemory = suggestionsStore.map((item) => {
        const comments = getCombinedComments(String(item.id), item.comments || []);
        return formatSafeSuggestion({ ...item, comments }, isAdminUser);
      });
      res.json(safeMemory);
    }
  });

  // Get single suggestion
  app.get('/api/suggestions/:id', async (req, res) => {
    const { id } = req.params;
    const stringId = String(id);
    const { pin, isAdmin, adminPin } = req.query;

    try {
      const list = await fetchSuggestionsFromSupabase();
      let found = suggestionsStore.find((s) => String(s.id) === stringId) || list.find((s) => String(s.id) === stringId);

      if (!found) {
        res.status(404).json({ error: '건의사항을 찾을 수 없습니다.' });
        return;
      }

      const storedPin = secretPinStore.get(stringId) || found.secretPin;
      const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';
      const cleanPin = pin ? String(pin).trim() : '';
      const isPinCorrect = storedPin ? (storedPin === cleanPin) : Boolean(cleanPin);

      const realContent = originalContentStore.get(stringId) || found.content;
      const comments = getCombinedComments(stringId, found.comments || []);

      if (found.isSecret && !isAdminUser && !isPinCorrect) {
        res.json({
          ...found,
          content: '🔒 비밀글입니다. 작성 시 설정한 4자리 비밀번호(PIN)를 입력하면 확인하실 수 있습니다.',
          comments,
          secretPin: undefined,
          isLocked: true,
        });
        return;
      }

      const { secretPin, ...safeFound } = found;
      res.json({
        ...safeFound,
        comments,
        content: (realContent && !realContent.startsWith('🔒 비밀글입니다')) ? realContent : found.content,
        isLocked: false,
      });
    } catch (err) {
      res.status(500).json({ error: '조회 실패' });
    }
  });

  // Create new suggestion (Supabase INSERT)
  app.post('/api/suggestions', async (req, res) => {
    const { category, title, content, authorNickname, isSecret, secretPin, tags, imageUrl } = req.body;

    if (!title || !content || !category) {
      res.status(400).json({ error: '제목, 내용, 카테고리는 필수 입력항목입니다.' });
      return;
    }

    try {
      let newSuggestion: Suggestion;
      try {
        newSuggestion = await insertSuggestionToSupabase({
          title,
          content,
          category: category as Category,
          isSecret: Boolean(isSecret),
          authorNickname: authorNickname ? authorNickname.trim() : '익명의 삼진인',
          tags: Array.isArray(tags) ? tags : ['#마산삼진고', '#건의사항'],
          secretPin: secretPin ? String(secretPin).trim() : undefined,
        });
      } catch (dbErr) {
        console.warn('Supabase insert failed, creating in-memory fallback:', dbErr);
        newSuggestion = {
          id: `sug-${Date.now()}`,
          category: (category as Category) || 'OTHER',
          title: title.trim(),
          content: content.trim(),
          authorNickname: authorNickname?.trim() || '익명의 삼진인',
          isSecret: Boolean(isSecret),
          secretPin: secretPin ? String(secretPin).trim() : undefined,
          status: 'RECEIVED',
          upvotes: 0,
          tags: Array.isArray(tags) && tags.length > 0 ? tags : ['#마산삼진고', '#건의사항'],
          comments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Ensure isSecret, category, authorNickname, tags, and secretPin are explicitly preserved on newSuggestion
      const cleanAuthor = authorNickname?.trim() || newSuggestion.authorNickname || '익명의 삼진인';
      const cleanCategory = (category as Category) || newSuggestion.category || 'OTHER';
      const cleanTags = Array.isArray(tags) && tags.length > 0 ? tags : (newSuggestion.tags && newSuggestion.tags.length > 0 ? newSuggestion.tags : ['#마산삼진고', '#건의사항']);
      newSuggestion.authorNickname = cleanAuthor;
      newSuggestion.category = cleanCategory;
      newSuggestion.tags = cleanTags;
      newSuggestion.isSecret = Boolean(isSecret) || newSuggestion.isSecret;
      const stringId = String(newSuggestion.id);
      newSuggestion.id = stringId;
      authorNicknameStore.set(stringId, cleanAuthor);
      categoryStore.set(stringId, cleanCategory);
      tagsStore.set(stringId, cleanTags);
      if (secretPin) {
        const cleanPin = String(secretPin).trim();
        newSuggestion.secretPin = cleanPin;
        secretPinStore.set(stringId, cleanPin);
      }
      if (newSuggestion.content && !newSuggestion.content.startsWith('🔒 비밀글입니다')) {
        originalContentStore.set(stringId, newSuggestion.content);
      }

      // Keep in-memory store updated
      suggestionsStore.unshift(newSuggestion);

      const safeCreated = formatSafeSuggestion(newSuggestion, false, true);
      res.status(201).json(safeCreated);
    } catch (err: any) {
      console.error('Error creating suggestion:', err);
      res.status(500).json({ error: '건의사항 등록 중 오류가 발생했습니다.' });
    }
  });

  // Upvote / Toggle suggestion (Supabase UPDATE likes) - NEVER lose comments
  app.post('/api/suggestions/:id/upvote', async (req, res) => {
    const { id } = req.params;
    const stringId = String(id);
    const { action } = req.body || {};
    const { isAdmin, adminPin } = req.query;
    const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';

    try {
      // Get current likes from DB
      const { data } = await supabase.from('suggestions').select('likes').eq('id', stringId).single();
      const currentLikes = data?.likes ?? 0;
      const delta = (action === 'downvote' || action === 'cancel') ? -1 : 1;

      const updated = await incrementLikesInSupabase(stringId, currentLikes, delta);

      // Preserve all persistent comments for this post
      const preservedComments = getCombinedComments(stringId, updated.comments || []);
      updated.comments = preservedComments;

      // Update in-memory backup
      const idx = suggestionsStore.findIndex((s) => String(s.id) === stringId);
      if (idx !== -1) {
        suggestionsStore[idx] = {
          ...suggestionsStore[idx],
          upvotes: updated.upvotes,
          comments: preservedComments,
        };
      }

      res.json(formatSafeSuggestion(updated, isAdminUser));
    } catch (err: any) {
      console.warn('Error updating upvote in Supabase, using local store:', err);
      const idx = suggestionsStore.findIndex((s) => String(s.id) === stringId);
      if (idx !== -1) {
        const delta = (action === 'downvote' || action === 'cancel') ? -1 : 1;
        suggestionsStore[idx].upvotes = Math.max(0, suggestionsStore[idx].upvotes + delta);
        const preservedComments = getCombinedComments(stringId, suggestionsStore[idx].comments || []);
        suggestionsStore[idx].comments = preservedComments;
        res.json(formatSafeSuggestion(suggestionsStore[idx], isAdminUser));
        return;
      }
      res.status(500).json({ error: '공감 업데이트 중 오류가 발생했습니다.' });
    }
  });

  // Add comment
  app.post('/api/suggestions/:id/comments', async (req, res) => {
    const { id } = req.params;
    const stringId = String(id);
    const { authorNickname, content, isOfficial, officialRole } = req.body;
    const { isAdmin, adminPin } = req.query;
    const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';

    if (!content || !content.trim()) {
      res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
      return;
    }

    const newComment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorNickname: authorNickname ? authorNickname.trim() : '익명의 삼진인',
      isOfficial: Boolean(isOfficial),
      officialRole: officialRole || undefined,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    // Save to persistent file storage immediately
    const updatedComments = saveCombinedComment(stringId, newComment);

    // Update in-memory store
    let memIdx = suggestionsStore.findIndex((s) => String(s.id) === stringId);
    if (memIdx === -1) {
      const dummy: Suggestion = {
        id: stringId,
        category: 'OTHER',
        title: '',
        content: '',
        authorNickname: '익명',
        isSecret: false,
        status: 'RECEIVED',
        upvotes: 0,
        tags: [],
        comments: updatedComments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      suggestionsStore.push(dummy);
      memIdx = suggestionsStore.length - 1;
    } else {
      suggestionsStore[memIdx].comments = updatedComments;
      suggestionsStore[memIdx].updatedAt = new Date().toISOString();
    }

    try {
      const updated = await addCommentToSupabase(stringId, newComment);
      updated.comments = updatedComments;
      suggestionsStore[memIdx] = updated;
      res.json(formatSafeSuggestion(updated, isAdminUser));
    } catch (err) {
      res.json(formatSafeSuggestion(suggestionsStore[memIdx], isAdminUser));
    }
  });

  // Delete comment
  app.delete('/api/suggestions/:suggestionId/comments/:commentId', async (req, res) => {
    const { suggestionId, commentId } = req.params;
    const stringId = String(suggestionId);
    const { isAdmin, adminPin } = req.query;
    const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';

    const updatedComments = removeCombinedComment(stringId, commentId);

    const idx = suggestionsStore.findIndex((s) => String(s.id) === stringId);
    if (idx !== -1) {
      suggestionsStore[idx].comments = updatedComments;
    }

    try {
      const updated = await deleteCommentFromSupabase(stringId, commentId);
      updated.comments = updatedComments;
      if (idx !== -1) {
        suggestionsStore[idx] = updated;
      }
      res.json(formatSafeSuggestion(updated, isAdminUser));
    } catch (err) {
      if (idx !== -1) {
        res.json(formatSafeSuggestion(suggestionsStore[idx], isAdminUser));
      } else {
        res.json({ success: true, comments: updatedComments });
      }
    }
  });

  // Verify PIN for secret post or deletion
  app.post('/api/suggestions/:id/verify-pin', async (req, res) => {
    const { id } = req.params;
    const stringId = String(id);
    const { pin } = req.body;
    const cleanPin = String(pin || '').trim();

    let found = suggestionsStore.find((s) => String(s.id) === stringId);
    if (!found) {
      try {
        const list = await fetchSuggestionsFromSupabase();
        found = list.find((s) => String(s.id) === stringId);
      } catch (e) {
        // ignore error
      }
    }

    if (!found) {
      res.status(404).json({ error: '건의글을 찾을 수 없습니다.' });
      return;
    }

    const storedPin = secretPinStore.get(stringId) || (found.secretPin ? String(found.secretPin).trim() : undefined);

    const isAdminBypass = cleanPin === 'fldkzh';
    const isMatched = isAdminBypass || (Boolean(storedPin) && storedPin === cleanPin);

    if (isMatched) {
      const realContent = originalContentStore.get(stringId) || found.content;
      const cleanContent = (realContent && !realContent.startsWith('🔒 비밀글입니다'))
        ? realContent
        : found.content;

      const { secretPin, ...safeFound } = found;
      const unmaskedSuggestion = {
        ...safeFound,
        id: stringId,
        content: cleanContent,
        isSecret: true,
      };

      res.json({
        verified: true,
        suggestion: unmaskedSuggestion,
      });
    } else {
      res.status(401).json({ verified: false, error: '비밀번호가 일치하지 않습니다.' });
    }
  });

  // Admin/Student Council Status & Official Response Update (Supabase)
  app.patch('/api/suggestions/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, officialResponse, adminPin } = req.body;

    // Admin PIN check ('fldkzh')
    if (adminPin !== 'fldkzh') {
      res.status(403).json({ error: '관리자 권한 비밀번호가 올바르지 않습니다.' });
      return;
    }

    try {
      const updated = await updateStatusInSupabase(
        id,
        status as Status,
        officialResponse?.content
      );

      const idx = suggestionsStore.findIndex((s) => s.id === id);
      if (idx !== -1) {
        suggestionsStore[idx] = updated;
      }

      const { secretPin, ...safeUpdated } = updated;
      res.json(safeUpdated);
    } catch (err: any) {
      console.error('Error updating status in Supabase:', err);
      res.status(500).json({ error: '상태 업데이트 중 오류가 발생했습니다.' });
    }
  });

  // Delete suggestion (Supabase DELETE)
  app.delete('/api/suggestions/:id', async (req, res) => {
    const { id } = req.params;
    const stringId = String(id);
    const { pin, adminPin } = req.body;

    const isAdmin = adminPin === 'fldkzh';

    let found = suggestionsStore.find((s) => String(s.id) === stringId);
    if (!found) {
      try {
        const list = await fetchSuggestionsFromSupabase();
        found = list.find((s) => String(s.id) === stringId);
      } catch (e) {
        // ignore
      }
    }

    const storedPin = secretPinStore.get(stringId) || (found?.secretPin ? String(found.secretPin).trim() : undefined);

    if (found && (storedPin || found.isSecret) && !isAdmin) {
      const cleanPin = String(pin || '').trim();
      if (!storedPin || storedPin !== cleanPin) {
        res.status(401).json({ error: '삭제용 비밀번호가 일치하지 않습니다.' });
        return;
      }
    }

    try {
      await deleteSuggestionFromSupabase(id);
    } catch (err: any) {
      console.warn('Error deleting suggestion from Supabase:', err);
    }

    const index = suggestionsStore.findIndex((s) => String(s.id) === stringId);
    if (index !== -1) {
      suggestionsStore.splice(index, 1);
    }

    res.json({ success: true, message: '건의사항이 삭제되었습니다.' });
  });

  // AI Assistance: Gemini model analysis and draft response for Student Council
  app.post('/api/gemini/analyze', async (req, res) => {
    const { title, content, category } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: '건의 제목과 내용이 필요합니다.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback response if GEMINI_API_KEY is missing
      res.json({
        summary: `${title} - 마산삼진고 학생 건의사항`,
        suggestedStatus: 'IN_REVIEW',
        draftResponse: `안녕하세요, 마산삼진고등학교 학생회입니다. 제시해주신 '${title}' 건의사항을 경청하였습니다. 해당 의견은 관련 담당 부서 및 선생님과 협의하여 신속히 검토하도록 하겠습니다. 삼진고를 위한 소중한 의견 감사합니다!`,
        actionItems: ['관련 부서/담당 교사 의견 수렴', '실행 가능성 및 예산 검토', '학생회 정기 회의 안건 상정'],
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `당신은 마산삼진고등학교 학생회 및 학교 행정실의 AI 소통 도우미입니다.
학생이 작성한 익명 건의사항을 분석하여 다음을 작성해주세요:

1. 건의 핵심 요약 (1~2문장)
2. 추천 처리 상태 (RECEIVED, IN_REVIEW, ANSWERED, APPLIED 중 하나)
3. 학생회/학교 당국 명의의 다정하고 예의 바르며 명확한 공식 답변 초안 (2~4문장)
4. 구체적인 후속 실천 항목 2~3가지

[건의 정보]
- 카테고리: ${category || '미지정'}
- 제목: ${title}
- 내용: ${content}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: '건의 내용 핵심 요약' },
              suggestedStatus: {
                type: Type.STRING,
                description: '추천 상태 (IN_REVIEW, ANSWERED, APPLIED 중 1개)',
              },
              draftResponse: {
                type: Type.STRING,
                description: '학생회/학교 명의의 친절한 공식 답변 초안',
              },
              actionItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '후속 조치 사항 목록',
              },
            },
            required: ['summary', 'suggestedStatus', 'draftResponse', 'actionItems'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      res.json({
        summary: title,
        suggestedStatus: 'IN_REVIEW',
        draftResponse: `안녕하세요, 제53대 마산삼진고등학교 학생회입니다. 소중한 의견에 감사드리며 담당 부서와 협의 후 빠른 시일 내에 경과를 안내해 드리겠습니다.`,
        actionItems: ['안건 접수 및 학생회 회의 상정', '관련 담당 교사 협의'],
      });
    }
  });

  // --- VITE MIDDLEWARE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Masan Samjin High School Suggestion Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
