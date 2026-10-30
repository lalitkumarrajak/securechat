import { toast } from 'sonner';

export const fail = (e: unknown) => toast.error((e as Error).message);
