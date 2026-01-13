import { SystemAdapter, ApprovalDetails } from '../types';
import { config } from '../config';
import { httpClient } from '../http-client';

export class FcubsAdapter implements SystemAdapter {

    async fetchDetails(params: any): Promise<ApprovalDetails> {
        const { brn, acc } = params;

        if (!brn || !acc) {
            throw new Error("Missing brn or acc for FCUBS details");
        }

        const queryUrl = `${config.fcubs.queryAccUrl}/brn/${brn}/acc/${acc}`;
        console.log(`[FCUBS] Fetching details from: ${queryUrl}`);

        const data = await httpClient<any>(queryUrl, {
            headers: {
                'BRANCH': brn,
                'Entity': config.fcubs.entity,
                'Source': config.fcubs.source,
                'Userid': config.fcubs.userid
            }
        });

        return { data };
    }

    async executeAction(actionType: string, payload: any): Promise<any> {
        switch (actionType.toUpperCase()) {
            case 'APPROVE':
                return this.handleApprove(payload);
            default:
                throw new Error(`Action ${actionType} not supported by FCUBS adapter`);
        }
    }

    private async handleApprove(params: any) {
        const { brn, acc } = params;

        // Step 1: Fetch Full Record Details to get payload
        // We can reuse fetchDetails or do it here. Reusing is cleaner but details returns {data}.
        // The original code extracts queryData.custaccount

        const details = await this.fetchDetails(params);
        const queryData = details.data;

        if (!queryData.custaccount) {
            throw new Error("Invalid response format: missing custaccount");
        }

        const authPayload = queryData.custaccount;
        const authUrl = config.fcubs.authorizeAccUrl;

        console.log(`[FCUBS] Authorizing at: ${authUrl}`);

        // Step 2: Authorize Record
        // Note: The original returned text if JSON parse failed, httpClient throws on !ok.
        // We rely on httpClient handling.
        const response = await httpClient<any>(authUrl, {
            method: 'POST',
            headers: {
                'BRANCH': brn || '000', // Use dynamic branch from params
                'Entity': config.fcubs.entity,
                'Source': config.fcubs.source,
                'Userid': config.fcubs.userid
            },
            body: JSON.stringify(authPayload)
        });

        return response;
    }
}
