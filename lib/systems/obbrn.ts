import { SystemAdapter, ApprovalDetails } from '../types';
import { config } from '../config';
import { httpClient } from '../http-client';
import { ensurePlatoBootstrap } from './plato-bootstrap';
import { PlatoTokenManager } from './token-manager';

export class ObbrnAdapter implements SystemAdapter {

    /**
     * Ensures API Gateway is bootstrapped before any secured call.
     * This is the KEY fix: OBBRN performs this bootstrap, we must too.
     * 
     * FAULT TOLERANT: If bootstrap fails (no token), we log a warning but continue.
     * The API call might still work if user isn't logged into FlexCube (per original problem).
     */
    private async ensureBootstrap(appId: string, brn: string, userId: string): Promise<void> {
        // First check if we even have a token
        if (!PlatoTokenManager.hasValidToken(appId)) {
            console.warn(`[OBBRN] No valid token available for ${appId}. Bootstrap skipped.`);
            console.warn(`[OBBRN] API calls may fail if user is logged into FlexCube UI.`);
            return; // Skip bootstrap, try the API call anyway
        }

        try {
            await ensurePlatoBootstrap({
                appId: appId,
                branchCode: brn || '000',
                userId: userId || config.obbrn.defaultUser || '',
                entityId: config.obbrn.entityId,
                sourceCode: config.obbrn.sourceCode || 'FCUBS',
            });
        } catch (error) {
            console.error(`[OBBRN] Bootstrap failed:`, error);
            console.warn(`[OBBRN] Continuing without bootstrap - API call may fail.`);
            // Don't throw - let the API call attempt proceed
        }
    }

