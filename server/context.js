// Shared server state: the database handle and the message sequence counter.
export const ctx = { db: null, seq: 0 };

// Every insert or status change gets a new seq so clients can sync deltas with one number.
export const nextSeq = () => ++ctx.seq;
