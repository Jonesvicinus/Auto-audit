import type { Category } from "@/types";

// -----------------------------------------------------------------------------
// Fallback categorization heuristics. These only fire AFTER merchant memory
// (exact + fuzzy) has been consulted. They look at the merchant text itself
// for known brands / venue types and suggest a category by name.
//
// We map to category NAMES (not ids) so renamed user categories still match.
// -----------------------------------------------------------------------------

// Buckets keyed by canonical category name. The matching logic looks up the
// user's category list (case-insensitive) and falls back to nothing if there's
// no match — i.e. heuristics never invent categories the user doesn't have.
export type HeuristicBucket = "Food" | "Transportation" | "Bills" | "Fun";

interface Heuristic {
  bucket: HeuristicBucket;
  patterns: RegExp[];
}

// Patterns are intentionally generous — many merchant strings on bank
// statements smash city/state into the merchant name (e.g. "PUBLIX #1095COLUMBIASC"),
// so we anchor on the brand/keyword and don't require word boundaries on the right.
const HEURISTICS: Heuristic[] = [
  {
    bucket: "Food",
    patterns: [
      /\bstarbucks\b/i,
      /\bdunkin'?\b/i,
      /\bchick[\s-]*fil[\s-]*a\b/i,
      /\bchipotle\b/i,
      /\bmcdonalds?\b/i,
      /\bpanera\b/i,
      /\bdomino'?s?\b/i,
      /\braising\s*canes?\b/i,
      /\bpoke\s*bros\b/i,
      /\bpublix\b/i,
      /\bdairy\s*queen\b/i,
      /\bjack\s*brown'?s?\b/i,
      /\b16\s*handles\b/i,
      /\bforbidden\s*pizza\b/i,
      /\bpizza\b/i,
      /\bvending\b/i,
      /\bcanteen\b/i,
      /\bpopeyes?\b/i,
      /\btaco\s*bell\b/i,
      /\bwendy'?s?\b/i,
      /\bsubway\b/i,
      /\bgrocery\b/i,
      /\bcafe\b/i,
      /\bcoffee\b/i,
      /\bdeli\b/i,
    ],
  },
  {
    bucket: "Transportation",
    patterns: [
      /\bshell\b/i,
      /\bexxon\b/i,
      /\bsunoco\b/i,
      /\bbp\b/i,
      /\bchevron\b/i,
      /\bbuc[\s-]*ee'?s?\b/i,
      /\bvalero\b/i,
      /\bmobil\b/i,
      /\bcitgo\b/i,
      /\b76\s*gas\b/i,
      /\barco\b/i,
      /\blyft\b/i,
      /\buber\b(?!\s*eats)/i, // exclude "Uber Eats"
      /\bparking\b/i,
      /\btransit\b/i,
      /\bgarage\b/i,
      /\btoll\b/i,
      /\bmta\b/i,
      /\bmetro\s*card\b/i,
      /\bamtrak\b/i,
      /\bgas\s*station\b/i,
    ],
  },
  {
    bucket: "Bills",
    patterns: [
      /\bspotify\b/i,
      /\bnetflix\b/i,
      /\bhulu\b/i,
      /\bapple\s*music\b/i,
      /\byoutube\s*premium\b/i,
      /\bopenai\b/i,
      /\bchatgpt\b/i,
      /\bdisney\s*plus\b/i,
      /\bdisney\+\b/i,
      /\bhbo\s*max\b/i,
      /\bicloud\b/i,
      /\bdropbox\b/i,
      /\badobe\b/i,
      /\bgithub\b/i,
      /\bgym\b/i,
      /\bplanet\s*fitness\b/i,
      /\b(orange|life|gold'?s?|crunch)\s*fitness\b/i,
      /\bmembership\b/i,
      /\binsurance\b/i,
      /\bxfinity\b/i,
      /\bcomcast\b/i,
      /\bverizon\b/i,
      /\bt[\s-]*mobile\b/i,
      /\bat&t\b/i,
      /\bsubscription\b/i,
    ],
  },
  {
    bucket: "Fun",
    patterns: [
      /\bsaloon\b/i,
      /\btopgolf\b/i,
      /\bconcert\b/i,
      /\bticket\s*master\b/i,
      /\bticketmaster\b/i,
      /\bstubhub\b/i,
      /\bcantina\b/i,
      /\bbrewing\b/i,
      /\bbrewery\b/i,
      /\bpub\b/i,
      /\btavern\b/i,
      /\blounge\b/i,
      /\bnightclub\b/i,
      /\bbowling\b/i,
      /\barcade\b/i,
      // Capital-One-specific fun spots from the example PDF — generic enough to
      // match similar venue names in real statements
      /\bbreakers\b/i,
      /\btouchdowns\b/i,
      /\bswamp\b/i,
      /\bbeach\s*on\s*bourbon\b/i,
      /\b5\s*points\b/i,
      /\bpci\s*gaming\b/i,
      /\bgaming\s*authority\b/i,
    ],
  },
];

// Synonym map: when a heuristic suggests "Food", we look for any of these
// names (case-insensitive) in the user's category list.
const NAME_SYNONYMS: Record<HeuristicBucket, string[]> = {
  Food: ["food", "groceries", "dining", "restaurants"],
  Transportation: ["transportation", "transport", "gas", "transportation / gas", "transit"],
  Bills: ["bills", "subscriptions", "bills & subscriptions", "bills/subscriptions"],
  Fun: ["fun money", "fun", "entertainment", "going out"],
};

export interface HeuristicHit {
  bucket: HeuristicBucket;
  categoryId: string;
  matchedPattern: string;
}

// Try to find a category in the user's list whose name maps to the given bucket.
function findCategoryForBucket(
  bucket: HeuristicBucket,
  categories: Category[],
): Category | null {
  const synonyms = NAME_SYNONYMS[bucket].map((s) => s.toLowerCase());
  for (const c of categories) {
    if (synonyms.includes(c.name.toLowerCase().trim())) return c;
  }
  return null;
}

// Run heuristics on a merchant string. Returns the first hit, or null.
export function suggestCategoryByHeuristic(
  merchant: string,
  categories: Category[],
): HeuristicHit | null {
  const text = merchant.trim();
  if (!text) return null;
  for (const h of HEURISTICS) {
    for (const p of h.patterns) {
      if (p.test(text)) {
        const cat = findCategoryForBucket(h.bucket, categories);
        if (cat) {
          return {
            bucket: h.bucket,
            categoryId: cat.id,
            matchedPattern: p.source,
          };
        }
        // Bucket recognized but no matching user category — keep looking
        // in case a later heuristic targets a bucket the user does have.
        break;
      }
    }
  }
  return null;
}
