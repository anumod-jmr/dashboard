import { SystemAdapter } from '../types';
import { FcubsAdapter } from './fcubs';
import { ObbrnAdapter } from './obbrn';

const adapters: Record<string, SystemAdapter> = {
    fcubs: new FcubsAdapter(),
    obbrn: new ObbrnAdapter(),
};

/**
 * Factory to get the correct system adapter.
 * Defaults to FCUBS if system is unknown (matching legacy logic).
 */
export function getSystemAdapter(systemName: string = ''): SystemAdapter {
    const key = systemName.toLowerCase();

    if (key === 'obbrn') {
        return adapters.obbrn;
    }

    // Default to FCUBS as per original logic
    return adapters.fcubs;
}
