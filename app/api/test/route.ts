import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { config } from '@/lib/config';
import { httpClient } from '@/lib/http-client';
import { Approval } from '@/lib/types';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const system = searchParams.get('system');
    const module = searchParams.get('module');
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    // User is retrieved from Cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('dashboard_user');
    const user = userCookie?.value || "";

    try {
        // Fetch data from backend (Pass user context via Header)
        const apiUrl = config.general.pendingApiUrl;

        const headers: Record<string, string> = {};
        if (user) {
            headers['X-User-Id'] = user;
        }

        const data = await httpClient<any[]>(apiUrl, { headers });

        // DEBUG: Analyze what Backend returned
        console.log(`[API] User Param: "${user}"`);
        console.log(`[API] Backend returned ${data.length} records.`);
        const obbrnItems = data.filter((i: any) => i.SYSTEM_NAME === 'OBBRN');
        console.log(`[API] OBBRN Records count: ${obbrnItems.length}`);
        if (obbrnItems.length > 0) {
            console.log(`[API] Sample OBBRN Authoriser: "${obbrnItems[0].AUTHORISER}"`);
            obbrnItems.slice(0, 5).forEach((item, idx) => {
                console.log(`[API] OBBRN[${idx}] Auth: ${item.AUTHORISER} | Maker: ${item.MAKER_ID}`);
            });
        }

        // Frontend filtering removed (Logic moved to WAR/DAO)

        // Map response format to Approval interface
        let formatted: Approval[] = data.map((item: any) => ({
            sourceSystem: (item.SYSTEM_NAME || "Unknown").toUpperCase(),
            module: (item.MODULE_NAME || "Unknown").toUpperCase(),
            txnId: item.REFERENCE_ID || `TXN-${Math.random()}`,
            accountNumber: item.ACCOUNT_NO || "N/A",
            customerName: "Unknown",
            amount: 0,
            branch: item.BRANCH_CODE || "000",
            status: item.STATUS || "Pending",
            ageMinutes: 0,
            priority: "Normal",
            initiator: item.MAKER_ID || "System",
            timestamp: item.TXN_DATE || new Date().toISOString(),
            brn: item.BRANCH_CODE || "000",
            acc: item.ACCOUNT_NO || "N/A",
            ejLogId: item.REFERENCE_ID,
            authoriser: item.AUTHORISER
        }));

        // Apply Logic Filtering Here (Client/Node Side)
        if (system && system !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.sourceSystem || "").toLowerCase() === system.toLowerCase()
            );
        }

        if (module && module !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.module || "").toLowerCase() === module.toLowerCase()
            );
        }

        if (branch && branch !== '(All)') {
            formatted = formatted.filter((item) =>
                (item.branch || "") === branch
            );
        }

        if (status && status !== '(All)') {
            if (status === '(Pending)') {
                // Default pending check if needed, or just match status
            } else {
                formatted = formatted.filter((item) =>
                    (item.status || "").toLowerCase() === status.toLowerCase()
                );
            }
        }

        return NextResponse.json(formatted);

    } catch (err: any) {
        console.error("API Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch data", details: [err.message] },
            { status: 500 }
        );
    }
}
