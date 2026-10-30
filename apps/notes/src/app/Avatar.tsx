import { sdk } from '@sanga/sdk';

export const Avatar = (p: { u: string; name?: string; size?: number }) => { const A = sdk().Avatar; return <A {...p} />; };
