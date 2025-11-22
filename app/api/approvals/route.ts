// app/api/approvals/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
    const urls = [
        "http://192.168.3.245:8002/customer-service/api/v1/customers/pending",
        "https://192.168.3.245:8002/customer-service/api/v1/customers/pending"
    ];

    let data = null;
    const errors: string[] = [];

    for (const url of urls) {
        try {
            console.log(`Attempting to fetch from: ${url}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const res = await fetch(url, {
                cache: "no-store",
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                data = await res.json();
                break; // Success, exit loop
            } else {
                const msg = `Failed to fetch from ${url}: ${res.status} ${res.statusText}`;
                console.warn(msg);
                errors.push(msg);
            }
        } catch (err: any) {
            const msg = `Error fetching from ${url}: ${err.message || err}`;
            console.warn(msg);
            errors.push(msg);
        }
    }

    if (!data) {
        console.error("All fetch attempts failed:", errors);
        return NextResponse.json(
            {
                error: "Failed to fetch approval/customer data",
                details: errors
            },
            { status: 500 }
        );
    }

    try {
        // Convert customer JSON -> approval-like structure (placeholders)
        const formatted = data.map((c: any) => ({
            sourceSystem: "FCUBS",                          // placeholder
            module: "CUSTOMER",                             // placeholder
            txnId: c.CUSTOMER_NO || "N/A",                  // use customer ID as txn
            accountNumber: "-",                             // customer does not have account number
            customerName: c.CUSTOMER_NAME1 || "Unknown",
            amount: 0,                                      // placeholder
            branch: c.LOCAL_BRANCH || "000",
            status: c.AUTH_STAT || "U",
            ageMinutes: 5,                                  // placeholder
            priority: "Normal",                             // placeholder
            initiator: c.MAKER_ID || "SYSTEM",
            timestamp: c.MAKER_DT_STAMP || new Date().toISOString()
        }));

        return NextResponse.json(formatted);
    } catch (err) {
        console.error("Data mapping error:", err);
        return NextResponse.json(
            { error: "Failed to map data structure" },
            { status: 500 }
        );
    }
}
