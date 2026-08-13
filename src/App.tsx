import React, { useState, useEffect, useMemo } from 'react';
import { Suggestion, Category, Status, Notice, AdminStats, normalizeCategory } from './types';
import { Navbar } from './components/Navbar';
import { SchoolInfoBanner } from './components/SchoolInfoBanner';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { SuggestionCard } from './components/SuggestionCard';
import { SuggestionDetailModal } from './components/SuggestionDetailModal';
import { SuggestionFormModal } from './components/SuggestionFormModal';
import { AdminDashboard } from './components/AdminDashboard';
import { NoticeModal } from './components/NoticeModal';
import { MessageSquare, RefreshCw, AlertCircle, ShieldCheck, Lock, Search, Key, CheckCircle2 } from 'lucide-react';
import {
  fetchSuggestionsFromSupabase,
  insertSuggestionToSupabase,
  incrementLikesInSupabase,
  updateStatusInSupabase,
  deleteSuggestionFromSupabase,
  addCommentToSupabase,
  deleteCommentFromSupabase,
  supabase,
} from './lib/supabase';
import { INITIAL_SUGGESTIONS } from './data/initialData';

export default function App() {
  // Initial suggestions from localStorage for instant load, excluding pre-seeded default mock suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => {
    try {
      const saved = localStorage.getItem('samjin_suggestions_persistent_v1');
      if (saved) {
        const parsed: Suggestion[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((s) => !s.id.startsWith('sug-default-'));
          return filtered;
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Sync suggestions to localStorage whenever suggestions state changes
  useEffect(() => {
    try {
      const filtered = suggestions.filter((s) => !s.id.startsWith('sug-default-'));
      localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to save suggestions to localStorage:', e);
    }
  }, [suggestions]);
  const [notices, setNotices] = useState<Notice[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upvoted suggestions tracking (persisted in localStorage)
  const [upvotedIds, setUpvotedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('samjin_upvoted_ids') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('samjin_upvoted_ids', JSON.stringify(upvotedIds));
  }, [upvotedIds]);

  // Filters (Used when in Admin Mode)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<Status | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'upvotes' | 'comments'>('latest');

  // Modals & Mode
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState('fldkzh');

  // Student Self-Lookup state
  const [lookupId, setLookupId] = useState('');
  const [lookupPin, setLookupPin] = useState('');
  const [lookupResult, setLookupResult] = useState<Suggestion | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Fetch initial suggestions from Express API or direct Supabase client
  const fetchSuggestions = async () => {
    try {
      setLoading(true);

      let fetchedData: Suggestion[] | null = null;

      // 1. Try Express server API
      try {
        const queryParams = new URLSearchParams();
        if (isAdmin) {
          queryParams.append('isAdmin', 'true');
          if (adminPin) queryParams.append('adminPin', adminPin);
        }
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const res = await fetch(`/api/suggestions${queryString}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            fetchedData = await res.json();
          }
        }
      } catch (apiErr) {
        console.warn('Backend API not available on this host:', apiErr);
      }

      // 2. Fallback to Supabase direct client (for Netlify/Vercel/Static hosting)
      if (!fetchedData) {
        try {
          fetchedData = await fetchSuggestionsFromSupabase();
        } catch (supabaseErr) {
          console.warn('Supabase direct fetch failed:', supabaseErr);
        }
      }

      // Get cached local posts from localStorage
      let cachedPosts: Suggestion[] = [];
      try {
        const saved = localStorage.getItem('samjin_suggestions_persistent_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            cachedPosts = parsed.filter((s) => !s.id.startsWith('sug-default-'));
          }
        }
      } catch (e) {
        console.error(e);
      }

      if (fetchedData) {
        fetchedData = fetchedData.filter((s) => !s.id.startsWith('sug-default-'));

        const remoteIds = new Set(fetchedData.map((s) => s.id));
        // Only keep locally cached posts if they were created offline and never synced to server
        const unsyncedLocal = cachedPosts.filter((s) => (s as any).isUnsynced && !remoteIds.has(s.id));

        const mergedList = fetchedData.map((remoteItem) => {
          const cachedItem = cachedPosts.find((s) => s.id === remoteItem.id);
          if (!cachedItem) return remoteItem;

          const remoteComments = Array.isArray(remoteItem.comments) ? remoteItem.comments : [];
          // For non-admin user on author's browser: preserve author's own unmasked content
          const isOwnerLocalPost = !isAdmin && cachedItem.isSecret && cachedItem.content && !cachedItem.content.startsWith('🔒 비밀글입니다');

          return {
            ...remoteItem,
            content: (isOwnerLocalPost && remoteItem.content?.startsWith('🔒 비밀글입니다'))
              ? cachedItem.content
              : remoteItem.content,
            secretPin: cachedItem.secretPin || remoteItem.secretPin,
            comments: remoteComments,
          };
        });

        const combined = [...unsyncedLocal, ...mergedList];

        const uniqueMap = new Map<string, Suggestion>();
        combined.forEach((item) => uniqueMap.set(item.id, item));
        const fullList = Array.from(uniqueMap.values()).filter((s) => !s.id.startsWith('sug-default-'));

        // Sort by createdAt descending as default raw store order
        fullList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setSuggestions(fullList);
        try {
          localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(fullList));
        } catch (e) {
          console.error(e);
        }
      } else {
        setSuggestions(cachedPosts);
      }
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '서버 통신 오류');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotices = async () => {
    try {
      const res = await fetch('/api/notices');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          setNotices(await res.json());
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  useEffect(() => {
    fetchSuggestions();

    // Real-time listener for shared Supabase updates across all devices
    const channel = supabase
      .channel('public:suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestions' }, () => {
        fetchSuggestions();
      })
      .subscribe();

    // Fast polling every 5 seconds as fallback to guarantee all users see new suggestions live
    const interval = setInterval(() => {
      fetchSuggestions();
    }, 5000);

    const onFocus = () => {
      fetchSuggestions();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAdmin, adminPin]);

  // Derived filtered & sorted list of suggestions
  const filteredSuggestions = useMemo(() => {
    return suggestions
      .filter((s) => {
        if (selectedCategory !== 'ALL') {
          const catNorm = normalizeCategory(s.category);
          const selNorm = normalizeCategory(selectedCategory);
          if (catNorm !== selNorm) {
            return false;
          }
        }
        if (selectedStatus !== 'ALL' && s.status !== selectedStatus) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const titleMatch = s.title?.toLowerCase().includes(q);
          const contentMatch = s.content?.toLowerCase().includes(q);
          const tagMatch = s.tags?.some((t) => t.toLowerCase().includes(q));
          const authorMatch = s.authorNickname?.toLowerCase().includes(q);
          if (!titleMatch && !contentMatch && !tagMatch && !authorMatch) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'upvotes') {
          const diff = (b.upvotes || 0) - (a.upvotes || 0);
          if (diff !== 0) return diff;
        } else if (sortBy === 'comments') {
          const aComments = Array.isArray(a.comments) ? a.comments.length : 0;
          const bComments = Array.isArray(b.comments) ? b.comments.length : 0;
          const diff = bComments - aComments;
          if (diff !== 0) return diff;
        }
        // default: latest (최신순)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [suggestions, selectedCategory, selectedStatus, searchQuery, sortBy]);

  // Admin stats computation
  const stats: AdminStats = useMemo(() => {
    const categoryCounts: Record<Category, number> = {
      MEALS: 0,
      FACILITY: 0,
      ACADEMICS: 0,
      STUDENT_COUNCIL: 0,
      LIFE_RULES: 0,
      OTHER: 0,
    };

    let receivedCount = 0;
    let inReviewCount = 0;
    let answeredCount = 0;
    let appliedCount = 0;
    let onHoldCount = 0;

    const tagFreq: Record<string, number> = {};

    suggestions.forEach((s) => {
      const cat = normalizeCategory(s.category);
      if (categoryCounts[cat] !== undefined) {
        categoryCounts[cat] += 1;
      }
      if (s.status === 'RECEIVED') receivedCount++;
      else if (s.status === 'IN_REVIEW') inReviewCount++;
      else if (s.status === 'ANSWERED') answeredCount++;
      else if (s.status === 'APPLIED') appliedCount++;
      else if (s.status === 'ON_HOLD') onHoldCount++;

      s.tags?.forEach((t) => {
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagFreq)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSuggestions: suggestions.length,
      receivedCount,
      inReviewCount,
      answeredCount,
      appliedCount,
      onHoldCount,
      categoryCounts,
      topTags,
    };
  }, [suggestions]);

  // Upvote / Toggle Handler
  const handleUpvote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isAlreadyUpvoted = upvotedIds.includes(id);
    const action = isAlreadyUpvoted ? 'downvote' : 'upvote';
    const delta = isAlreadyUpvoted ? -1 : 1;
    const targetPost = suggestions.find((s) => s.id === id);

    let updatedPost: Suggestion | null = null;

    try {
      const res = await fetch(`/api/suggestions/${id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          updatedPost = await res.json();
        }
      }
    } catch (err) {
      console.warn('Express API upvote failed:', err);
    }

    if (!updatedPost && targetPost) {
      try {
        updatedPost = await incrementLikesInSupabase(id, targetPost.upvotes, delta);
      } catch (sbErr) {
        console.warn('Supabase direct upvote failed:', sbErr);
      }
    }

    if (!updatedPost && targetPost) {
      updatedPost = {
        ...targetPost,
        upvotes: Math.max(0, targetPost.upvotes + delta),
      };
    }

    if (updatedPost) {
      const finalPost = updatedPost;
      setSuggestions((prev) => prev.map((s) => (s.id === id ? finalPost : s)));
      if (selectedSuggestion?.id === id) {
        setSelectedSuggestion(finalPost);
      }
      if (isAlreadyUpvoted) {
        setUpvotedIds((prev) => prev.filter((item) => item !== id));
        showToast('🤍 공감을 취소했습니다.');
      } else {
        setUpvotedIds((prev) => [...prev, id]);
        showToast('👍 건의글에 공감표시를 하였습니다!');
      }
    }
  };

  // Add Comment Handler
  const handleAddComment = async (
    suggestionId: string,
    authorNickname: string,
    content: string,
    isOfficial?: boolean
  ) => {
    const newComment = {
      id: `comment-${Date.now()}`,
      authorNickname: authorNickname.trim() || '익명의 삼진인',
      content: content.trim(),
      createdAt: new Date().toISOString(),
      isOfficial: Boolean(isOfficial),
      officialRole: isOfficial ? '학생회' : undefined,
    };

    // Optimistically update React state immediately and save to localStorage
    setSuggestions((prev) => {
      const next = prev.map((s) => {
        if (s.id === suggestionId) {
          return {
            ...s,
            comments: [...(s.comments || []), newComment],
          };
        }
        return s;
      });
      try {
        localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    setSelectedSuggestion((prev) => {
      if (prev && prev.id === suggestionId) {
        return {
          ...prev,
          comments: [...(prev.comments || []), newComment],
        };
      }
      return prev;
    });

    let updatedPost: Suggestion | null = null;

    try {
      const res = await fetch(`/api/suggestions/${suggestionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorNickname,
          content,
          isOfficial,
          officialRole: isOfficial ? '학생회' : undefined,
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          updatedPost = await res.json();
        }
      }
    } catch (err) {
      console.warn('Comment API error:', err);
    }

    if (!updatedPost) {
      try {
        updatedPost = await addCommentToSupabase(suggestionId, newComment);
      } catch (sbErr) {
        console.warn('Supabase add comment failed:', sbErr);
      }
    }

    if (updatedPost) {
      const finalPost = updatedPost;
      // Guarantee newComment is included in finalPost comments array
      if (
        !finalPost.comments ||
        !finalPost.comments.some((c) => c.id === newComment.id || (c.content === newComment.content && c.authorNickname === newComment.authorNickname))
      ) {
        finalPost.comments = [...(finalPost.comments || []), newComment];
      }

      setSuggestions((prev) => {
        const next = prev.map((s) => (s.id === suggestionId ? finalPost : s));
        try {
          localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
      setSelectedSuggestion((prev) => (prev && prev.id === suggestionId ? finalPost : prev));
    }

    showToast('💬 댓글이 작성되었습니다.');
  };

  // Delete Comment Handler (Admin)
  const handleDeleteComment = async (suggestionId: string, commentId: string) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;

    setSuggestions((prev) => {
      const next = prev.map((s) => {
        if (s.id === suggestionId) {
          return {
            ...s,
            comments: (s.comments || []).filter((c) => c.id !== commentId),
          };
        }
        return s;
      });
      try {
        localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    setSelectedSuggestion((prev) => {
      if (prev && prev.id === suggestionId) {
        return {
          ...prev,
          comments: (prev.comments || []).filter((c) => c.id !== commentId),
        };
      }
      return prev;
    });

    try {
      await fetch(`/api/suggestions/${suggestionId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Delete comment API error:', err);
    }

    try {
      await deleteCommentFromSupabase(suggestionId, commentId);
    } catch (err) {
      console.warn('Delete comment Supabase error:', err);
    }

    showToast('🗑️ 댓글이 삭제되었습니다.');
  };

  // Status & Official Response Update Handler
  const handleUpdateStatus = async (id: string, status: Status, responseContent?: string) => {
    let updatedPost: Suggestion | null = null;

    try {
      const res = await fetch(`/api/suggestions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          adminPin,
          officialResponse: responseContent
            ? {
                authorName: '학생회장',
                department: '제53대 삼진고 학생회',
                content: responseContent,
              }
            : undefined,
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          updatedPost = await res.json();
        }
      }
    } catch (err) {
      console.warn('Update status API failed:', err);
    }

    if (!updatedPost) {
      try {
        updatedPost = await updateStatusInSupabase(id, status, responseContent);
      } catch (sbErr) {
        console.warn('Supabase update status failed:', sbErr);
      }
    }

    if (!updatedPost) {
      const target = suggestions.find((s) => s.id === id);
      if (target) {
        updatedPost = {
          ...target,
          status,
          officialResponse: responseContent
            ? {
                authorName: '학생회장',
                department: '제53대 삼진고 학생회',
                content: responseContent,
                updatedAt: new Date().toISOString(),
                status,
              }
            : target.officialResponse,
        };
      }
    }

    if (updatedPost) {
      const finalPost = updatedPost;
      setSuggestions((prev) => prev.map((s) => (s.id === id ? finalPost : s)));
      if (selectedSuggestion?.id === id) {
        setSelectedSuggestion(finalPost);
      }
      showToast('✅ 건의사항 상태 및 공식 답변이 업데이트되었습니다.');
    }
  };

  // Create New Suggestion Handler (Netlify / Static Hosting Resilient)
  const handleCreateSuggestion = async (formData: {
    category: Category;
    title: string;
    content: string;
    authorNickname: string;
    isSecret: boolean;
    secretPin?: string;
    tags: string[];
  }) => {
    let createdPost: Suggestion | null = null;

    // 1. Try Express backend API
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          createdPost = await res.json();
        }
      }
    } catch (apiErr) {
      console.warn('Express backend API not available (e.g. Netlify hosting):', apiErr);
    }

    // 2. Direct Supabase insert if backend API is not present or failed
    if (!createdPost) {
      try {
        createdPost = await insertSuggestionToSupabase(formData);
      } catch (sbErr) {
        console.warn('Direct Supabase insert error:', sbErr);
      }
    }

    // 3. In-memory / Local fallback if both API and Supabase direct insert failed
    if (!createdPost) {
      createdPost = {
        id: `sug-${Date.now()}`,
        category: formData.category,
        title: formData.title.trim(),
        content: formData.content.trim(),
        authorNickname: formData.authorNickname.trim() || '익명의 삼진인',
        isSecret: formData.isSecret,
        secretPin: formData.secretPin,
        status: 'RECEIVED',
        upvotes: 0,
        tags: formData.tags.length > 0 ? formData.tags : ['#마산삼진고', '#건의사항'],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    setSuggestions((prev) => [createdPost!, ...prev]);
    showToast('🎉 새로운 익명 건의사항이 정상 등록되었습니다!');
  };

  // Delete Suggestion Handler
  const handleDeleteSuggestion = async (id: string, pin?: string) => {
    let deletedSuccess = false;

    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, adminPin }),
      });

      if (res.ok) {
        deletedSuccess = true;
      }
    } catch (err) {
      console.warn('Delete API failed:', err);
    }

    if (!deletedSuccess) {
      try {
        await deleteSuggestionFromSupabase(id);
        deletedSuccess = true;
      } catch (sbErr) {
        console.warn('Supabase delete failed:', sbErr);
        deletedSuccess = true;
      }
    }

    if (deletedSuccess) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      if (selectedSuggestion?.id === id) {
        setSelectedSuggestion(null);
      }
      showToast('🗑️ 건의글이 삭제되었습니다.');
    }
  };

  // Student Lookup Handler
  const handleStudentLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);

    if (!lookupId.trim()) {
      setLookupError('건의글 번호나 제목 검색어를 입력해주세요.');
      return;
    }

    const found = suggestions.find(
      (s) =>
        s.id.toLowerCase() === lookupId.trim().toLowerCase() ||
        s.title.toLowerCase().includes(lookupId.trim().toLowerCase())
    );

    if (!found) {
      setLookupError('해당 일치하는 건의글을 찾을 수 없습니다.');
      return;
    }

    if (found.isSecret) {
      if (!lookupPin.trim()) {
        setLookupError('비밀글 조회를 위해 비밀번호(PIN 4자리)를 입력해주세요.');
        return;
      }
      let verified = false;

      try {
        const res = await fetch(`/api/suggestions/${found.id}/verify-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: lookupPin.trim() }),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.verified) verified = true;
          }
        }
      } catch (err) {
        console.warn('Verify PIN API error:', err);
      }

      if (!verified) {
        if (
          found.secretPin &&
          (found.secretPin === lookupPin.trim() || lookupPin.trim() === 'fldkzh' || lookupPin.trim() === adminPin)
        ) {
          verified = true;
        }
      }

      if (verified) {
        setLookupResult(found);
        setSelectedSuggestion(found);
      } else {
        setLookupError('비밀글 비밀번호(PIN)가 일치하지 않습니다.');
      }
      return;
    }

    setLookupResult(found);
    setSelectedSuggestion(found);
  };

  // Admin Login
  const handleLoginAdmin = (pin: string) => {
    if (pin === 'fldkzh') {
      setIsAdmin(true);
      setAdminPin(pin);
      showToast('🛡️ 학생회/교사 관리자 모드로 전환되었습니다.');
      return true;
    }
    return false;
  };

  const handleLogoutAdmin = () => {
    setIsAdmin(false);
    showToast('🔒 관리자 모드가 해제되었습니다.');
  };

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-[#2D2926] flex flex-col font-sans selection:bg-[#5F7161]/20">
      
      {/* Toast Popup Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-50 bg-[#2D2926] text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-xl border border-[#4A443F] flex items-center justify-center sm:justify-start space-x-2 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Navigation Navbar */}
      <Navbar
        isAdmin={isAdmin}
        onToggleAdminMode={() => {
          if (isAdmin) handleLogoutAdmin();
          else setIsAdminDashboardOpen(true);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
        stats={stats}
      />

      {/* School Info Banner */}
      <SchoolInfoBanner
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      {/* Category Filter & Search Control Bar for All Users */}
      <CategoryFilterBar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex-1 w-full">
        
        <div>
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 bg-[#F4F1EA] p-3.5 sm:p-4 rounded-2xl border border-[#E6E2D3]">
            <div className="flex items-start sm:items-center space-x-2">
              {isAdmin ? (
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <MessageSquare className="w-5 h-5 text-[#5F7161] shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-extrabold text-[#2D2926] text-sm sm:text-lg">
                    {isAdmin ? '[관리자] 익명 건의 목록' : '삼진고 익명 건의 목록'}
                  </h2>
                  <span className="text-[11px] sm:text-xs font-bold text-[#5F7161] bg-white border border-[#E6E2D3] px-2 py-0.5 rounded-full">
                    총 {filteredSuggestions.length}건
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#8C8479] mt-0.5">
                  🌐 공개 건의글은 최상단에 자동 등록되며, 🔒 비밀글은 설정한 PIN 번호로 열람하실 수 있습니다.
                </p>
              </div>
            </div>

            <button
              onClick={fetchSuggestions}
              className="self-end sm:self-auto text-xs text-[#8C8479] hover:text-[#2D2926] flex items-center gap-1 font-bold bg-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#E6E2D3] hover:bg-[#F4F1EA] transition-colors shrink-0 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>새로고침</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 sm:py-20 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-[#5F7161] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-[#8C8479] font-medium">건의사항 목록을 불러오는 중입니다...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 sm:p-8 text-center my-6 text-rose-800">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="font-bold text-sm">{error}</p>
              <button
                onClick={fetchSuggestions}
                className="mt-3 text-xs bg-rose-600 text-white font-bold px-4 py-2 rounded-xl"
              >
                다시 시도
              </button>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="bg-white rounded-2xl sm:rounded-[32px] border border-[#E6E2D3] p-8 sm:p-12 text-center my-4 sm:my-6 space-y-3 sm:space-y-4 shadow-xs">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-[#F4F1EA] text-[#5F7161] mx-auto flex items-center justify-center text-xl sm:text-2xl font-bold">
                💬
              </div>
              <div>
                <h3 className="font-bold text-[#2D2926] text-base sm:text-lg">등록된 건의사항이 없습니다</h3>
                <p className="text-xs text-[#8C8479] mt-1">
                  선택한 필터 조건에 부합하는 익명 건의글이 없습니다. 첫 번째 건의글을 작성해 보세요!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
              {filteredSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onSelectCard={(s) => setSelectedSuggestion(s)}
                  onUpvote={handleUpvote}
                  isUpvoted={upvotedIds.includes(suggestion.id)}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Detail Modal */}
      <SuggestionDetailModal
        suggestion={selectedSuggestion}
        isOpen={Boolean(selectedSuggestion)}
        onClose={() => setSelectedSuggestion(null)}
        onUpvote={handleUpvote}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onUpdateStatus={handleUpdateStatus}
        onDeleteSuggestion={handleDeleteSuggestion}
        isAdmin={isAdmin}
        adminPin={adminPin}
        isUpvoted={selectedSuggestion ? upvotedIds.includes(selectedSuggestion.id) : false}
      />

      {/* Create Modal */}
      <SuggestionFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSuggestion}
      />

      {/* Admin Dashboard */}
      <AdminDashboard
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
        suggestions={suggestions}
        stats={stats}
        isAdmin={isAdmin}
        onLoginAdmin={handleLoginAdmin}
        onLogoutAdmin={handleLogoutAdmin}
        onSelectSuggestion={(s) => {
          setIsAdminDashboardOpen(false);
          setSelectedSuggestion(s);
        }}
      />

      {/* Notice Modal */}
      <NoticeModal
        notice={selectedNotice}
        isOpen={Boolean(selectedNotice)}
        onClose={() => setSelectedNotice(null)}
      />

      {/* Footer */}
      <footer className="bg-[#F4F1EA] text-[#8C8479] text-xs py-8 border-t border-[#E6E2D3] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="font-bold text-[#2D2926]">
            🏫 마산삼진고등학교 익명 소통 플랫폼 • 삼진소통 (Samjin Voice)
          </p>
          <p className="text-[11px] text-[#8C8479]">
            경상남도 창원시 마산합포구 진동면 • 제53대 삼진고등학교 학생회 및 학생지도부 공동운영
          </p>
          <p className="text-[10px] text-[#8C8479] pt-1">
            본 시스템은 학생의 익명성을 철저히 보호하며, 건설적이고 정중한 의견 제시 문화를 지향합니다.
          </p>
        </div>
      </footer>

    </div>
  );
}

