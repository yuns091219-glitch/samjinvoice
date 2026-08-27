/**
 * Profanity & Abuse Filter for Samjin Voice (삼진보이스)
 * Filters Korean & English curses, slurs, harassment words, and spaced evasion patterns
 * Replaces detected profanity with '*' characters matching the exact character count.
 * 
 * Includes comprehensive whitelist protection so that ordinary academic, calendar,
 * and everyday Korean words (e.g. 1학년, 2학년, 3학년, 2026년, 내년, 작년, 개선, 질문, 보지 마세요)
 * are NEVER falsely flagged or censored.
 */

// Special pattern for slang/intensifier prefix '개' (only the character '개' is masked as '*')
// Strictly guards against normal words like 개선, 개발, 개인, 개학, 개수, 1개 등
export const PREFIX_GAE_PATTERN = /(개)([\s._\-~*!@#$%^&]*(?:같[다네은이음아어]|멍청|빡[치쳐친네음]?|짜증|노답|쓰레기|극혐|역겹|더럽|망[함했한네]?|오바|오버|쌉))/gi;

// Safe patterns that must ALWAYS be protected and preserved intact
export const SAFE_WHITELIST_PATTERNS: RegExp[] = [
  // 1. School Grades & Classes (학년, 학급, 반)
  /[0-9가-힣]*[0-9]+학년[0-9가-힣]*/g,
  /(?:저학년|고학년|동학년|타학년|전학년|학년도|학년별|학년실|학년부|학급|재학생|신입생|졸업생)/g,

  // 2. Calendar Years & Dates (2024년, 2025년, 2026년, 10년, 내년, 작년, 올해, 기념일 등)
  /[0-9]+년(?:도|생|차|간|대)?/g,
  /(?:작년|내년|올해|금년|재작년|매년|신년|송년|송년회|정년|만년|백년|천년|광년|윤년|평년|수년|동년배|몇\s*년|주년|창립기념일?|개교기념일?|기념일?|기념품|기념비|기념)/g,
  /(?:청소년|유소년|유년|소년|소녀|청년|중년|장년|노년|남녀노소|소년소녀)/g,

  // 3. Common False-Positive "시발" words (시발점 = origin/starting point)
  /(?:시발점|시발역|시발지|시발\s*자동차|시발유)/g,

  // 4. Common False-Positive "새끼" words (innocent animal/anatomy terms)
  /(?:새끼손가락|새끼발가락|새끼손톱|새끼발톱|새끼고양이|새끼강아지|새끼돼지|새끼새|새끼곰|새끼사자|새끼호랑이)/g,

  // 5. Korean Verbs containing "보지" (from verb '보다' = to see, look)
  /(?:보지\s*(?:마|않|말|못|만|도|요|대|는|든|야|라|자)|돌보지|후보지|정보지|돋보지|바라보지|돌보지\s*않|내다보지|쳐다보지|들여다보지)/g,

  // 6. Korean Verbs containing "자지" (from verb '자지러지다' = swoon, laugh loudly)
  /(?:자지러지[다네은는어면고서])/g,

  // 7. Common False-Positive "개" words (개선, 개발, 개인, 개수, 1개 등)
  /(?:개[선혁발학강교인방최념요정편시관업별성화수조과]|\d+\s*개|몇\s*개|여러\s*개|낱개|각개|안개|지우개|날개|찌개|조개|솔개|번개|무지개|가게|시계)/g,

  // 8. Common False-Positive "질" words (질문, 화질, 품질, 물질 등)
  /(?:질[문의서환병감량적우]|화질|품질|음질|물질|본질|성질|단백질|탄수화물|칼슘|기질|동질|이질|변질|질려|질색)/g,

  // 9. Common False-Positive "엿" words (엿보다, 호박엿 등)
  /(?:엿보기|엿보다|엿보|호박엿|찹쌀엿|가락엿|엿기름)/g,

  // 10. Normal Food, Science & School words
  /(?:족발|소시지|소세지|양념|불닭|된장찌개|김치찌개|김치볶음|된장국|홍어회|홍어무침|홍어전|자폐증|장애인|자원봉사)/g,
];

// List of profanity keywords and regex patterns
export const PROFANITY_PATTERNS: RegExp[] = [
  // 시발 / 씨발 계열 및 변형 (자음, 영타, 특수문자 변형 포함)
  /[씨시싀쒸ㅆㅅ][\s._\-~*!@#$%^&]*[발바팔뱔벌빨뻘]/gi,
  /\b(tlqkf|tlqk|씨바|시바|시팔|씨팔|십알|싀발|쒸발|ㅆ1발|시1발|씨1발|ㅅ1ㅂ|ㅆㅂ|ㅅㅂ|ㅅ발|ㅆ발|씨빨|씨뻘|시벌|쉬발|씨이빨|씨빠알|시ㅣ+발)\b/gi,
  /(?<![가-힣0-9])(ㅆㅂ|ㅅㅂ|ㅅ발|ㅆ발|시1발|씨1발|쉬발|시벌|씨빨|씨뻘|시바|씨바|씨이빨|씨빠알)(?![가-힣0-9])/gi,

  // 씹 계열 (씹창, 씹새, 씹련, 씹덕, 씹자식 등)
  /[씹씝][\s._\-~*!@#$%^&]*[창새키자벌련년덕놈충질]/gi,
  /(?<![가-힣0-9])(씹|씹질|씹련|씹창|씹새|씹새끼|씹자식|씹덕|씹치)(?![가-힣0-9])/gi,

  // 개새끼 / 새끼 / 개자식 계열 (전체 욕설)
  /[개개새색상세샛][\s._\-~*!@#$%^&]*[새색상세샛][\s._\-~*!@#$%^&]*[끼키기히]/gi,
  /[개][\s._\-~*!@#$%^&]*[자년놈련뇬돼지랄]/gi,
  /(?<![가-힣0-9])(새끼|쌔끼|새키|새기|샛기|ㄳㄲ|ㅅㄲ|rotoxrl)(?![가-힣0-9])/gi,
  /(?<![가-힣0-9])(개새|개년|개놈|개자식|호로새끼|호로자식|개지랄|개돼지)(?![가-힣0-9])/gi,

  // 병신 / 등신 계열
  /[병븅븡빙ㅂ비][\s._\-~*!@#$%^&]*[신씬ㅅ융]/gi,
  /(?<![가-힣0-9])(병신|븅신|비융신|ㅂㅅ|qudtls|ㅂ1ㅅ|등신|븡신|빙신)(?![가-힣0-9])/gi,
  /ㅄ+/gi,

  // 조까 / 좆까 계열
  /(?<![가-힣0-9])(조까|ㅈ까|좆까|좃까|졷까)(?![가-힣0-9])/gi,

  // 지랄 계열
  /[지즤쥐ㅈ][\s._\-~*!@#$%^&]*[랄럴ㄹ]/gi,
  /(?<![가-힣0-9])(지랄|즤랄|ㅈㄹ|wlfkf|지1랄|육시랄)(?![가-힣0-9])/gi,

  // 닥쳐 / 꺼져 계열
  /[닥닧ㄷ][\s._\-~*!@#$%^&]*[쳐처ㅊ]/gi,
  /[꺼꼬ㄲ][\s._\-~*!@#$%^&]*[져저ㅈ]/gi,
  /(?<![가-힣0-9])(닥쳐|닥처|ㄷㅊ|꺼져|꺼저|ㄲㅈ|ekrcu)(?![가-힣0-9])/gi,

  // 존나 / 좆 / 졷 / 좃 계열
  /[존줜졸ㅈ][\s._\-~*!@#$%^&]*[나내][\s._\-~*!@#$%^&]*/gi,
  /[좆좃좇졷ㅈ][\s._\-~*!@#$%^&]*[같밥까망나내부집]/gi,
  /(?<![가-힣0-9])(존나|ㅈㄴ|줜나|존내|존빡|개빡|whssk|좆|좃|좇|졷|좆같네|좆같다|좆집|좆밥|좃밥|좆망)(?![가-힣0-9])/gi,

  // 미친 / 모욕 복합 계열 (미친년, 미친놈, 미친새끼, 걸레년 등)
  /(미친|걸레|썅|쌍|씨발|시발|화냥|창|개|호로)[\s._\-~*]*(년|놈|련|뇬|새끼)/gi,
  /미[\s._\-~*!@#$%^&]*[친췬][\s._\-~*!@#$%^&]*[놈년새기자애]?/gi,

  // 패륜 / 비하 / 가족 비하 계열
  /(?<![가-힣0-9])(애미|애1미|애비|애1비|앰창|엠창|앰생|엠생|고아|느금|느금마|느검마|느금빠|니애미|니애비|느앰|느앱|노앰|노앱|늑억맘|호로새끼|호로자식|또라이|염병|호빠|화냥년|매춘부|색골)(?![가-힣0-9])/gi,

  // 극단 혐오 / 모욕 밈 계열
  /(?<![가-힣0-9])(노무현|shangus|노짱|노무통|노통령|운지|이기야|노무노무|MC무현|노알라|야기분좋다|전라케라톱스|좌빨|슨상님|김치녀|된장녀|한남|메갈|통구이|재기해|북딱|북따닥따닥따닥|흔드르)(?![가-힣0-9])/gi,

  // 신체 / 성적 / 성인 관련 계열
  /(?<![가-힣0-9])(보지살|보빨|자빨|부랄|꼬추|유두|유륜|후장|항문자위|딸딸이|자위|정액|애액|클리토리스|애널|젖탱이|가슴\s*빨다|따먹다|몸을\s*팔다|몸팔이)(?![가-힣0-9])/gi,
  /(?<![가-힣0-9])(섹스|야스|섹1스|폰섹|섹스머신|꼴리다|펠라|펠라치오|아헤가오|헤으응|응기잇|갱뱅|스와핑|원나잇|오나홀|콘돔|파이즈리|쓰리썸|리얼돌|딜도|후배위|정상위|기승위|러브젤)(?![가-힣0-9])/gi,

  // 혐오 / 비하 / 장애인 비하 / 모욕 계열 (단독 년/놈/련/개/질 제외, 명확한 비하어만 포함)
  /(?<![가-힣0-9])(한남충|맘충|틀딱|급식충|똥꼬충|짱깨|짱꼴라|쪽발이|쪽바리|왜놈|저능아|계집|창녀|창놈|걸레년|걸레놈|썅년|썅놈|쌍년|쌍놈|엿먹어|엿처먹어)(?![가-힣0-9])/gi,

  // 영어 욕설 (English Profanity)
  /\b(fuck|fucking|fucker|fck|fuk|shit|shitty|bitch|bastard|asshole|cunt|dick|dickhead|pussy|motherfucker|motherfucking|wtf|dumbass|bullshit|retard|nigger|nigga)\b/gi,
  /f[\s._\-~*]*u[\s._\-~*]*c[\s._\-~*]*k/gi,
  /s[\s._\-~*]*h[\s._\-~*]*i[\s._\-~*]*t/gi,
  /b[\s._\-~*]*i[\s._\-~*]*t[\s._\-~*]*c[\s._\-~*]*h/gi,
];

// Direct standalone bad word dictionary for high precision lookup (sorted longest first)
// IMPORTANT: Single ambiguous characters like '년', '놈', '련', '개', '질', '엿' are strictly excluded
// to prevent false positives like '2학년', '2026년', '개선', '질문', '엿보다'.
export const BAD_WORDS: string[] = [
  '북따닥따닥따닥', '전라케라톱스', 'motherfucking', 'motherfucker',
  '클리토리스', '야기분좋다', '항문자위', '섹스머신', '호로새끼', '호로자식',
  '개새끼', '개색기', '개색히', 'rotoxrl', '걸레년', '걸레놈', '미친새끼', '미친놈', '미친년', '미친련', '미친뇬',
  '씨발놈', '씨발년', '시발놈', '시발년', '화냥년', '매춘부', '펠라치오', '아헤가오',
  '파이즈리', '흔들어라', '노무노무', '김치녀', '된장녀', '한남충', '급식충', '똥꼬충',
  '쪽발이', '쪽바리', 'fucking', 'fucker', 'shitty', 'bastard', 'asshole', 'dickhead', 'dumbass', 'bullshit',
  'qudtls', 'wlfkf', 'tlqkf', 'tlqk', 'shangus', 'MC무현', '노알라', '슨상님', '통구이', '재기해',
  '비융신', '시1발', '씨1발', '씨이빨', '씨빠알', '시ㅣ발', '딸딸이', '젖탱이', '보지살', '스와핑', '원나잇',
  '오나홀', '쓰리썸', '리얼돌', '후배위', '정상위', '기승위', '러브젤', '가슴 빨다', '몸을 팔다',
  '개자식', '개지랄', '개돼지', '느금마', '느검마', '느금빠', '니애미', '니애비', '늑억맘',
  '씨발', '시발', 'ㅅ발', 'ㅆ발', '씨빨', '씨뻘', '시벌', '쉬발', '시바', '씨바', '시팔', '씨팔', '십알', '싀발', '쒸발',
  '새끼', '쌔끼', '새키', '새기', '샛기', '개새', '개년', '개놈', 'ㄳㄲ', 'ㅅㄲ',
  '병신', '븅신', 'ㅂㅅ', 'ㅂ1ㅅ', '등신', '븡신', '빙신', 'ㅄ',
  '지랄', 'ㅈㄹ', '즤랄', '육시랄',
  '미친', '꺼져', '꺼저', 'ㄲㅈ', '닥쳐', '닥처', 'ㄷㅊ', 'ㅁㅊ',
  '존나', 'ㅈㄴ', '졸라', '줜나', '존내', '존빡',
  '좆같네', '좆같다', '좆같', '좃같', '좆까', '좃까', '졷까', '조까', 'ㅈ까', '좆밥', '좃밥', '좆망', '좆집', '씹질', '씹련', '씹창', '씹새', '씹덕',
  '느금', '느앰', '느앱', '노앰', '노앱', '애미', '애1미', '애비', '애1비', '엠창', '앰창', '엠생', '앰생', '고아',
  '노무현', '노짱', '노무통', '노통령', '운지', '이기야', '홍어무침이아닌홍어비하', '좌빨', '한남', '메갈',
  '창녀', '창놈', '썅년', '썅놈', '쌍년', '쌍놈', '부랄', '꼬추', '유두', '유륜', '후장',
  '자위', '정액', '애액', '애널', '섹스', '야스', '섹1스', '폰섹', '꼴리다', '펠라', '헤으응', '응기잇',
  '갱뱅', '콘돔', '몸팔이', '딜도', '북딱', '흔드르', '계집', '저능아', '보빨', '자빨', '따먹다', '또라이',
  '염병', '호빠', '색골', '한녀', '맘충', '틀딱', '짱깨', '엿먹어', '엿처먹어',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'wtf'
].sort((a, b) => b.length - a.length);

/**
 * Protect safe words before profanity analysis
 */
function protectSafeTokens(text: string): { safeText: string; tokenMap: Map<string, string> } {
  let safeText = text;
  const tokenMap = new Map<string, string>();
  let tokenCounter = 0;

  for (const pattern of SAFE_WHITELIST_PATTERNS) {
    pattern.lastIndex = 0;
    safeText = safeText.replace(pattern, (matched) => {
      const placeholder = `\uE000SAFE_${tokenCounter++}\uE000`;
      tokenMap.set(placeholder, matched);
      return placeholder;
    });
  }

  return { safeText, tokenMap };
}

/**
 * Restore protected safe words after profanity analysis
 */
function restoreSafeTokens(text: string, tokenMap: Map<string, string>): string {
  let restored = text;
  for (const [placeholder, original] of tokenMap.entries()) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

/**
 * Check if the text contains any profanity or abusive words
 */
export function containsProfanity(text?: string | null): boolean {
  if (!text || typeof text !== 'string') return false;
  const target = text.trim();
  if (!target) return false;

  // Protect safe academic/calendar/everyday phrases first
  const { safeText } = protectSafeTokens(target);

  PREFIX_GAE_PATTERN.lastIndex = 0;
  if (PREFIX_GAE_PATTERN.test(safeText)) {
    return true;
  }

  for (const pattern of PROFANITY_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(safeText)) {
      return true;
    }
  }

  // Also check normalized spaced words on the protected text
  const normalized = safeText.replace(/[\s._\-~*!@#$%^&]/g, '').toLowerCase();
  for (const word of BAD_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Mask any detected profanity in the text with '*' matching the exact length of the matched word.
 * Whitelisted phrases (e.g. 2학년, 3학년, 2026년, 내년, 개선, 질문 등) remain 100% untouched.
 */
export function maskProfanity(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';

  // 1. Protect safe whitelist tokens
  const { safeText, tokenMap } = protectSafeTokens(text);
  let filtered = safeText;

  // 2. Mask slang prefix '개' when attached to slang descriptors
  PREFIX_GAE_PATTERN.lastIndex = 0;
  filtered = filtered.replace(PREFIX_GAE_PATTERN, (_match, _gae, rest) => '*' + rest);

  // 3. Apply regex pattern replacements with matching character count
  for (const pattern of PROFANITY_PATTERNS) {
    pattern.lastIndex = 0;
    filtered = filtered.replace(pattern, (match) => {
      // If the match contains our placeholder, skip masking placeholder
      if (match.includes('\uE000SAFE_')) return match;
      return '*'.repeat(match.length);
    });
  }

  // 4. Exact word search for edge cases with matching character count
  for (const word of BAD_WORDS) {
    if (word.length >= 2) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(escaped, 'gi');
      filtered = filtered.replace(reg, (match) => {
        if (match.includes('\uE000SAFE_')) return match;
        return '*'.repeat(match.length);
      });
    }
  }

  // 5. Restore safe whitelist tokens perfectly
  return restoreSafeTokens(filtered, tokenMap);
}

/**
 * Mask an array of string tags
 */
export function maskProfanityInTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => maskProfanity(t));
}

/**
 * Comprehensive analysis of text returning masked version and detection info
 */
export function analyzeProfanity(text?: string | null): {
  hasProfanity: boolean;
  maskedText: string;
  originalText: string;
} {
  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, maskedText: '', originalText: '' };
  }
  const originalText = text;
  const hasProfanity = containsProfanity(originalText);
  const maskedText = hasProfanity ? maskProfanity(originalText) : originalText;

  return {
    hasProfanity,
    maskedText,
    originalText,
  };
}

