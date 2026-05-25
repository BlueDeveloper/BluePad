// BluePad 샘플 React + TypeScript 컴포넌트

import { useState, useEffect, useCallback } from "react";

interface CounterProps {
  initial?: number;
  step?: number;
  onChange?: (value: number) => void;
}

export function Counter({ initial = 0, step = 1, onChange }: CounterProps) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    onChange?.(count);
  }, [count, onChange]);

  const increment = useCallback(() => setCount((c) => c + step), [step]);
  const decrement = useCallback(() => setCount((c) => c - step), [step]);
  const reset = useCallback(() => setCount(initial), [initial]);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <div className="controls">
        <button onClick={decrement} disabled={count <= 0}>−</button>
        <button onClick={reset}>Reset</button>
        <button onClick={increment}>+</button>
      </div>
      {count > 10 && <p className="warning">⚠️ 카운트가 10을 초과했습니다.</p>}
    </div>
  );
}

interface User {
  id: number;
  name: string;
  active: boolean;
}

interface UserListProps {
  users: User[];
  onSelect: (user: User) => void;
}

export function UserList({ users, onSelect }: UserListProps) {
  if (users.length === 0) {
    return <div className="empty">사용자가 없습니다.</div>;
  }

  return (
    <ul className="user-list">
      {users.map((user) => (
        <li
          key={user.id}
          className={user.active ? "active" : "inactive"}
          onClick={() => onSelect(user)}
        >
          <span className="name">{user.name}</span>
          <span className="status">{user.active ? "🟢" : "⚪"}</span>
        </li>
      ))}
    </ul>
  );
}
