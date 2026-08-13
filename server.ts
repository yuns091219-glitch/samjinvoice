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
        // Merge comments with memory store if memory store has comments
        const memItem = suggestionsStore.find((s) => s.id === item.id);
        let comments = Array.isArray(item.comments) ? item.comments : [];
        if (memItem && Array.isArray(memItem.comments) && memItem.comments.length > 0) {
          const map = new Map<string, any>();
          comments.forEach((c) => c && c.id && map.set(c.id, c));
          memItem.comments.forEach((c) => c && c.id && map.set(c.id, c));
          comments = Array.from(map.values()).sort(
            (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }

        if (item.isSecret && !isAdminUser) {
          return {
            ...item,
            comments,
            content: '🔒 비밀글입니다. 작성 시 설정한 4자리 비밀번호(PIN)를 입력하면 확인하실 수 있습니다.',
            secretPin: undefined,
          };
        }
        const { secretPin, ...rest } = item;
        return {
          ...rest,
          comments,
        };
      });

      res.json(safeList);
    } catch (err: any) {
      console.error('Error fetching suggestions from Supabase:', err);
      // Fallback to in-memory store if DB error occurs
      res.json(suggestionsStore);
    }
  });

  // Get single suggestion
  app.get('/api/suggestions/:id', async (req, res) => {
    const { id } = req.params;
    const { pin, isAdmin, adminPin } = req.query;

    try {
      const list = await fetchSuggestionsFromSupabase();
      const found = list.find((s) => s.id === id) || suggestionsStore.find((s) => s.id === id);

      if (!found) {
        res.status(404).json({ error: '건의사항을 찾을 수 없습니다.' });
        return;
      }

      const isAdminUser = isAdmin === 'true' || adminPin === 'fldkzh';

      if (found.isSecret && !isAdminUser && found.secretPin !== pin) {
        res.json({
          ...found,
          content: '🔒 비밀글입니다. 비밀번호를 확인해주세요.',
          secretPin: undefined,
          isLocked: true,
        });
        return;
      }

      const { secretPin, ...safeFound } = found;
      res.json({ ...safeFound, isLocked: false });
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

      // Keep in-memory store updated
      suggestionsStore.unshift(newSuggestion);

      const { secretPin: _pin, ...safeCreated } = newSuggestion;
      res.status(201).json(safeCreated);
    } catch (err: any) {
      console.error('Error creating suggestion:', err);
      res.status(500).json({ error: '건의사항 등록 중 오류가 발생했습니다.' });
    }
  });

  // Upvote / Toggle suggestion (Supabase UPDATE likes)
  app.post('/api/suggestions/:id/upvote', async (req, res) => {
    const { id } = req.params;
    const { action } = req.body || {};

    try {
      // Get current likes from DB
      const { data } = await supabase.from('suggestions').select('likes').eq('id', id).single();
      const currentLikes = data?.likes ?? 0;
      const delta = (action === 'downvote' || action === 'cancel') ? -1 : 1;

      const updated = await incrementLikesInSupabase(id, currentLikes, delta);

      // Update in-memory backup
      const idx = suggestionsStore.findIndex((s) => s.id === id);
      if (idx !== -1) {
        suggestionsStore[idx] = updated;
      }

      const { secretPin, ...safeUpdated } = updated;
      res.json(safeUpdated);
    } catch (err: any) {
      console.error('Error updating upvote in Supabase:', err);
      res.status(500).json({ error: '공감 업데이트 중 오류가 발생했습니다.' });
    }
  });

  // Add comment
  app.post('/api/suggestions/:id/comments', async (req, res) => {
    const { id } = req.params;
    const { authorNickname, content, isOfficial, officialRole } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
      return;
    }

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      authorNickname: authorNickname ? authorNickname.trim() : '익명의 삼진인',
      isOfficial: Boolean(isOfficial),
      officialRole: officialRole || undefined,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    // Always update in-memory store
    let memIdx = suggestionsStore.findIndex((s) => s.id === id);
    if (memIdx === -1) {
      // Create memory record if missing
      const dummy: Suggestion = {
        id,
        category: 'OTHER',
        title: '',
        content: '',
        authorNickname: '익명',
        isSecret: false,
        status: 'RECEIVED',
        upvotes: 0,
        tags: [],
        comments: [newComment],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      suggestionsStore.push(dummy);
      memIdx = suggestionsStore.length - 1;
    } else {
      if (!Array.isArray(suggestionsStore[memIdx].comments)) {
        suggestionsStore[memIdx].comments = [];
      }
      if (!suggestionsStore[memIdx].comments.some((c) => c.id === newComment.id)) {
        suggestionsStore[memIdx].comments.push(newComment);
      }
      suggestionsStore[memIdx].updatedAt = new Date().toISOString();
    }

    try {
      const updated = await addCommentToSupabase(id, newComment);
      // Ensure memory store comments are merged into updated
      const map = new Map<string, Comment>();
      (suggestionsStore[memIdx].comments || []).forEach((c) => map.set(c.id, c));
      (updated.comments || []).forEach((c) => map.set(c.id, c));
      updated.comments = Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      suggestionsStore[memIdx] = updated;

      const { secretPin, ...safeUpdated } = updated;
      res.json(safeUpdated);
    } catch (err) {
      const { secretPin, ...safeUpdated } = suggestionsStore[memIdx];
      res.json(safeUpdated);
    }
  });

  // Delete comment
  app.delete('/api/suggestions/:suggestionId/comments/:commentId', async (req, res) => {
    const { suggestionId, commentId } = req.params;
    try {
      const updated = await deleteCommentFromSupabase(suggestionId, commentId);
      const idx = suggestionsStore.findIndex((s) => s.id === suggestionId);
      if (idx !== -1) {
        suggestionsStore[idx] = updated;
      }
      const { secretPin, ...safeUpdated } = updated;
      res.json(safeUpdated);
    } catch (err) {
      const idx = suggestionsStore.findIndex((s) => s.id === suggestionId);
      if (idx !== -1) {
        if (Array.isArray(suggestionsStore[idx].comments)) {
          suggestionsStore[idx].comments = suggestionsStore[idx].comments.filter((c) => c.id !== commentId);
        }
        const { secretPin, ...safeUpdated } = suggestionsStore[idx];
        res.json(safeUpdated);
      } else {
        res.status(404).json({ error: '건의글을 찾을 수 없습니다.' });
      }
    }
  });

  // Verify PIN for secret post or deletion
  app.post('/api/suggestions/:id/verify-pin', (req, res) => {
    const { id } = req.params;
    const { pin } = req.body;

    const found = suggestionsStore.find((s) => s.id === id);
    if (!found) {
      res.status(404).json({ error: '건의글을 찾을 수 없습니다.' });
      return;
    }

    if (!found.secretPin) {
      res.json({ verified: true, isSecret: false });
      return;
    }

    if (found.secretPin === String(pin)) {
      const { secretPin, ...safeFound } = found;
      res.json({ verified: true, suggestion: safeFound });
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
    const { pin, adminPin } = req.body;

    const isAdmin = adminPin === 'fldkzh';

    try {
      await deleteSuggestionFromSupabase(id);
    } catch (err: any) {
      console.warn('Error deleting suggestion from Supabase:', err);
    }

    const index = suggestionsStore.findIndex((s) => s.id === id);
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
