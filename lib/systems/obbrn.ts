import { SystemAdapter, ApprovalDetails } from '../types';
import { config } from '../config';
import { httpClient } from '../http-client';

export class ObbrnAdapter implements SystemAdapter {

    async fetchDetails(params: any): Promise<ApprovalDetails> {
        const { ejLogId, brn } = params;
        if (!ejLogId) throw new Error("Missing EJ Log ID for OBBRN details");

        // 1. Authenticate for View
        const token = await this.authenticate(config.obbrn.appIdView, brn || '000');

        // 2. Fetch Details
        const detailsUrl = `${config.obbrn.ejLogUrl}?EJLogId=${ejLogId}`;
        console.log(`[OBBRN] Fetching details from ${detailsUrl}`);

        const ejData = await httpClient<any>(detailsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                // Correct AppID for Details Fetch as per legacy logic
                'appId': 'SRVCMNTXN',
                'branchCode': brn || '000',
                'entityId': config.obbrn.entityId,
                'userId': config.obbrn.defaultUser,
            }
        });

        return { data: ejData };
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

        // 1. Get Details first (Re-using generic fetch logic or doing it specifically? 
        // The specific flow needs the DATA from details to build payload)
        // We can reuse fetchDetails but we need the raw data structure.

        const detailsWrap = await this.fetchDetails(params);
        const ejData = detailsWrap.data;
        const logData = ejData.data || ejData;

        // 2. Construct Approval Payload
        const approvalPayload = {
            functionCode: logData.functionCode || "",
            subScreenClass: logData.subScreenClass || "",
            ejId: ejLogId,
            txnRefNumber: logData.txnRefNo || logData.txnRefNumber || "",
            supervisorId: params.userId || config.obbrn.defaultUser
        };

        console.log("[OBBRN] Constructed Payload:", approvalPayload);

        // 3. Authenticate for Approval (Different App ID)
        // capture cookie if needed (original code captured 'set-cookie') - fetch wrapper handles default cookie behavior usually, 
        // but here we might need manual handling if the auth response sets it and the next request needs it.
        // The original code manually extracted `set-cookie` header.
        // Our httpClient wrapper doesn't currently return headers easily unless we change the signature.
        // For now, let's assume the Token is the primary mechanism as per standard JWT. 
        // If Cookie is critical, we might need to adjust authenticate to return it.

        const authResult = await this.authenticateFullResponse(config.obbrn.appIdApprove, brn || '000');
        const approveToken = authResult.token;
        const cookie = authResult.cookie;

        // 4. Send Approval
        const headers: any = {
            'Authorization': `Bearer ${approveToken}`,
            'appId': config.obbrn.appIdApprove,
            'branchCode': brn || '000',
            'userId': params.userId || config.obbrn.defaultUser,
            'entityId': config.obbrn.entityId
        };
        if (cookie) {
            headers['Cookie'] = cookie;
        }

        console.log(`[OBBRN] Sending Approval to ${config.obbrn.approveUrl}`);

        const finalRes = await httpClient<any>(config.obbrn.approveUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(approvalPayload)
        });

        return finalRes;
    }

    // Helper to just get token
    private async authenticate(appId: string, branch: string): Promise<string> {
        const res = await this.authenticateFullResponse(appId, branch);
        return res.token;
    }

    // Full Auth to capture Cookie if needed
    private async authenticateFullResponse(appId: string, branch: string): Promise<{ token: string, cookie: string | null }> {
        const authUrl = config.obbrn.authUrl;
        console.log(`[OBBRN] Authenticating for ${appId}...`);

        // We need raw response for headers, so we use fetch directly or modify httpClient.
        // For simplicity here, I'll use fetch directly since this is a specific auth edge case with cookies.
        // But I should use the config for SSL rejection.

        if (config.general.nodeTlsRejectUnauthorized === '0') {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        const res = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'appId': appId,
                'branchCode': branch,
                'userId': config.obbrn.defaultUser,
                'entityId': config.obbrn.entityId,
                'sourceCode': config.obbrn.sourceCode
            },
        });

        if (!res.ok) {
            throw new Error(`Auth Failed: ${res.status}`);
        }

        const cookie = res.headers.get('set-cookie');
        const data = await res.json();
        const token = data.access_token || data.token || data.jwt;

        if (!token) throw new Error("Failed to retrieve access token");

        return { token, cookie };
    }
}
