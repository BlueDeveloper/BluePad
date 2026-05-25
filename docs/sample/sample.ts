// BluePad 샘플 TypeScript — 타입 시스템 데모

type Theme = "classic" | "dark" | "brp-blue" | "brp-red" | "brp-polarity";

interface User {
  readonly id: number;
  name: string;
  email?: string;
  preferences: {
    theme: Theme;
    fontSize: number;
    autoSave: boolean;
  };
}

type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// 제네릭 함수
function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// 유틸리티 타입
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type ThemeOnly = Pick<User["preferences"], "theme">;

// 클래스 + 접근 제어자
class LicenseManager {
  private readonly apiUrl: string;
  protected validated = false;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async validate(key: string, deviceId: string): Promise<Result<boolean>> {
    try {
      const res = await fetch(`${this.apiUrl}/validate`, {
        method: "POST",
        body: JSON.stringify({ license_key: key, device_id: deviceId }),
      });
      const data: { valid: boolean } = await res.json();
      this.validated = data.valid;
      return ok(data.valid);
    } catch (e) {
      return err(e as Error);
    }
  }
}

// 제네릭 + 조건부 타입
type ApiResponse<T> = T extends string ? { message: T } : { data: T };

// enum
enum Status {
  Pending = "pending",
  Active = "active",
  Refunded = "refunded",
}

const defaultUser: User = {
  id: 1,
  name: "BluePad User",
  preferences: { theme: "dark", fontSize: 15, autoSave: true },
};

export { LicenseManager, Status, defaultUser };
export type { User, Theme, Result, ApiResponse };
