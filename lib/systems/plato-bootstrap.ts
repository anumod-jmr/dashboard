/**
 * Plato API Gateway Bootstrap Module
 * 
 * This module handles the mandatory authentication bootstrap call to the Plato API Gateway.
 * OBBRN performs this call before any secured API calls - we must do the same.
 * 
 * The bootstrap call POST /api-gateway/platojwtauth initializes the JWT security context
 * for the current session, allowing subsequent API calls to succeed.
 */

import { config } from '../config';
import { PlatoTokenManager } from './token-manager';

// Track bootstrap state per appId to avoid redundant calls
const bootstrapState: Record<string, {
    initialized: boolean;
    initPromise: Promise<void> | null;
    lastInitTime: number;
}> = {};

// Bootstrap validity duration (55 minutes - same as token)
const BOOTSTRAP_VALIDITY_MS = 55 * 60 * 1000;

interface BootstrapOptions {
    appId: string;
    branchCode: string;
    userId: string;
    entityId?: string;
    sourceCode?: string;
    multiEntityAdmin?: string;
}

/**
 * Performs the Plato API Gateway bootstrap/authentication call.
 * This MUST be called before any secured API Gateway endpoints.
 * 
 * The call initializes the JWT security context for the session.
 */
export async function ensurePlatoBootstrap(options: BootstrapOptions): Promise<void> {
    const { appId, branchCode, userId, entityId, sourceCode, multiEntityAdmin } = options;

    // Check if already bootstrapped and still valid
    const state = bootstrapState[appId];
    if (state?.initialized && (Date.now() - state.lastInitTime) < BOOTSTRAP_VALIDITY_MS) {
        console.log(`[PlatoBootstrap] Already initialized for ${appId}, skipping...`);
        return;
    }

    // If bootstrap is in progress, wait for it
    if (state?.initPromise) {
        console.log(`[PlatoBootstrap] Bootstrap in progress for ${appId}, waiting...`);
        return state.initPromise;
    }

    // Start bootstrap
    console.log(`[PlatoBootstrap] Initializing API Gateway session for ${appId}...`);

    const initPromise = performBootstrap(options);

    bootstrapState[appId] = {
        initialized: false,
        initPromise,
        lastInitTime: 0
    };

    try {
        await initPromise;
        bootstrapState[appId] = {
            initialized: true,
            initPromise: null,
            lastInitTime: Date.now()
        };
        console.log(`[PlatoBootstrap] Successfully initialized for ${appId}`);
    } catch (error) {
        bootstrapState[appId] = {
            initialized: false,
            initPromise: null,
            lastInitTime: 0
        };
        console.error(`[PlatoBootstrap] Failed for ${appId}:`, error);
        throw error;
    }
}

async function performBootstrap(options: BootstrapOptions): Promise<void> {
    const { appId, branchCode, userId, entityId, sourceCode, multiEntityAdmin } = options;

    // 1. Get the callBackToken dynamically (NOT hardcoded)
    const callBackToken = await PlatoTokenManager.getToken(appId);

    if (!callBackToken) {
        throw new Error(`[PlatoBootstrap] No callBackToken available for ${appId}. User may need to re-authenticate.`);
    }

    // 2. Construct the bootstrap URL
    // Use the auth URL from config, or construct from base URL
    const bootstrapUrl = config.obbrn.authUrl || `${getApiGatewayBase()}/platojwtauth`;

    console.log(`[PlatoBootstrap] Calling ${bootstrapUrl}`);

    // 3. Allow self-signed certificates
    if (config.general.nodeTlsRejectUnauthorized === '0') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // 4. Perform the bootstrap POST call with OBBRN-style headers
    const response = await fetch(bootstrapUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'appId': appId,
            'branchCode': branchCode || '000',
            'callBackToken': callBackToken,
            'sourceCode': sourceCode || config.obbrn.sourceCode || 'FCUBS',
            'userId': userId || config.obbrn.defaultUser || '',
            'entityId': entityId || config.obbrn.entityId || 'DEFAULTENTITY',
            'multiEntityAdmin': multiEntityAdmin || 'N',
        },
        // Empty body - the headers carry the auth context
        body: JSON.stringify({})
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        throw new Error(`[PlatoBootstrap] Failed with status ${response.status}: ${errorText}`);
    }

    // Parse response to extract any tokens or session info
    try {
        const data = await response.json();
        console.log(`[PlatoBootstrap] Response:`, JSON.stringify(data).substring(0, 200));

        // IMPORTANT: Do NOT overwrite the original callBackToken with the JWT!
        // The bootstrap JWT is for session context only.
        // Downstream API calls still need the original callBackToken.
        if (data.access_token || data.token || data.jwt) {
            const jwtToken = data.access_token || data.token || data.jwt;
            // Store the JWT under a SEPARATE key (appId + "_JWT") for future reference if needed
            PlatoTokenManager.setToken(appId + '_JWT', jwtToken);
            console.log(`[PlatoBootstrap] Stored JWT session token (separate from callBackToken)`);
        }
    } catch {
        // Response might not be JSON - that's okay for a bootstrap call
        console.log(`[PlatoBootstrap] Response was not JSON (expected for some endpoints)`);
    }
}