    async fetchDetails(params: any): Promise<ApprovalDetails> {
        const { ejLogId, brn, userId } = params;
        if (!ejLogId) throw new Error("Missing EJ Log ID for OBBRN details");

        // Build the details URL once
        const baseUrl = config.obbrn.ejLogUrl;
        let detailsUrl: string;
        if (baseUrl.endsWith('EJLogId') || baseUrl.endsWith('EJLogId=')) {
            detailsUrl = baseUrl.endsWith('=') ? `${baseUrl}${ejLogId}` : `${baseUrl}=${ejLogId}`;
        } else if (baseUrl.includes('?')) {
            detailsUrl = `${baseUrl}&EJLogId=${ejLogId}`;
        } else {
            detailsUrl = `${baseUrl}?EJLogId=${ejLogId}`;
        }

        // Try up to 2 times (initial + 1 retry after JWT refresh)
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                // Bootstrap API Gateway session
                await this.ensureBootstrap(config.obbrn.appIdView, brn || '000', userId);

                // Get tokens
                const token = await this.authenticate(config.obbrn.appIdView, brn || '000', userId);

                let jwtToken: string | null = null;
                try {
                    jwtToken = await PlatoTokenManager.getToken(config.obbrn.appIdView + '_JWT');
                    console.log(`[OBBRN] Using JWT token for API call (attempt ${attempt})`);
                } catch {
                    console.log(`[OBBRN] No JWT token, using callBackToken only`);
                }

                // Build headers
                const headers: Record<string, string> = {
                    'callBackToken': token,
                    'Content-Type': 'application/json',
                    'appId': 'SRVCMNTXN',
                    'branchCode': brn || '000',
                    'entityId': config.obbrn.entityId,
                    'userId': userId || config.obbrn.defaultUser,
                };
                if (jwtToken) {
                    headers['Authorization'] = `Bearer ${jwtToken}`;
                }

                console.log(`[OBBRN] Fetching details from ${detailsUrl} (attempt ${attempt})`);

                const ejData = await httpClient<any>(detailsUrl, {
                    method: 'GET',
                    headers
                });

                return { data: ejData };

            } catch (error: any) {
                const is401 = error.message?.includes('401') || error.message?.includes('Unauthorized');

                if (is401 && attempt === 1) {
                    // 401 error on first attempt - session may have been invalidated
                    console.warn(`[OBBRN] Got 401 error. Session may have been invalidated by OBBRN/NextGen.`);
                    console.log(`[OBBRN] Attempting to refresh JWT token...`);

                    // Try to refresh the JWT using the refresh endpoint
                    const { refreshPlatoJwt } = await import('./plato-bootstrap');
                    const newToken = await refreshPlatoJwt({
                        appId: config.obbrn.appIdView,
                        branchCode: brn || '000',
                        userId: userId || config.obbrn.defaultUser || '',
                        entityId: config.obbrn.entityId,
                        sourceCode: config.obbrn.sourceCode || 'FCUBS'
                    });

                    if (newToken) {
                        console.log(`[OBBRN] JWT refreshed successfully, retrying API call...`);
                        // Continue to next iteration (retry with new token)
                        continue;
                    } else {
                        console.error(`[OBBRN] JWT refresh failed, cannot retry.`);
                        throw error;
                    }
                }

                // Either not a 401, or already retried - throw the error
                throw error;
            }
        }

        throw new Error('[OBBRN] Failed to fetch details after retry');
    }

    async executeAction(actionType: string, payload: any): Promise<any> {
        switch (actionType.toUpperCase()) {
            case 'APPROVE':
                return this.handleApprove(payload);
            case 'CASH_WITHDRAWAL':
                // Placeholder for future extensibility
                throw new Error("Cash Withdrawal not yet implemented");
            default:
                throw new Error(`Action ${actionType} not supported by OBBRN adapter`);
        }
    }

    private async handleApprove(params: any) {
        const { ejLogId, brn } = params;

        // 1. Get Details first
        const detailsWrap = await this.fetchDetails(params);
        const ejData = detailsWrap.data;
        const logData = ejData.data || ejData;

        // 2. Construct Approval Payload
        const approvalPayload = {
            functionCode: logData.functionCode || "",
            subScreenClass: logData.subScreenClass || "",
            ejId: ejLogId,
            authorizerRole: "RETAIL_MANAGER",
            txnRefNumber: logData.txnRefNo || logData.txnRefNumber || "",
            supervisorId: params.userId || config.obbrn.defaultUser
        };

        console.log("[OBBRN] Constructed Payload:", approvalPayload);

        // 3. Bootstrap for Approval endpoint (uses different appId)
        await this.ensureBootstrap(config.obbrn.appIdApprove, brn || '000', params.userId);

        // 4. Authenticate for Approval (Different App ID)
        const authResult = await this.authenticateFullResponse(config.obbrn.appIdApprove, brn || '000', params.userId);
        const approveToken = authResult.token;
        const cookie = authResult.cookie;

        // Try to get the JWT token from bootstrap for approval
        let jwtToken: string | null = null;
        try {
            jwtToken = await PlatoTokenManager.getToken(config.obbrn.appIdApprove + '_JWT');
            console.log(`[OBBRN] Using JWT token for approval call`);
        } catch {
            console.log(`[OBBRN] No JWT token for approval, using callBackToken only`);
        }

        // 5. Send Approval with both tokens
        const headers: Record<string, string> = {
            'callBackToken': approveToken,
            'appId': config.obbrn.appIdApprove,
            'branchCode': brn || '000',
            'userId': params.userId || config.obbrn.defaultUser,
            'entityId': config.obbrn.entityId,
            'Content-Type': 'application/json'
        };
        if (cookie) {
            headers['Cookie'] = cookie;
        }
        if (jwtToken) {
            headers['Authorization'] = `Bearer ${jwtToken}`;
        }

        console.log(`[OBBRN] Sending Approval to ${config.obbrn.approveUrl}`);

        const finalRes = await httpClient<any>(config.obbrn.approveUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(approvalPayload)
        });

        return finalRes;
    }

    // Updated authentication logic using PLATO Callback Token
    private async authenticate(appId: string, branch: string, dynamicUser?: string): Promise<string> {
        return this.authenticateWithCallback(appId);
    }

    private async authenticateFullResponse(appId: string, branch: string, dynamicUser?: string): Promise<{ token: string, cookie: string | null }> {
        const token = await this.authenticateWithCallback(appId);
        return { token, cookie: null };
    }

    private async authenticateWithCallback(appId: string): Promise<string> {
        try {
            const callBackToken = await PlatoTokenManager.getToken(appId);
            return callBackToken;
        } catch (error: any) {
            console.error(`[OBBRN] Token retrieval failed for ${appId}:`, error.message);
            throw new Error(
                `OBBRN authentication failed: ${error.message}. ` +
                `Please reopen the dashboard from FlexCube to re-authenticate.`
            );
        }
    }
}
