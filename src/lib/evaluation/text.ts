/** Remove punctuation, toLowerCase, split. */
export function preprocess(str: string): string[] {
    return str
        .replace(/[.,!?;:'"]/g, '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}

/** Jaccard overlap of two strings => float in [0..1]. */
export function jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(preprocess(a));
    const setB = new Set(preprocess(b));
    if (setA.size === 0 && setB.size === 0) return 1;
    const intersect = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersect.size / union.size;
}

/**
 * Generate all permutations of a string array (simple approach).
 */
export function permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const perm of permutations(remaining)) {
            result.push([current, ...perm]);
        }
    }
    return result;
} 