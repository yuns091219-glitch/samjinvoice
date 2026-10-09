import React, { useState, useEffect, useMemo } from 'react';
import {
  Suggestion,
  Category,
  Status,
  Notice,
  AdminStats,
  normalizeCategory,
  isSecretSuggestion,
  isPostUnlocked,
  markPostAsUnlocked,
  stripMetadataMarkers,
  extractMetadataFromContent,
  deduplicateComments,
} from './types';
import { Navbar } from './components/Navbar';
import { SchoolInfoBanner } from './components/SchoolInfoBanner';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { SuggestionCard } from './components/SuggestionCard';
import { SuggestionDetailModal } from './components/SuggestionDetailModal';
import { SuggestionFormModal } from './components/SuggestionFormModal';
import { AdminDashboard } from './components/AdminDashboard';
import { NoticeModal } from './components/NoticeModal';
import { MessageSquare, RefreshCw, AlertCircle, ShieldCheck, Lock, Search, Key, CheckCircle2, Trash2, X } from 'lucide-react';
import {
  fetchSuggestionsFromSupabase,
  insertSuggestionToSupabase,
  incrementLikesInSupabase,
  updateStatusInSupabase,
  approveSuggestionInSupabase,
  deleteSuggestionFromSupabase,
  addCommentToSupabase,
  deleteCommentFromSupabase,
  verifySuggestionPin,
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
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem('samjin_admin_token'));
    } catch {
      return false;
    }
  });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('samjin_admin_token');
    } catch {
      return null;
    }
  });

  // Verify stored session token with backend on mount
  useEffect(() => {
    if (adminToken) {
      fetch('/api/admin/verify', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-admin-token': adminToken,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.isAdmin) {
            setIsAdmin(false);
            setAdminToken(null);
            try {
              sessionStorage.removeItem('samjin_admin_token');
            } catch {}
          } else {
            setIsAdmin(true);
          }
        })
        .catch(() => {});
    }
  }, [adminToken]);

  // Student Self-Lookup state
  const [lookupId, setLookupId] = useState('');
  const [lookupPin, setLookupPin] = useState('');
  const [lookupResult, setLookupResult] = useState<Suggestion | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // In-app Delete Confirmation Modal State (Reliable across all browsers and iframes)
  interface DeleteTarget {
    type: 'suggestion' | 'comment';
    id: string; // suggestionId
    commentId?: string;
    title: string;
    isSecret: boolean;
    savedPin?: string;
  }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const getMyPostIds = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('samjin_my_post_ids') || '[]');
    } catch {
      return [];
    }
  };

  const markAsMyPost = (id: string) => {
    const ids = getMyPostIds();
    if (!ids.includes(id)) {
      ids.push(id);
      try {
        localStorage.setItem('samjin_my_post_ids', JSON.stringify(ids));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const isMyPost = (post: Suggestion): boolean => {
    const myIds = getMyPostIds();
    return myIds.includes(post.id);
  };

  const getAdminHeaders = (): Record<string, string> => {
    if (!isAdmin || !adminToken) return {};
    return {
      'Authorization': `Bearer ${adminToken}`,
      'x-admin-token': adminToken,
    };
  };

  const getAdminQuery = (): string => {
    return '';
  };

  // Fetch initial suggestions from Express API or direct Supabase client
  const fetchSuggestions = async () => {
    try {
      setLoading(true);

      let fetchedData: Suggestion[] | null = null;

      // 1. Try Express server API
      try {
        const res = await fetch(`/api/suggestions`, {
          headers: getAdminHeaders(),
        });
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
          const cachedItem = cachedPosts.find((s) => String(s.id) === String(remoteItem.id));
          if (!cachedItem) return remoteItem;

          const remoteComments = Array.isArray(remoteItem.comments) ? remoteItem.comments : [];
          const cachedComments = Array.isArray(cachedItem.comments) ? cachedItem.comments : [];

          // Merge comments uniquely and safely using deduplicateComments
          const mergedComments = deduplicateComments([...cachedComments, ...remoteComments]);

          if (isAdmin) {
            // When in Admin mode, remoteItem contains 100% unmasked authentic data directly from server.
            // Do NOT let masked cached strings from localStorage contaminate the unmasked data.
            return {
              ...remoteItem,
              comments: mergedComments,
            };
          }

          // For non-admin user on author's browser: preserve author's own unmasked content
          const isOwnerLocalPost = !isAdmin && isMyPost(cachedItem) && cachedItem.isSecret && cachedItem.content && !cachedItem.content.startsWith('🔒 비밀글입니다');
          const resolvedAuthor = (remoteItem.authorNickname && remoteItem.authorNickname !== '익명의 삼진인')
            ? remoteItem.authorNickname
            : (cachedItem?.authorNickname || remoteItem.authorNickname || '익명의 삼진인');
          const resolvedCategory = (remoteItem.category && remoteItem.category !== 'OTHER')
            ? normalizeCategory(remoteItem.category)
            : (cachedItem?.category ? normalizeCategory(cachedItem.category) : normalizeCategory(remoteItem.category));
          
          const combinedCandidateTags = [
            ...(Array.isArray(remoteItem.tags) ? remoteItem.tags : []),
            ...(Array.isArray(cachedItem?.tags) ? cachedItem.tags : []),
          ];
          let resolvedTags = Array.from(
            new Set(
              combinedCandidateTags
                .map((t) => (t.startsWith('#') ? t : `#${t}`))
                .filter((t) => t.length > 1)
            )
          );
          if (resolvedTags.length === 0) {
            resolvedTags = ['#마산삼진고', '#학생건의'];
          }

          return {
            ...remoteItem,
            category: resolvedCategory,
            authorNickname: resolvedAuthor,
            tags: resolvedTags,
            isSecret: Boolean(cachedItem.isSecret || remoteItem.isSecret),
            content: (isOwnerLocalPost && remoteItem.content?.startsWith('🔒 비밀글입니다'))
              ? cachedItem.content
              : remoteItem.content,
            secretPin: cachedItem.secretPin || remoteItem.secretPin,
            comments: mergedComments,
          };
        });

        const combined = [...unsyncedLocal, ...mergedList];

        const uniqueMap = new Map<string, Suggestion>();
        combined.forEach((item) => uniqueMap.set(item.id, item));
        const fullList = Array.from(uniqueMap.values()).filter((s) => !s.id.startsWith('sug-default-'));

        // Sort by createdAt descending as default raw store order
        fullList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setSuggestions(fullList);
        setSelectedSuggestion((prev) => {
          if (!prev) return null;
          const updated = fullList.find((s) => s.id === prev.id);
          if (!updated) return prev;
          const prevComments = prev.comments || [];
          const nextComments = updated.comments || [];
          const mergedComments = deduplicateComments([...prevComments, ...nextComments]);

          return {
            ...updated,
            content: isAdmin
              ? updated.content
              : (prev.content && !prev.content.startsWith('🔒 비밀글입니다'))
              ? prev.content
              : updated.content,
            comments: mergedComments,
          };
        });
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, adminToken]);

  // Derived filtered & sorted list of suggestions
  const filteredSuggestions = useMemo(() => {
    return suggestions
      .map((s) => {
        const meta = extractMetadataFromContent(s.title, s.content);
        const isSecretPost = isSecretSuggestion(s) || meta.isSecret;
        const isUnlocked = isPostUnlocked(s.id, isAdmin);

        const cleanTitle = meta.cleanTitle || s.title || '제목 없음';
        let cleanContent = meta.cleanContent;

        const effectiveCategory = s.category && s.category !== 'OTHER' ? s.category : (meta.category || s.category || 'OTHER');
        const effectiveAuthor = s.authorNickname && s.authorNickname !== '익명의 삼진인'
          ? s.authorNickname
          : (meta.authorNickname || s.authorNickname || '익명의 삼진인');

        const candidateTags = [
          ...(Array.isArray(s.tags) ? s.tags : []),
          ...(Array.isArray(meta.tags) ? meta.tags : []),
        ];

        let finalTags = Array.from(
          new Set(
            candidateTags
              .map((t: string) => (t.startsWith('#') ? t : `#${t}`))
              .filter((t: string) => t.length > 1)
          )
        );
        if (finalTags.length === 0) {
          finalTags = ['#마산삼진고', '#학생건의'];
        }
        if (isSecretPost && !finalTags.includes('#비밀글')) {
          finalTags.push('#비밀글');
        }

        if (isSecretPost) {
          if (!isUnlocked) {
            cleanContent = '🔒 비밀글입니다. 작성자 본인 및 관리자만 열람할 수 있습니다. (클릭하여 PIN 입력)';
          }
          return {
            ...s,
            category: effectiveCategory,
            authorNickname: effectiveAuthor,
            title: cleanTitle,
            content: cleanContent,
            tags: finalTags,
            isSecret: true,
          };
        }

        return {
          ...s,
          category: effectiveCategory,
          authorNickname: effectiveAuthor,
          title: cleanTitle,
          content: cleanContent,
          tags: finalTags,
        };
      })
      .filter((s) => {
        // Non-admin public view: hide unapproved suggestions unless it is the student's own post
        if (!isAdmin) {
          const isPending = s.status === 'PENDING_APPROVAL' || s.isApproved === false;
          if (isPending && !isMyPost(s)) {
            return false;
          }
        }

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
          const cleanQ = q.startsWith('#') ? q.slice(1) : q;
          const titleMatch = s.title?.toLowerCase().includes(q) || s.title?.toLowerCase().includes(cleanQ);
          const contentMatch = s.content?.toLowerCase().includes(q) || s.content?.toLowerCase().includes(cleanQ);
          const tagMatch = s.tags?.some((t) => {
            const cleanT = t.toLowerCase().replace(/^#+/, '');
            return t.toLowerCase().includes(q) || cleanT.includes(cleanQ);
          });
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
  }, [suggestions, selectedCategory, selectedStatus, searchQuery, sortBy, isAdmin]);

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

    let pendingApprovalCount = 0;
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
      if (s.status === 'PENDING_APPROVAL' || s.isApproved === false) pendingApprovalCount++;
      else if (s.status === 'RECEIVED') receivedCount++;
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
      pendingApprovalCount,
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
      const res = await fetch(`/api/suggestions/${id}/upvote${getAdminQuery()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
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
      const resp = updatedPost;
      setSuggestions((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(id)) {
            const isSecretPost = Boolean(s.isSecret || resp.isSecret || s.tags?.includes('#비밀글') || resp.tags?.includes('#비밀글'));
            let combinedTags = Array.from(new Set([...(s.tags || []), ...(resp.tags || [])]));
            if (isSecretPost && !combinedTags.includes('#비밀글')) {
              combinedTags.push('#비밀글');
            }
            const preservedContent = (s.content && !s.content.startsWith('🔒 비밀글입니다'))
              ? s.content
              : resp.content;

            // Preserve all comments on upvote
            const sComments = Array.isArray(s.comments) ? s.comments : [];
            const rComments = Array.isArray(resp.comments) ? resp.comments : [];
            const mergedComments = deduplicateComments([...sComments, ...rComments]);

            const merged: Suggestion = {
              ...s,
              ...resp,
              id: String(s.id),
              upvotes: Number(resp.upvotes ?? s.upvotes),
              isSecret: isSecretPost,
              tags: combinedTags,
              content: preservedContent,
              comments: mergedComments,
            };
            if (selectedSuggestion?.id === id) {
              setSelectedSuggestion(merged);
            }
            return merged;
          }
          return s;
        })
      );

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
            comments: deduplicateComments([...(s.comments || []), newComment]),
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
          comments: deduplicateComments([...(prev.comments || []), newComment]),
        };
      }
      return prev;
    });

    let updatedPost: Suggestion | null = null;

    try {
      const res = await fetch(`/api/suggestions/${suggestionId}/comments${getAdminQuery()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
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
      const resp = updatedPost;

      setSuggestions((prev) => {
        const next = prev.map((s) => {
          if (String(s.id) === String(suggestionId)) {
            const isSecretPost = Boolean(s.isSecret || resp.isSecret || s.tags?.includes('#비밀글') || resp.tags?.includes('#비밀글'));
            let combinedTags = Array.from(new Set([...(s.tags || []), ...(resp.tags || [])]));
            if (isSecretPost && !combinedTags.includes('#비밀글')) {
              combinedTags.push('#비밀글');
            }
            const preservedContent = (s.content && !s.content.startsWith('🔒 비밀글입니다'))
              ? s.content
              : resp.content;

            const sComments = Array.isArray(s.comments) ? s.comments : [];
            const rComments = Array.isArray(resp.comments) ? resp.comments : [];
            const mergedComments = deduplicateComments([...sComments, ...rComments]);

            const merged: Suggestion = {
              ...s,
              ...resp,
              id: String(s.id),
              isSecret: isSecretPost,
              tags: combinedTags,
              content: preservedContent,
              comments: mergedComments,
            };
            if (selectedSuggestion?.id === suggestionId) {
              setSelectedSuggestion(merged);
            }
            return merged;
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
    }

    showToast('💬 댓글이 작성되었습니다.');
  };

  // Request Delete Comment (Opens in-app confirmation modal without relying on browser confirm)
  const requestDeleteComment = (suggestionId: string, commentId: string) => {
    const parentSuggestion = suggestions.find((s) => String(s.id) === String(suggestionId));
    const targetComment = parentSuggestion?.comments?.find((c) => String(c.id) === String(commentId));
    const previewText = targetComment?.content ? `"${targetComment.content.slice(0, 30)}..."` : '선택한 댓글';

    setDeleteTarget({
      type: 'comment',
      id: suggestionId,
      commentId,
      title: previewText,
      isSecret: false,
    });
    setDeletePinInput('');
    setDeleteError(null);
  };

  // Execute Delete Comment
  const executeDeleteComment = async (suggestionId: string, commentId: string) => {
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
      await fetch(`/api/suggestions/${suggestionId}/comments/${commentId}${getAdminQuery()}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
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

  // Legacy / Direct handler
  const handleDeleteComment = async (suggestionId: string, commentId: string) => {
    requestDeleteComment(suggestionId, commentId);
  };

  // Status & Official Response Update Handler
  const handleUpdateStatus = async (
    id: string,
    status: Status,
    responseContent?: string,
    authorName: string = '학생자치부장',
    department: string = '제53대 학생회'
  ) => {
    let updatedPost: Suggestion | null = null;
    const cleanAuthor = authorName.trim() || '학생자치부장';
    const cleanDept = department.trim() || '제53대 학생회';

    try {
      const res = await fetch(`/api/suggestions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          status,
          officialResponse: responseContent
            ? {
                authorName: cleanAuthor,
                department: cleanDept,
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
        updatedPost = await updateStatusInSupabase(id, status, responseContent, cleanAuthor, cleanDept);
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
                authorName: cleanAuthor,
                department: cleanDept,
                content: responseContent,
                updatedAt: new Date().toISOString(),
                status,
              }
            : target.officialResponse,
        };
      }
    }

    if (updatedPost) {
      const resp = updatedPost;
      setSuggestions((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(id)) {
            const isSecretPost = Boolean(s.isSecret || resp.isSecret || s.tags?.includes('#비밀글') || resp.tags?.includes('#비밀글'));
            let combinedTags = Array.from(new Set([...(s.tags || []), ...(resp.tags || [])]));
            if (isSecretPost && !combinedTags.includes('#비밀글')) {
              combinedTags.push('#비밀글');
            }
            const preservedContent = (s.content && !s.content.startsWith('🔒 비밀글입니다'))
              ? s.content
              : resp.content;

            const merged: Suggestion = {
              ...s,
              ...resp,
              id: String(s.id),
              isSecret: isSecretPost,
              tags: combinedTags,
              content: preservedContent,
            };
            if (selectedSuggestion?.id === id) {
              setSelectedSuggestion(merged);
            }
            return merged;
          }
          return s;
        })
      );
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
        createdPost = await insertSuggestionToSupabase({
          ...formData,
          isApproved: false,
          status: 'PENDING_APPROVAL',
        });
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
        status: 'PENDING_APPROVAL',
        isApproved: false,
        upvotes: 0,
        tags: formData.tags.length > 0 ? formData.tags : ['#마산삼진고', '#건의사항'],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (createdPost) {
      createdPost.category = formData.category || createdPost.category;
      createdPost.authorNickname = formData.authorNickname.trim() || createdPost.authorNickname || '익명의 삼진인';
      createdPost.isSecret = formData.isSecret || createdPost.isSecret;
      createdPost.status = 'PENDING_APPROVAL';
      createdPost.isApproved = false;
      createdPost.tags = formData.tags && formData.tags.length > 0 ? formData.tags : (createdPost.tags && createdPost.tags.length > 0 ? createdPost.tags : ['#마산삼진고', '#건의사항']);
      if (formData.secretPin) {
        createdPost.secretPin = formData.secretPin;
        try {
          localStorage.setItem(`samjin_pin_${createdPost.id}`, formData.secretPin);
        } catch (e) {}
      }
      markAsMyPost(createdPost.id);
      if (createdPost.isSecret) {
        markPostAsUnlocked(createdPost.id);
      }

      try {
        const localPosts = JSON.parse(localStorage.getItem('samjin_local_suggestions') || '[]');
        localPosts.unshift(createdPost);
        localStorage.setItem('samjin_local_suggestions', JSON.stringify(localPosts));

        const persistentPosts = JSON.parse(localStorage.getItem('samjin_suggestions_persistent_v1') || '[]');
        persistentPosts.unshift(createdPost);
        localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(persistentPosts));
      } catch (e) {
        console.error(e);
      }
    }

    setSuggestions((prev) => [createdPost!, ...prev]);
    showToast('📝 건의가 접수되었습니다! 관리자(학생회) 검토 및 승인 후 공개 게시판에 등록됩니다.');
  };

  // Approve Suggestion Handler (Admin Action)
  const handleApproveSuggestion = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      // 1. Try Express backend API
      try {
        await fetch(`/api/suggestions/${id}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        });
      } catch (apiErr) {
        console.warn('Express API approve failed, falling back:', apiErr);
      }

      // 2. Direct Supabase update
      try {
        await approveSuggestionInSupabase(id);
      } catch (sbErr) {
        console.warn('Supabase approve direct failed:', sbErr);
      }

      // 3. Update state
      setSuggestions((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(id)) {
            return {
              ...s,
              status: 'RECEIVED',
              isApproved: true,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        })
      );

      if (selectedSuggestion && String(selectedSuggestion.id) === String(id)) {
        setSelectedSuggestion((prev) =>
          prev ? { ...prev, status: 'RECEIVED', isApproved: true } : null
        );
      }

      showToast('✨ 건의글이 통과(승인)되어 전체 공개 게시판에 등록되었습니다!');
    } catch (err) {
      console.error('Error approving suggestion:', err);
      showToast('건의글 승인 처리 중 오류가 발생했습니다.');
    }
  };

  // Request Delete Suggestion (Admin-only in-app confirmation modal)
  const requestDeleteSuggestion = (id: string, initialPin?: string) => {
    if (!isAdmin) {
      showToast('🔒 건의글 삭제는 학생회 관리자만 가능합니다.');
      return;
    }

    const found = suggestions.find((s) => String(s.id) === String(id));
    const title = found?.title ? stripMetadataMarkers(found.title) : '선택한 건의글';
    const isSecret = found ? (found.isSecret || isSecretSuggestion(found)) : false;
    const savedPin = initialPin || localStorage.getItem(`samjin_pin_${id}`) || '';

    setDeleteTarget({
      type: 'suggestion',
      id: String(id),
      title,
      isSecret,
      savedPin,
    });
    setDeletePinInput(savedPin);
    setDeleteError(null);
  };

  // Execute Delete Suggestion Handler (Admin Only)
  const executeDeleteSuggestion = async (id: string, pin?: string): Promise<boolean> => {
    if (!isAdmin) {
      showToast('🔒 건의글 삭제는 학생회 관리자만 가능합니다.');
      return false;
    }

    let deletedSuccess = false;
    const effectivePin = pin || localStorage.getItem(`samjin_pin_${id}`) || undefined;

    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ pin: effectivePin }),
      });

      if (res.ok) {
        deletedSuccess = true;
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          showToast(`❌ ${data.error || '삭제 권한이 없습니다. 관리자 로그인을 확인해주세요.'}`);
          return false;
        }
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
      }
    }

    if (deletedSuccess) {
      // Remove from local storage caches
      try {
        const myIds = getMyPostIds().filter((postId) => postId !== id);
        localStorage.setItem('samjin_my_post_ids', JSON.stringify(myIds));

        const localPosts = JSON.parse(localStorage.getItem('samjin_local_suggestions') || '[]')
          .filter((s: any) => String(s.id) !== String(id));
        localStorage.setItem('samjin_local_suggestions', JSON.stringify(localPosts));

        const persistentPosts = JSON.parse(localStorage.getItem('samjin_suggestions_persistent_v1') || '[]')
          .filter((s: any) => String(s.id) !== String(id));
        localStorage.setItem('samjin_suggestions_persistent_v1', JSON.stringify(persistentPosts));

        localStorage.removeItem(`samjin_pin_${id}`);
      } catch (e) {
        console.error(e);
      }

      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      if (selectedSuggestion?.id === id) {
        setSelectedSuggestion(null);
      }
      showToast('🗑️ 건의글이 삭제되었습니다.');
      return true;
    } else {
      showToast('❌ 게시글 삭제 중 오류가 발생했습니다. 관리자 로그인 상태를 확인해주세요.');
      return false;
    }
  };

  // Legacy / Direct handler: checks admin first
  const handleDeleteSuggestion = (id: string, pin?: string) => {
    if (!isAdmin) {
      showToast('🔒 건의글 삭제는 학생회 관리자만 가능합니다.');
      return;
    }
    requestDeleteSuggestion(id, pin);
  };

  // Confirm execution from Delete Modal
  const handleConfirmDeleteModal = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      if (deleteTarget.type === 'comment' && deleteTarget.commentId) {
        await executeDeleteComment(deleteTarget.id, deleteTarget.commentId);
        setDeleteTarget(null);
        return;
      }

      // Suggestion delete (Admin only)
      if (!isAdmin) {
        setDeleteError('건의글 삭제는 관리자만 가능합니다.');
        return;
      }

      const success = await executeDeleteSuggestion(deleteTarget.id);
      if (success) {
        setDeleteTarget(null);
      } else {
        setDeleteError('삭제에 실패했습니다. 관리자 세션이 만료되었거나 권한이 없습니다.');
      }
    } finally {
      setDeleteSubmitting(false);
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

    const isSecret = isSecretSuggestion(found);
    if (isSecret) {
      if (!lookupPin.trim()) {
        setLookupError('비밀글 조회를 위해 비밀번호(PIN 4자리)를 입력해주세요.');
        return;
      }
      let verified = verifySuggestionPin(found, lookupPin.trim());
      let unmaskedSuggestion: Suggestion | null = null;

      if (!verified) {
        try {
          const res = await fetch(`/api/suggestions/${found.id}/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
            body: JSON.stringify({ pin: lookupPin.trim() }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.verified) {
              verified = true;
              unmaskedSuggestion = data.suggestion;
            }
          }
        } catch (err) {
          console.warn('Verify PIN API error:', err);
        }
      }

      if (verified) {
        markPostAsUnlocked(found.id);
        markAsMyPost(found.id);
        const targetObj = unmaskedSuggestion || found;
        setLookupResult(targetObj);
        setSelectedSuggestion(targetObj);
      } else {
        setLookupError('비밀글 비밀번호(PIN)가 일치하지 않습니다.');
      }
      return;
    }

    setLookupResult(found);
    setSelectedSuggestion(found);
  };

  // Admin Login (Secure server-side authentication: PIN is never exposed in client source code)
  const handleLoginAdmin = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setIsAdmin(true);
        setAdminToken(data.token);
        try {
          sessionStorage.setItem('samjin_admin_token', data.token);
        } catch {}
        showToast('🛡️ 관리자(학생회) 모드 활성화: 심사 대기 건의 검토 및 전체 관리가 가능합니다.');
        setTimeout(() => {
          fetchSuggestions();
        }, 100);
        return true;
      } else {
        showToast(data.error || '관리자 비밀번호가 올바르지 않습니다.');
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      showToast('서버 통신 중 오류가 발생했습니다.');
      return false;
    }
  };

  const handleLogoutAdmin = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-token': adminToken,
          },
        });
      } catch {}
    }
    setIsAdmin(false);
    setAdminToken(null);
    try {
      sessionStorage.removeItem('samjin_admin_token');
    } catch {}
    showToast('🔒 일반 모드 전환: 관리자 세션이 안전하게 종료되었습니다.');
    setTimeout(() => {
      fetchSuggestions();
    }, 100);
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
                  공개 건의글은 모든 학우에게 공개되며, 비밀글은 작성 본인과 관리자만 볼 수 있습니다.
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
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-[#F4F1EA] text-[#5F7161] mx-auto flex items-center justify-center">
                <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-[#5F7161]" />
              </div>
              <div>
                <h3 className="font-bold text-[#2D2926] text-base sm:text-lg">등록된 건의사항이 없습니다</h3>
                <p className="text-xs text-[#8C8479] mt-1">
                  선택한 필터 조건에 부합하는 익명 건의글이 없습니다. 첫 번째 건의글을 작성해 보세요!
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Admin Pending Review Banner */}
              {isAdmin && stats.pendingApprovalCount > 0 && (
                <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      심사
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        현재 승인 대기 중인 학생 건의가 <span className="text-amber-700 underline font-extrabold">{stats.pendingApprovalCount}건</span> 있습니다.
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        학생회 관리자 검토 후 [통과]를 누르면 모든 학우에게 공개 게시판에 등록됩니다.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAdminDashboardOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95"
                  >
                    대시보드 승인 대기함 열기 →
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                {filteredSuggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onSelectCard={(s) => setSelectedSuggestion(s)}
                    onUpvote={handleUpvote}
                    onTagClick={(tag) => setSearchQuery(tag)}
                    onDeleteSuggestion={handleDeleteSuggestion}
                    onApproveSuggestion={handleApproveSuggestion}
                    isUpvoted={upvotedIds.includes(suggestion.id)}
                    isAdmin={isAdmin}
                    isMyPost={isMyPost(suggestion)}
                  />
                ))}
              </div>
            </>
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
        onApproveSuggestion={handleApproveSuggestion}
        isAdmin={isAdmin}
        adminToken={adminToken}
        isUpvoted={selectedSuggestion ? upvotedIds.includes(selectedSuggestion.id) : false}
        isMyPost={selectedSuggestion ? isMyPost(selectedSuggestion) : false}
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
        adminToken={adminToken}
        onLoginAdmin={handleLoginAdmin}
        onLogoutAdmin={handleLogoutAdmin}
        onApproveSuggestion={handleApproveSuggestion}
        onDeleteSuggestion={handleDeleteSuggestion}
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

      {/* Custom In-App Delete Confirmation Modal (100% reliable in iframes & mobiles without window.confirm) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {deleteTarget.type === 'comment' ? '댓글 삭제 확인' : '건의글 삭제 확인'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    삭제 후에는 복구할 수 없습니다
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500 mb-1 font-medium">
                {deleteTarget.type === 'comment' ? '삭제 대상 댓글' : '삭제 대상 건의글'}
              </p>
              <p className="text-sm font-bold text-slate-800 break-words line-clamp-2">
                {deleteTarget.title}
              </p>
            </div>

            {/* Admin Delete Notice */}
            {deleteTarget.type === 'suggestion' && (
              <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold">학생회 관리자 전용 삭제</span>
                  <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                    선택하신 건의글은 관리자 권한으로 데이터베이스에서 즉시 영구 삭제 처리됩니다.
                  </p>
                </div>
              </div>
            )}

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteModal}
                disabled={deleteSubmitting}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 active:scale-98 transition-all flex items-center justify-center gap-1.5"
              >
                {deleteSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>삭제 중...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>삭제하기</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#F4F1EA] text-[#8C8479] text-xs py-8 border-t border-[#E6E2D3] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="font-bold text-[#2D2926]">
            마산삼진고등학교 익명 소통 플랫폼 • 삼진보이스 (Samjin Voice)
          </p>
          <p className="text-[11px] text-[#8C8479]">
            경상남도 창원시 마산합포구 진동면 • 제53대 삼진고등학교 학생회 운영
          </p>
          <p className="text-[10px] text-[#8C8479] pt-1">
            본 시스템은 학생의 익명성을 철저히 보호하며, 건설적이고 정중한 의견 제시 문화를 지향합니다.
          </p>
        </div>
      </footer>

    </div>
  );
}

