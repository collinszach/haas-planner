import { getDefaultSectionsForCohort, SECTION_BY_ID } from "@/data/sections";
import type {
  AnonymizedQueueItem,
  CohortName,
  CourseName,
  MarketPulseItem,
  StudentProfile,
  SwapMatch,
  SwapRequest,
} from "@/types/swap";

export interface MatchEngineState {
  profiles: Record<string, StudentProfile>;
  requests: SwapRequest[];
  matches: SwapMatch[];
}

export interface SubmitSwapPayload {
  userId: string;
  swapType: "single" | "cohort";
  legs: {
    course: CourseName | null;
    givingUpKey: string;
    wantedKeys: string[];
    notes: string;
  }[];
  nowIso?: string;
}

export interface SubmitSwapResult {
  createdRequests: SwapRequest[];
  newMatches: SwapMatch[];
  nextState: MatchEngineState;
}

function getRank(wantedKeys: string[], targetKey: string): number {
  const idx = wantedKeys.indexOf(targetKey);
  return idx === -1 ? -1 : idx + 1;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Finds the best active standalone match candidate for `req`.
 * Priority:
 * 1. Lowest combined preference rank score (rankA + rankB)
 * 2. Submitter's higher preference rank (rankA)
 * 3. Earliest queue_priority_at (FIFO fairness)
 */
function findBestStandaloneCandidate(
  req: SwapRequest,
  activeRequests: SwapRequest[],
  excludedRequestIds: Set<string>,
): { candidate: SwapRequest; rankA: number; rankB: number } | null {
  const candidates: {
    candidate: SwapRequest;
    rankA: number;
    rankB: number;
  }[] = [];

  for (const other of activeRequests) {
    if (other.id === req.id) continue;
    if (excludedRequestIds.has(other.id)) continue;
    if (other.status !== "active") continue;
    if (other.userId === req.userId) continue;
    if (other.swapType !== req.swapType) continue;
    if (other.bundleId !== null) continue; // paired bundles matched atomically below

    const rankA = getRank(req.wantedKeys, other.givingUpKey);
    const rankB = getRank(other.wantedKeys, req.givingUpKey);
    if (rankA > 0 && rankB > 0) {
      candidates.push({ candidate: other, rankA, rankB });
    }
  }

  candidates.sort((a, b) => {
    const sumDiff = a.rankA + a.rankB - (b.rankA + b.rankB);
    if (sumDiff !== 0) return sumDiff;
    if (a.rankA !== b.rankA) return a.rankA - b.rankA;
    return a.candidate.queuePriorityAt.localeCompare(
      b.candidate.queuePriorityAt,
    );
  });

  return candidates[0] ?? null;
}

/**
 * Checks if two paired bundles (2 legs each) mutually mirror each other.
 */
function findMatchingBundlePair(
  myLegs: SwapRequest[],
  allActive: SwapRequest[],
  excludedIds: Set<string>,
): {
  partnerLegs: SwapRequest[];
  pairs: { mine: SwapRequest; theirs: SwapRequest; rankA: number; rankB: number }[];
} | null {
  // Group other active bundled requests by bundleId
  const byBundle = new Map<string, SwapRequest[]>();
  for (const req of allActive) {
    if (!req.bundleId || req.status !== "active") continue;
    if (req.userId === myLegs[0].userId) continue;
    if (excludedIds.has(req.id)) continue;
    const arr = byBundle.get(req.bundleId) ?? [];
    arr.push(req);
    byBundle.set(req.bundleId, arr);
  }

  const bestCandidates: {
    partnerLegs: SwapRequest[];
    pairs: { mine: SwapRequest; theirs: SwapRequest; rankA: number; rankB: number }[];
    totalRankScore: number;
    priorityAt: string;
  }[] = [];

  for (const [, bundleLegs] of byBundle) {
    if (bundleLegs.length !== myLegs.length) continue;

    // Try matching each of myLegs to a distinct leg in bundleLegs
    const used = new Set<string>();
    const pairs: {
      mine: SwapRequest;
      theirs: SwapRequest;
      rankA: number;
      rankB: number;
    }[] = [];
    let valid = true;

    for (const mine of myLegs) {
      const matchLeg = bundleLegs.find((theirs) => {
        if (used.has(theirs.id)) return false;
        const rA = getRank(mine.wantedKeys, theirs.givingUpKey);
        const rB = getRank(theirs.wantedKeys, mine.givingUpKey);
        return rA > 0 && rB > 0;
      });
      if (!matchLeg) {
        valid = false;
        break;
      }
      used.add(matchLeg.id);
      pairs.push({
        mine,
        theirs: matchLeg,
        rankA: getRank(mine.wantedKeys, matchLeg.givingUpKey),
        rankB: getRank(matchLeg.wantedKeys, mine.givingUpKey),
      });
    }

    if (valid && pairs.length === myLegs.length) {
      const totalRankScore = pairs.reduce(
        (acc, p) => acc + p.rankA + p.rankB,
        0,
      );
      bestCandidates.push({
        partnerLegs: bundleLegs,
        pairs,
        totalRankScore,
        priorityAt: bundleLegs[0].queuePriorityAt,
      });
    }
  }

  // Also check if all legs of myBundle can be satisfied simultaneously by
  // standalone active single requests (from one or two different partners)!
  if (bestCandidates.length === 0) {
    const usedStandalone = new Set<string>(excludedIds);
    const standalonePairs: {
      mine: SwapRequest;
      theirs: SwapRequest;
      rankA: number;
      rankB: number;
    }[] = [];
    let allSatisfied = true;

    for (const mine of myLegs) {
      const found = findBestStandaloneCandidate(mine, allActive, usedStandalone);
      if (!found) {
        allSatisfied = false;
        break;
      }
      usedStandalone.add(found.candidate.id);
      standalonePairs.push({
        mine,
        theirs: found.candidate,
        rankA: found.rankA,
        rankB: found.rankB,
      });
    }

    if (allSatisfied && standalonePairs.length === myLegs.length) {
      return {
        partnerLegs: standalonePairs.map((p) => p.theirs),
        pairs: standalonePairs,
      };
    }
    return null;
  }

  bestCandidates.sort((a, b) => {
    const diff = a.totalRankScore - b.totalRankScore;
    if (diff !== 0) return diff;
    return a.priorityAt.localeCompare(b.priorityAt);
  });

  const best = bestCandidates[0];
  return { partnerLegs: best.partnerLegs, pairs: best.pairs };
}

/**
 * Pure atomic matching engine mirroring the Postgres `submit_and_match_swap` RPC.
 * Handles:
 * - Single-course swaps
 * - Whole cohort swaps
 * - Paired "all-or-nothing" bundles (matches either an inverse bundle or simultaneous standalone partners)
 * - Opportunistic re-matching when a new standalone request completes an existing waiting bundle!
 */
export function submitAndMatchInMemory(
  state: MatchEngineState,
  payload: SubmitSwapPayload,
): SubmitSwapResult {
  const now = payload.nowIso ?? new Date().toISOString();
  const isBundle = payload.legs.length > 1;
  const bundleId = isBundle ? makeId("bundle") : null;

  // Validate no duplicate active request for the same givingUpKey or course
  for (const leg of payload.legs) {
    if (leg.wantedKeys.length === 0 || leg.wantedKeys.length > 3) {
      throw new Error("Please select between 1 and 3 target choices.");
    }
    if (leg.wantedKeys.includes(leg.givingUpKey)) {
      throw new Error("You cannot list the section you are giving up as a target.");
    }
    const existing = state.requests.find(
      (r) =>
        r.userId === payload.userId &&
        (r.status === "active" || r.status === "matched" || r.status === "submitted") &&
        (r.givingUpKey === leg.givingUpKey ||
          (payload.swapType === "single" && r.course === leg.course)),
    );
    if (existing) {
      throw new Error(
        `You already have an open or matched request for ${leg.course ?? "a cohort swap"}.`,
      );
    }
  }

  const createdRequests: SwapRequest[] = payload.legs.map((leg) => ({
    id: makeId("req"),
    userId: payload.userId,
    bundleId,
    swapType: payload.swapType,
    course: leg.course,
    givingUpKey: leg.givingUpKey,
    wantedKeys: [...leg.wantedKeys],
    notes: leg.notes.trim(),
    status: "active",
    queuePriorityAt: now,
    createdAt: now,
    updatedAt: now,
  }));

  const workingRequests = state.requests.map((r) => ({ ...r }));
  workingRequests.push(...createdRequests);

  const newMatches: SwapMatch[] = [];
  const consumedIds = new Set<string>();

  const buildMatchRecord = (
    mine: SwapRequest,
    theirs: SwapRequest,
    rankA: number,
    rankB: number,
    bundleGroupId: string | null,
  ): SwapMatch => {
    const profileA = state.profiles[mine.userId];
    const profileB = state.profiles[theirs.userId];
    return {
      id: makeId("match"),
      bundleMatchGroupId: bundleGroupId,
      requestAId: mine.id,
      requestBId: theirs.id,
      userAId: mine.userId,
      userBId: theirs.userId,
      swapType: mine.swapType,
      course: mine.course,
      userAGivesKey: mine.givingUpKey,
      userBGivesKey: theirs.givingUpKey,
      userARank: rankA,
      userBRank: rankB,
      status: "matched",
      submittedByUserId: null,
      submittedAt: null,
      confirmedByA: false,
      confirmedByB: false,
      cancelledByUserId: null,
      cancelReason: null,
      emailSentA: false,
      emailSentB: false,
      createdAt: now,
      partnerA: profileA
        ? {
            id: profileA.id,
            fullName: profileA.fullName,
            email: profileA.email,
            studentId: profileA.studentId,
          }
        : undefined,
      partnerB: profileB
        ? {
            id: profileB.id,
            fullName: profileB.fullName,
            email: profileB.email,
            studentId: profileB.studentId,
          }
        : undefined,
    };
  };

  if (isBundle) {
    const matchResult = findMatchingBundlePair(
      createdRequests,
      workingRequests,
      consumedIds,
    );
    if (matchResult) {
      const groupId = makeId("bgrp");
      for (const pair of matchResult.pairs) {
        pair.mine.status = "matched";
        pair.mine.updatedAt = now;
        pair.theirs.status = "matched";
        pair.theirs.updatedAt = now;
        consumedIds.add(pair.mine.id);
        consumedIds.add(pair.theirs.id);
        newMatches.push(
          buildMatchRecord(pair.mine, pair.theirs, pair.rankA, pair.rankB, groupId),
        );
      }
    }
  } else {
    const mine = createdRequests[0];
    const found = findBestStandaloneCandidate(mine, workingRequests, consumedIds);
    if (found) {
      mine.status = "matched";
      mine.updatedAt = now;
      found.candidate.status = "matched";
      found.candidate.updatedAt = now;
      consumedIds.add(mine.id);
      consumedIds.add(found.candidate.id);
      newMatches.push(
        buildMatchRecord(mine, found.candidate, found.rankA, found.rankB, null),
      );
    }
  }

  // Second pass: Check if any waiting bundle in the pool can now be fulfilled
  // (e.g., Bundle wanted Macro + Ethics; Macro was waiting and this new standalone Ethics just arrived!)
  const waitingBundles = new Map<string, SwapRequest[]>();
  for (const r of workingRequests) {
    if (r.status === "active" && r.bundleId && !consumedIds.has(r.id)) {
      const list = waitingBundles.get(r.bundleId) ?? [];
      list.push(r);
      waitingBundles.set(r.bundleId, list);
    }
  }
  const sortedBundles = Array.from(waitingBundles.values()).sort((a, b) =>
    a[0].queuePriorityAt.localeCompare(b[0].queuePriorityAt),
  );
  for (const bLegs of sortedBundles) {
    if (bLegs.some((l) => l.status !== "active" || consumedIds.has(l.id))) {
      continue;
    }
    const found = findMatchingBundlePair(bLegs, workingRequests, consumedIds);
    if (found) {
      const groupId = makeId("bgrp");
      for (const pair of found.pairs) {
        pair.mine.status = "matched";
        pair.mine.updatedAt = now;
        pair.theirs.status = "matched";
        pair.theirs.updatedAt = now;
        consumedIds.add(pair.mine.id);
        consumedIds.add(pair.theirs.id);
        newMatches.push(
          buildMatchRecord(pair.mine, pair.theirs, pair.rankA, pair.rankB, groupId),
        );
      }
    }
  }

  return {
    createdRequests,
    newMatches,
    nextState: {
      profiles: state.profiles,
      requests: workingRequests,
      matches: [...newMatches, ...state.matches],
    },
  };
}

/**
 * Releases a match and restores the non-cancelling partner's request back
 * to `active` status while preserving their original `queuePriorityAt` timestamp!
 * If the match was part of a paired bundle group, all legs in that group are handled cleanly.
 */
export function releaseMatchInMemory(
  state: MatchEngineState,
  matchId: string,
  cancellingUserId: string,
  reason: string,
  nowIso?: string,
): MatchEngineState {
  const now = nowIso ?? new Date().toISOString();
  const target = state.matches.find((m) => m.id === matchId);
  if (!target) return state;

  const relatedMatches = target.bundleMatchGroupId
    ? state.matches.filter(
        (m) => m.bundleMatchGroupId === target.bundleMatchGroupId,
      )
    : [target];

  const relatedMatchIds = new Set(relatedMatches.map((m) => m.id));
  const cancelReqIds = new Set<string>();
  const restoreReqIds = new Set<string>();

  for (const m of relatedMatches) {
    if (m.userAId === cancellingUserId) {
      cancelReqIds.add(m.requestAId);
      restoreReqIds.add(m.requestBId);
    } else if (m.userBId === cancellingUserId) {
      cancelReqIds.add(m.requestBId);
      restoreReqIds.add(m.requestAId);
    } else {
      // Innocent bystander partner on another leg of a multi-partner bundle
      restoreReqIds.add(m.requestAId);
      restoreReqIds.add(m.requestBId);
    }
  }

  const nextMatches = state.matches.map((m) =>
    relatedMatchIds.has(m.id)
      ? {
          ...m,
          status: "cancelled" as const,
          cancelledByUserId: cancellingUserId,
          cancelReason: reason,
        }
      : m,
  );

  const nextRequests = state.requests.map((r) => {
    if (cancelReqIds.has(r.id)) {
      return { ...r, status: "cancelled" as const, updatedAt: now };
    }
    if (restoreReqIds.has(r.id)) {
      // Preserve queuePriorityAt!
      return { ...r, status: "active" as const, updatedAt: now };
    }
    return r;
  });

  // Automatically re-try matching restored requests against current pool!
  let nextState: MatchEngineState = {
    profiles: state.profiles,
    requests: nextRequests,
    matches: nextMatches,
  };

  for (const reqId of restoreReqIds) {
    const restored = nextState.requests.find((r) => r.id === reqId);
    if (!restored || restored.status !== "active" || restored.bundleId) continue;
    const found = findBestStandaloneCandidate(
      restored,
      nextState.requests,
      new Set(),
    );
    if (found) {
      restored.status = "matched";
      restored.updatedAt = now;
      found.candidate.status = "matched";
      found.candidate.updatedAt = now;
      const profileA = nextState.profiles[restored.userId];
      const profileB = nextState.profiles[found.candidate.userId];
      const rematched: SwapMatch = {
        id: makeId("match"),
        bundleMatchGroupId: null,
        requestAId: restored.id,
        requestBId: found.candidate.id,
        userAId: restored.userId,
        userBId: found.candidate.userId,
        swapType: restored.swapType,
        course: restored.course,
        userAGivesKey: restored.givingUpKey,
        userBGivesKey: found.candidate.givingUpKey,
        userARank: found.rankA,
        userBRank: found.rankB,
        status: "matched",
        submittedByUserId: null,
        submittedAt: null,
        confirmedByA: false,
        confirmedByB: false,
        cancelledByUserId: null,
        cancelReason: null,
        emailSentA: false,
        emailSentB: false,
        createdAt: now,
        partnerA: profileA
          ? {
              id: profileA.id,
              fullName: profileA.fullName,
              email: profileA.email,
              studentId: profileA.studentId,
            }
          : undefined,
        partnerB: profileB
          ? {
              id: profileB.id,
              fullName: profileB.fullName,
              email: profileB.email,
              studentId: profileB.studentId,
            }
          : undefined,
      };
      nextState = {
        ...nextState,
        matches: [rematched, ...nextState.matches],
      };
    }
  }

  return nextState;
}

/**
 * Computes completely anonymized aggregate market pulse counts.
 * Never returns any user IDs, names, emails, or SIDs.
 */
export function computeMarketPulse(requests: SwapRequest[]): MarketPulseItem[] {
  const counts = new Map<string, MarketPulseItem>();
  for (const r of requests) {
    if (r.status !== "active") continue;
    for (const wanted of r.wantedKeys) {
      const key = `${r.swapType}::${r.givingUpKey}::${wanted}`;
      const existing = counts.get(key);
      if (existing) {
        existing.activeCount += 1;
      } else {
        counts.set(key, {
          swapType: r.swapType,
          course:
            r.course ??
            (SECTION_BY_ID[r.givingUpKey]?.course ?? null),
          givingUpKey: r.givingUpKey,
          wantedKey: wanted,
          activeCount: 1,
        });
      }
    }
  }
  return Array.from(counts.values()).sort(
    (a, b) => b.activeCount - a.activeCount,
  );
}

/**
 * Confirms an enrolled match and immediately updates both participants'
 * current core sections (or homeCohort + all 4 sections for cohort swaps).
 */
export function confirmMatchInMemory(
  state: MatchEngineState,
  matchId: string,
  actingUserId: string,
): MatchEngineState {
  const target = state.matches.find((m) => m.id === matchId);
  if (!target) return state;

  const now = new Date().toISOString();
  const shouldUpdateSchedule =
    target.status === "matched" || target.status === "submitted";

  const nextProfiles: Record<string, StudentProfile> = { ...state.profiles };

  if (shouldUpdateSchedule) {
    const profA = nextProfiles[target.userAId];
    const profB = nextProfiles[target.userBId];

    if (target.swapType === "single" && target.course) {
      if (profA) {
        nextProfiles[target.userAId] = {
          ...profA,
          currentSections: {
            ...profA.currentSections,
            [target.course]: target.userBGivesKey,
          },
        };
      }
      if (profB) {
        nextProfiles[target.userBId] = {
          ...profB,
          currentSections: {
            ...profB.currentSections,
            [target.course]: target.userAGivesKey,
          },
        };
      }
    } else if (target.swapType === "cohort") {
      const nextCohortA = target.userBGivesKey.replace("Cohort-", "") as CohortName;
      const nextCohortB = target.userAGivesKey.replace("Cohort-", "") as CohortName;
      if (profA) {
        nextProfiles[target.userAId] = {
          ...profA,
          homeCohort: nextCohortA,
          currentSections: getDefaultSectionsForCohort(nextCohortA),
        };
      }
      if (profB) {
        nextProfiles[target.userBId] = {
          ...profB,
          homeCohort: nextCohortB,
          currentSections: getDefaultSectionsForCohort(nextCohortB),
        };
      }
    }
  }

  return {
    ...state,
    profiles: nextProfiles,
    matches: state.matches.map((m) =>
      m.id === matchId
        ? {
            ...m,
            confirmedByA:
              m.userAId === actingUserId ? true : m.confirmedByA,
            confirmedByB:
              m.userBId === actingUserId ? true : m.confirmedByB,
            status: "confirmed",
          }
        : m,
    ),
    requests: state.requests.map((r) =>
      r.id === target.requestAId || r.id === target.requestBId
        ? { ...r, status: "confirmed", updatedAt: now }
        : r,
    ),
  };
}

/**
 * Returns non-cancelled queue entries strictly ordered by time of input
 * (`queuePriorityAt` ASC, then `createdAt` ASC), with zero partner PII.
 */
export function computeAnonymizedQueue(
  requests: SwapRequest[],
  viewerUserId: string,
): AnonymizedQueueItem[] {
  return requests
    .filter((r) => r.status !== "cancelled")
    .slice()
    .sort((a, b) => {
      const prioDiff =
        Date.parse(a.queuePriorityAt) - Date.parse(b.queuePriorityAt);
      if (prioDiff !== 0) return prioDiff;
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    })
    .map((r) => ({
      id: r.id,
      swapType: r.swapType,
      course: r.course,
      givingUpKey: r.givingUpKey,
      wantedKeys: [...r.wantedKeys],
      status: r.status,
      queuePriorityAt: r.queuePriorityAt,
      isMine: r.userId === viewerUserId,
    }));
}
