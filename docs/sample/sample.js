// BluePad 샘플 JavaScript — 구문 강조 데모

const APP_NAME = "BluePad";
const VERSION = "1.12.3";
const features = ["markdown", "wysiwyg", "themes", "focus-mode"];

/**
 * 인사말을 생성한다.
 * @param {string} name 이름
 * @returns {string} 인사 문자열
 */
function greet(name = "World") {
  return `Hello, ${name}! Welcome to ${APP_NAME} v${VERSION}.`;
}

// 클래스 + 정적 메서드
class Counter {
  #count = 0;

  increment() {
    this.#count += 1;
    return this.#count;
  }

  reset() {
    this.#count = 0;
  }

  get value() {
    return this.#count;
  }

  static fromArray(arr) {
    const c = new Counter();
    arr.forEach(() => c.increment());
    return c;
  }
}

// 비동기 + 에러 처리
async function fetchUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("fetchUser failed:", error.message);
    return null;
  }
}

// 구조 분해 + 스프레드 + 화살표
const map = new Map([["a", 1], ["b", 2], ["c", 3]]);
const sum = [...map.values()].reduce((acc, v) => acc + v, 0);
const { length, ...rest } = features;

// 정규식
const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export { greet, Counter, fetchUser };
