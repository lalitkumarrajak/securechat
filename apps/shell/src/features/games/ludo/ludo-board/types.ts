export interface LudoState { arms: number; arm: number[]; tokens: number[][]; phase: 'roll' | 'move'; dice: number; sixes: number; moves: number[] }

export interface Shown { tokens: number[][]; turn: number; dice: { s: number; d: number; rolling: boolean } | null }
