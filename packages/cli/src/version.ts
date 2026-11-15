declare const KAROTTO_VERSION: string | undefined;
declare const KAROTTO_STANDALONE: boolean | undefined;

export const version = typeof KAROTTO_VERSION === 'string' ? KAROTTO_VERSION : 'dev';

export const standalone = typeof KAROTTO_STANDALONE === 'boolean' && KAROTTO_STANDALONE;
