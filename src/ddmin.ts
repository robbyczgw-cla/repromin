/**
 * Minimizing delta debugging (ddmin) over an ordered list of removable units.
 * The predicate returns:
 *   INTERESTING     — still the same failure
 *   NOT_INTERESTING — passed or different outcome that is "smaller is not better"
 *   UNRESOLVED      — invalid / unreachable; do not treat as a reduction
 */

export type PredClass = "INTERESTING" | "NOT_INTERESTING" | "UNRESOLVED";

export interface DdminOptions<T> {
  pred: (subset: T[]) => Promise<PredClass> | PredClass;
  maxEvals?: number;
  onStep?: (info: { n: number; size: number; kind: string; result: PredClass }) => void;
}

export class BudgetExceeded extends Error {
  constructor(public evals: number) {
    super(`Reduction budget exceeded after ${evals} evaluations`);
    this.name = "BudgetExceeded";
  }
}

/**
 * Fast path for the common "goto + a mountain of codegen noise + crash"
 * shape. Always keep the first unit (usually page.goto) and binary-search
 * how much of the following prefix can be dropped. Then ddmin the rest.
 */
export async function prefixChop<T>(units: T[], opts: DdminOptions<T>): Promise<T[]> {
  if (units.length < 4) return units;
  let lo = 1;
  let hi = units.length - 1;
  let best = units.slice();
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = [units[0], ...units.slice(mid)];
    const result = await opts.pred(candidate);
    opts.onStep?.({ n: 0, size: candidate.length, kind: "prefix-chop", result });
    if (result === "INTERESTING") {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Aligned large-chunk deletion. O(n) evaluations and much faster than
 * ddmin on "needed actions sprinkled through codegen noise" tests,
 * because those make most non-aligned subsets UNRESOLVED.
 */
export async function coarseChunks<T>(units: T[], opts: DdminOptions<T>): Promise<T[]> {
  let current = units.slice();
  let width = Math.max(1, Math.floor(current.length / 2));
  while (width >= 1 && current.length > 1) {
    let i = 0;
    let progressed = false;
    while (i + width <= current.length) {
      const without = current.filter((_, j) => j < i || j >= i + width);
      if (without.length === current.length) {
        i += width;
        continue;
      }
      const result = await opts.pred(without);
      opts.onStep?.({ n: 0, size: without.length, kind: `chunk-${width}`, result });
      if (result === "INTERESTING") {
        current = without;
        progressed = true;
      } else {
        i += width;
      }
    }
    if (!progressed) width = Math.floor(width / 2);
  }
  return current;
}

export async function ddmin<T>(units: T[], opts: DdminOptions<T>): Promise<T[]> {
  if (units.length === 0) return units;
  let current = units.slice();
  let n = 2;
  let evals = 0;
  const budget = opts.maxEvals ?? 500;

  const test = async (subset: T[], kind: string): Promise<PredClass> => {
    evals++;
    if (evals > budget) throw new BudgetExceeded(evals);
    const result = await opts.pred(subset);
    opts.onStep?.({ n: evals, size: subset.length, kind, result });
    return result;
  };

  // Initial set is assumed already interesting (caller verified).
  while (current.length >= 2) {
    const subsets = split(current, n);
    let reduced = false;

    for (const subset of subsets) {
      if (subset.length === 0) continue;
      if ((await test(subset, "subset")) === "INTERESTING") {
        current = subset;
        n = 2;
        reduced = true;
        break;
      }
    }
    if (reduced) continue;

    if (n > 2) {
      const complements = subsets.map((_, i) => current.filter((_, j) => Math.floor((j * n) / current.length) !== i));
      for (const complement of complements) {
        if (complement.length === current.length) continue;
        if ((await test(complement, "complement")) === "INTERESTING") {
          current = complement;
          n = Math.max(n - 1, 2);
          reduced = true;
          break;
        }
      }
    }
    if (reduced) continue;

    if (n < current.length) {
      n = Math.min(current.length, n * 2);
      continue;
    }
    break;
  }

  // One last linear pass: drop each remaining unit independently.
  let i = 0;
  while (i < current.length) {
    const without = current.filter((_, j) => j !== i);
    if (without.length === current.length) {
      i++;
      continue;
    }
    if ((await test(without, "linear")) === "INTERESTING") {
      current = without;
      continue;
    }
    i++;
  }

  // Parasitic adjacent pairs (open product → act on that product → back)
  // cannot be removed one-at-a-time. Try windows of 2 and 3 on the
  // already-small set only.
  for (const width of [2, 3]) {
    i = 0;
    while (i + width <= current.length) {
      const without = current.filter((_, j) => j < i || j >= i + width);
      if ((await test(without, `window-${width}`)) === "INTERESTING") {
        current = without;
        continue;
      }
      i++;
    }
  }

  return current;
}

function split<T>(xs: T[], n: number): T[][] {
  const size = xs.length;
  const chunks: T[][] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * size) / n);
    const end = Math.floor(((i + 1) * size) / n);
    chunks.push(xs.slice(start, end));
  }
  return chunks;
}
