/**
 * Hemingway 스타일 문장 분석 — 클라이언트사이드 통계.
 * 한국어/영어 혼합 텍스트에서 동작하도록 간단한 휴리스틱 사용.
 */

export interface ProseStats {
  sentences: number;
  avgSentenceLen: number;
  longSentences: number;   // 임계값 초과 문장 수
  passiveHits: number;     // 수동태/피동 추정 개수
  adverbHits: number;      // 부사 추정 개수
  fillerHits: number;      // 군더더기 단어 개수
  readability: number;     // 0~100 (높을수록 쉬움)
  longThreshold: number;   // 긴 문장 임계값
}

// 마크다운 마크업 제거 (간단)
function clean(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")             // 코드 블록 제외
    .replace(/`[^`]+`/g, "")                    // 인라인 코드 제외
    .replace(/\$\$[\s\S]*?\$\$/g, "")           // 수식 제외
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")        // 이미지 제외
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")     // 링크 텍스트만
    .replace(/^---\n[\s\S]*?\n---/m, "")         // front matter
    .replace(/[#*_~>|\-=]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  // 한국어 종결 부호("다.", "요.", "?", "!") + 영어 문장 끝 부호
  // 단순화: . ? ! 다음에 공백 또는 끝
  const parts = text.split(/(?<=[.!?。！？])\s+/);
  return parts.map((s) => s.trim()).filter((s) => s.length >= 2);
}

function countWords(s: string): number {
  if (!s) return 0;
  // 한국어는 공백 단위, 영어도 공백 단위 — 어절 기준
  return s.split(/\s+/).filter(Boolean).length;
}

function countSyllables(word: string): number {
  // 영어 음절 추정 (모음군 + 묵음 e 제외). 한국어는 글자 단위로 1음절씩.
  const hangul = (word.match(/[가-힯]/g) || []).length;
  if (hangul > 0) return hangul;
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  w = w.replace(/e$/, "");
  const m = w.match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
}

// 한국어 피동 추정: "되다/지다/받다" 형태 어미 + 영어 be + p.p. 일부
const PASSIVE_KO = /(되었다|되어|되었|돼졌|받았|받게|졌다|졌고|졌다는|당했|당하)/g;
const PASSIVE_EN = /\b(?:is|are|was|were|be|been|being|am)\s+\w+(?:ed|en)\b/gi;

// 한국어 부사 추정: "~게", "~히", "매우", "정말", "너무", "아주", "굉장히"
const ADVERB_KO = /([가-힣]+게\b|[가-힣]+히\b|매우|정말|너무|아주|굉장히|상당히|꽤|약간|살짝)/g;
const ADVERB_EN = /\b\w+ly\b/gi;

// 군더더기 단어 (한국어/영어)
const FILLER = /(어쨌든|아무튼|사실|솔직히|기본적으로|결국|그냥|그래서|뭐|음|아|어|에|just|very|really|actually|basically|literally|simply)\b/gi;

export function analyzeProse(text: string): ProseStats {
  const cleaned = clean(text);
  if (!cleaned) {
    return {
      sentences: 0, avgSentenceLen: 0, longSentences: 0,
      passiveHits: 0, adverbHits: 0, fillerHits: 0,
      readability: 0, longThreshold: 25,
    };
  }
  const sentences = splitSentences(cleaned);
  const sentenceCount = sentences.length;
  if (sentenceCount === 0) {
    return {
      sentences: 0, avgSentenceLen: 0, longSentences: 0,
      passiveHits: 0, adverbHits: 0, fillerHits: 0,
      readability: 0, longThreshold: 25,
    };
  }
  const totalWords = countWords(cleaned);
  const avg = totalWords / sentenceCount;
  const longThreshold = 25; // 어절/단어 25개 초과 = 너무 김
  const longSentences = sentences.filter((s) => countWords(s) > longThreshold).length;

  const passiveHits = ((cleaned.match(PASSIVE_KO) || []).length) + ((cleaned.match(PASSIVE_EN) || []).length);
  const adverbHits = ((cleaned.match(ADVERB_KO) || []).length) + ((cleaned.match(ADVERB_EN) || []).length);
  const fillerHits = (cleaned.match(FILLER) || []).length;

  // Flesch Reading Ease — 영어 기준 공식이지만 한국어 음절 카운트로 근사
  let syllableTotal = 0;
  for (const s of sentences) {
    for (const w of s.split(/\s+/)) syllableTotal += countSyllables(w);
  }
  const wordsPerSentence = totalWords / sentenceCount;
  const syllablesPerWord = totalWords > 0 ? syllableTotal / totalWords : 0;
  const readabilityRaw = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const readability = Math.max(0, Math.min(100, readabilityRaw));

  return {
    sentences: sentenceCount,
    avgSentenceLen: Math.round(avg * 10) / 10,
    longSentences,
    passiveHits,
    adverbHits,
    fillerHits,
    readability: Math.round(readability),
    longThreshold,
  };
}
