import { Suggestion, Notice, LunchMenu } from '../types';

export const INITIAL_NOTICES: Notice[] = [
  {
    id: 'n1',
    title: '📢 [학생회] 2026학년도 2학기 삼진소통함 운영 안내 및 건의사항 반영 결과',
    content: '학우 여러분 안녕하세요! 제53대 마산삼진고등학교 학생회입니다. 학생 여러분의 소중한 의견을 모아 학교 당국에 전달하고 실질적인 개선을 이루어내기 위해 익명 건의 시스템을 정식 가동합니다.',
    author: '제53대 삼진고 학생회',
    date: '2026.08.10',
    isImportant: true,
  },
  {
    id: 'n2',
    title: '🍱 [급식실] 자율배식대 잔반 줄이기 캠페인 및 선호 메뉴 반영 안내',
    content: '학생들의 건의로 매주 수요일 "잔반 없는 날" 후식 프리미엄 화요/수요 특식이 제공되며, 자율배식대 양념치킨 및 샐러드 코너가 확장 운영됩니다.',
    author: '급식관리실',
    date: '2026.08.08',
  },
  {
    id: 'n3',
    title: '🏫 [행정실] 도서관 자율학습실 환경 개선 안내',
    content: '학생들의 건의사항에 따라 도서관 자습실 의자 전체를 저소음 인체공학 의자로 교체 완료하였습니다.',
    author: '삼진고 행정실',
    date: '2026.08.05',
  },
];

export const INITIAL_SUGGESTIONS: Suggestion[] = [
  {
    id: 'sug-default-1',
    category: 'FACILITY',
    title: '체육관 인근 자원재활용 쓰레기통 추가 설치 및 분리수거함 교체 요청',
    content: '체육 수업 후나 점심시간 스포츠 활동 이후 음료수 캔과 페트병이 많이 배출되는데 체육관 주변 분리수거함 용량이 부족합니다. 분리수거함을 확대 설치해주시면 감사하겠습니다.',
    authorNickname: '열정적인 스포츠왕',
    isSecret: false,
    status: 'IN_REVIEW',
    upvotes: 18,
    tags: ['#체육관', '#시설개선', '#분리수거'],
    comments: [
      {
        id: 'c1',
        authorNickname: '성실한 동아리부장',
        content: '적극 동의합니다! 체육관 이용 후 쓰레기 처리가 훨씬 편해질 것 같아요.',
        createdAt: '2026-08-11T10:30:00Z',
        isOfficial: false,
      }
    ],
    officialResponse: {
      authorName: '학생회장',
      department: '제53대 삼진고 학생회',
      content: '행정실 및 학생안전부에 해당 건의를 전달하였으며, 다음 주 수요일 체육관 측면에 신형 분리수거함 2세트 추가 배치가 확정되었습니다.',
      updatedAt: '2026-08-12T08:00:00Z',
      status: 'IN_REVIEW',
    },
    createdAt: '2026-08-11T09:00:00Z',
    updatedAt: '2026-08-12T08:00:00Z',
  },
  {
    id: 'sug-default-2',
    category: 'MEALS',
    title: '급식 자율배식대 샐러드 드레싱 종류 다양화 건의',
    content: '매주 수요일 자율배식대 샐러드 코너에서 제공되는 드레싱 종류를 오리엔탈 외에 참깨나 발사믹 등으로 주차별 변경해 주실 수 있는지 궁금합니다!',
    authorNickname: '급식먹는 독수리',
    isSecret: false,
    status: 'ANSWERED',
    upvotes: 24,
    tags: ['#급식실', '#자율배식', '#샐러드'],
    comments: [],
    officialResponse: {
      authorName: '급식관리실',
      department: '삼진고 급식실',
      content: '학생들의 건강한 식단을 위해 8월 3주차부터 매주 수요일 자율배식대에 2가지 종류(참깨/유자)의 드레싱을 번갈아 제공하기로 결정했습니다.',
      updatedAt: '2026-08-10T14:20:00Z',
      status: 'ANSWERED',
    },
    createdAt: '2026-08-10T11:15:00Z',
    updatedAt: '2026-08-10T14:20:00Z',
  }
];

export const TODAY_LUNCH: LunchMenu = {
  date: '2026년 8월 11일 (화요일)',
  menuItems: [
    '발아현미밥',
    '얼큰한 한우소고기국',
    '수제 마늘간장 닭강정',
    '콘치즈 샐러드',
    '배추김치',
    '시원한 수박 에이드'
  ],
  kcal: '782 kcal',
  infoNotice: '※ 8/12(수) 수요일 특식: 수제 찹쌀 탕수육 & 짜장밥 유기농 수박 샤베트 제공 예정!'
};

export const NICKNAME_ADJECTIVES = [
  '슬기로운', '열정적인', '열공하는', '자습하는', '급식먹는', '시험기간인', '매점달려가는', 
  '꿈을향한', '도서관지킴이', '체육관인기인', '축제준비하는', '동아리열심인', '친절한', 
  '달려가는', '성실한', '명랑한', '창의적인', '당당한', '웃음많은', '상큼한', '파이팅넘치는', 
  '부지런한', '선도부눈피하는', '쉬는시간숙제하는', '야자때열공하는', '아침자습하는', 
  '체육대회유니폼입은', '수능대박날', '학습플래너적는', '수업집중하는', '쉬는시간알차게쓰는', 
  '노트필기잘하는', '마산삼진고', '마산합포', '조용한', '씩씩한', '엉뚱한', '다정한', 
  '유쾌한', '솔직한', '따뜻한', '빛나는', '자유로운', '겸손한', '재치있는', '기분좋은', 
  '긍정적인', '에너지넘치는', '호기심많은', '감성적인', '섬세한', '도전하는', '스마트한', '용감한'
];

export const NICKNAME_NOUNS = [
  '사자', '부엉이', '독수리', '올빼미', '호랑이', '곰돌이', '토끼', '고양이', '강아지', 
  '다람쥐', '펭귄', '판다', '쿼카', '알파카', '해달', '사막여우', '하늘다람쥐', '물개',
  '선배님', '후배님', '축구왕', '농구천재', '모범생', '마스코트', '삼진인', '꿈나무', 
  '반장님', '부반장', '동아리부장', '방송부원', '밴드부기타', '체육부장', '매점소통왕', 
  '급식순번1등', '자습실파수꾼', '필기요정', '쉬는시간댄서', '수학천재', '영어능력자', 
  '국어수재', '과학실험왕', '음악천재', '미술작가', '학교생활마스터', '마산의자랑'
];

export const getRandomAnonymousNickname = (): string => {
  const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
  return `${adj} ${noun}`;
};

export const RANDOM_ANONYMOUS_NICKNAMES = [
  '슬기로운 사자',
  '자습하는 부엉이',
  '열정적인 독수리',
  '급식먹는 올빼미',
  '마산삼진고 삼진인',
  '도서관지킴이 모범생',
  '체육관인기인 농구천재',
  '축제준비하는 마스코트',
  '꿈을향한 꿈나무',
  '다정한 선배님'
];
