'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface UserContextType {
    user: string | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    refreshUser: async () => { },
});

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                // Ensure we get a valid string or null
                setUser(data.user || null);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Failed to fetch user context:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    return (
        <UserContext.Provider value={{ user, loading, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => useContext(UserContext);
