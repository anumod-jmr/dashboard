import { config } from './config';

interface HttpClientOptions extends RequestInit {
    // Add any custom options here if needed in future
}

export async function httpClient<T>(url: string, options: HttpClientOptions = {}): Promise<T> {
    // Apply global configurations
    if (config.general.nodeTlsRejectUnauthorized === '0') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const finalOptions: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        // Ensure no-store is default for fresh data, unless overridden
        cache: options.cache || 'no-store',
    };

    try {
        const response = await fetch(url, finalOptions);

        if (!response.ok) {
            let errorDetails = '';
            try {
                errorDetails = await response.text();
            } catch (e) {
                errorDetails = 'Unable to read error body';
            }
            throw new Error(`HTTP Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }

        // Handle empty responses or non-json gracefully if needed, for now assume JSON
        const data = await response.json();
        return data as T;

    } catch (error: any) {
        // Enhance error message or logging here
        console.error(`[HttpClient] Request failed to ${url}`, error);
        throw error;
    }
}
