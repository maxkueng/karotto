declare const KAROTTO_VERSION: string | undefined;

export const version = typeof KAROTTO_VERSION === 'string' ? KAROTTO_VERSION : 'dev';
