import { config } from '../config';

// Token storage interface
interface TokenStorage {
    [appId: string]: {
        token: string;
        expiresAt: number;
    }
}

// In-memory store (could be Redis in production)
const tokenStore: TokenStorage = {};
const TOKEN_VALIDITY_MS = 55 * 60 * 1000; // 55 minutes (buffer for 1 hour)

// Universal key for the handoff token (used when specific appId token is missing)
const UNIVERSAL_TOKEN_KEY = '__HANDOFF_TOKEN__';

export class PlatoTokenManager {

    /**
     * Manually sets the callback token (e.g., from initial handoff).
     * Stores under both the specific appId AND the universal key.
     */
    static setToken(appId: string, token: string) {
        const expiresAt = Date.now() + TOKEN_VALIDITY_MS;

        // Store under specific appId
        tokenStore[appId] = { token, expiresAt };

        // ALSO store under universal key so any appId can use it as fallback
        tokenStore[UNIVERSAL_TOKEN_KEY] = { token, expiresAt };

        console.log(`[TokenManager] Stored token for ${appId} (and universal fallback)`);
    }

    /**
     * Retrieves a valid callback token for the given App ID.
     * Falls back to universal handoff token if specific appId token is missing.
     * Does NOT try to regenerate via PLATO scraping (server-side fetch doesn't work).
     */
    static async getToken(appId: string): Promise<string> {
        // 1. Check specific appId token
        const cached = tokenStore[appId];
        if (cached && cached.expiresAt > Date.now()) {
            console.log(`[TokenManager] Using cached token for ${appId}`);
            return cached.token;
        }

        // 2. Fallback to universal handoff token
        const universal = tokenStore[UNIVERSAL_TOKEN_KEY];
        if (universal && universal.expiresAt > Date.now()) {
            console.log(`[TokenManager] Using universal handoff token for ${appId}`);
            // Cache it for this appId too
            tokenStore[appId] = { ...universal };
            return universal.token;
        }

        // 3. No valid token available
        console.error(`[TokenManager] No valid token found for ${appId}. User must re-authenticate.`);
        throw new Error(
            `Session token expired or missing for ${appId}. ` +
            `Please close and reopen the dashboard from FlexCube to re-authenticate.`
        );
    }

    /**
     * Checks if a valid token exists (without throwing)
     */
    static hasValidToken(appId?: string): boolean {
        if (appId) {
            const cached = tokenStore[appId];
            if (cached && cached.expiresAt > Date.now()) return true;
        }

        const universal = tokenStore[UNIVERSAL_TOKEN_KEY];
        return !!(universal && universal.expiresAt > Date.now());
    }

    /**
     * Gets all stored tokens (for debugging)
     */
    static debugTokens(): Record<string, { appId: string; expiresIn: number }> {
        const result: Record<string, { appId: string; expiresIn: number }> = {};
        const now = Date.now();

        for (const [appId, data] of Object.entries(tokenStore)) {
            result[appId] = {
                appId,
                expiresIn: Math.max(0, Math.round((data.expiresAt - now) / 1000 / 60)) // minutes
            };
        }

        return result;
    }

    /**
     * Clears all stored tokens (for logout/testing)
     */
    static clearTokens() {
        Object.keys(tokenStore).forEach(key => delete tokenStore[key]);
        console.log(`[TokenManager] All tokens cleared`);
    }

    /**
     * Clears only the JWT tokens (keys ending with _JWT), keeping the handoff token intact.
     * Used when session is invalidated by another OBBRN login.
     */
    static clearJwtTokens() {
        const keysToDelete = Object.keys(tokenStore).filter(key => key.endsWith('_JWT'));
        keysToDelete.forEach(key => delete tokenStore[key]);
        console.log(`[TokenManager] Cleared ${keysToDelete.length} JWT tokens, handoff token preserved`);
    }
}