/**
 * Helper to extract API Gateway base URL from config
 */
function getApiGatewayBase(): string {
    // Try to extract from ejLogUrl or approveUrl
    const ejLogUrl = config.obbrn.ejLogUrl || '';
    const match = ejLogUrl.match(/(https?:\/\/[^/]+\/api-gateway)/);
    if (match) {
        return match[1];
    }

    // Fallback - this should be configured
    return 'https://10.64.90.35:8112/api-gateway';
}

/**
 * Resets bootstrap state (useful for testing or forced re-auth)
 */
export function resetBootstrapState(appId?: string): void {
    if (appId) {
        delete bootstrapState[appId];
    } else {
        Object.keys(bootstrapState).forEach(key => delete bootstrapState[key]);
    }
    console.log(`[PlatoBootstrap] State reset for ${appId || 'all'}`);
}

/**
 * Refreshes the JWT token when session has been invalidated.
 * This is what OBBRN calls when user clicks "Proceed" on "User Already Logged In" dialog.
 * 
 * Endpoint: GET /api-gateway/platojwtauthrefresh/
 * Requires both the old JWT (in Authorization header) and the callBackToken
 * Returns a new valid JWT token
 */
export async function refreshPlatoJwt(options: {
    appId: string;
    branchCode: string;
    userId: string;
    entityId?: string;
    sourceCode?: string;
}): Promise<string | null> {
    const { appId, branchCode, userId, entityId, sourceCode } = options;

    console.log(`[PlatoBootstrap] Refreshing JWT for ${appId}...`);

    try {
        // 1. Get the existing callBackToken (original handoff token)
        const callBackToken = await PlatoTokenManager.getToken(appId);

        // 2. Get the existing JWT (may be expired/invalid but still needed for refresh)
        let oldJwt: string | null = null;
        try {
            oldJwt = await PlatoTokenManager.getToken(appId + '_JWT');
        } catch {
            console.log(`[PlatoBootstrap] No old JWT found, will try without Authorization header`);
        }

        // 3. Construct the refresh URL
        const refreshUrl = `${getApiGatewayBase()}/platojwtauthrefresh/`;
        console.log(`[PlatoBootstrap] Calling ${refreshUrl}`);

        // 4. Allow self-signed certificates
        if (config.general.nodeTlsRejectUnauthorized === '0') {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        // 5. Build headers (matching OBBRN's refresh call)
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'appId': appId,
            'branchCode': branchCode || '000',
            'callBackToken': callBackToken,
            'sourceCode': sourceCode || config.obbrn.sourceCode || 'FCUBS',
            'userId': userId || config.obbrn.defaultUser || '',
            'entityId': entityId || config.obbrn.entityId || 'DEFAULTENTITY',
            'multiEntityAdmin': 'N',
        };

        // Include old JWT in Authorization header if we have it
        if (oldJwt) {
            headers['Authorization'] = `Bearer ${oldJwt}`;
        }

        // 6. Make the refresh call (GET request)
        const response = await fetch(refreshUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error');
            console.error(`[PlatoBootstrap] Refresh failed with status ${response.status}: ${errorText}`);
            return null;
        }

        // 7. Parse response and extract new token
        const data = await response.json();
        console.log(`[PlatoBootstrap] Refresh response:`, JSON.stringify(data).substring(0, 200));

        const newToken = data.token || data.access_token || data.jwt;
        if (newToken) {
            // Store the new JWT
            PlatoTokenManager.setToken(appId + '_JWT', newToken);
            console.log(`[PlatoBootstrap] Successfully refreshed JWT for ${appId}`);

            // Reset bootstrap state so next call re-initializes properly
            resetBootstrapState(appId);

            return newToken;
        }

        console.error(`[PlatoBootstrap] No token in refresh response`);
        return null;

    } catch (error) {
        console.error(`[PlatoBootstrap] Refresh error:`, error);
        return null;
    }
}
