"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface User {
  id: number;
  username: string;
  email: string;
  // Add other user properties as needed
}

export function UserFetcher() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users");

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const userData = await response.json();
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={fetchUsers} disabled={loading}>
        {loading ? "Fetching..." : "Fetch Users"}
      </Button>

      {error && <div className="text-red-500">Error: {error}</div>}

      {users.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Users:</h3>
          <ul className="space-y-1">
            {users.map((user) => (
              <li key={user.id} className="p-2 border rounded">
                <strong>{user.username}</strong> - {user.email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
