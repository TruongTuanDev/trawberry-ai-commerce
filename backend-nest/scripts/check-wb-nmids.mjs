const ENDPOINT = 'https://content-api.wildberries.ru/content/v2/get/cards/list';
const DEFAULT_TARGETS = ['955686992', '982708059'];
const PAGE_LIMIT = 100;
const MAX_PAGES = 200;
const REQUEST_TIMEOUT_MS = 30_000;

class SafeDiagnosticError extends Error {
  constructor(message, httpStatus = null, classification = 'REQUEST_FAILED') {
    super(message);
    this.httpStatus = httpStatus;
    this.classification = classification;
  }
}

function readTargets(args) {
  const targets = args.length > 0 ? args : DEFAULT_TARGETS;
  const invalid = targets.filter((value) => !/^\d+$/.test(value));

  if (invalid.length > 0) {
    throw new SafeDiagnosticError(
      `${invalid.length} invalid nmID value(s) received. Every nmID must be numeric.`,
      null,
      'INVALID_INPUT',
    );
  }
  if (targets.length > 100) {
    throw new SafeDiagnosticError(
      'Too many nmID values received. The maximum is 100.',
      null,
      'INVALID_INPUT',
    );
  }

  return [...new Set(targets)];
}

function safeText(value) {
  return typeof value === 'string' ? value.slice(0, 300) : null;
}

function safeFoundCard(card) {
  return {
    nmID: String(card.nmID),
    vendorCode: safeText(card.vendorCode),
    title: safeText(card.title),
    brand: safeText(card.brand),
  };
}

function classificationFor(foundCount, requestedCount, cardsScanned) {
  if (foundCount === requestedCount) {
    return {
      classification: 'ALL_TARGETS_FOUND',
      conclusion:
        'The WB token/shop contains every requested nmID. If the app reports notFound, investigate selected-sync pagination or exact nmID filtering.',
    };
  }
  if (foundCount > 0) {
    return {
      classification: 'SOME_TARGETS_FOUND',
      conclusion:
        'The token is valid, but missing nmIDs may belong to another shop/token, be deleted, be in trash, or not be visible to this Content API token.',
    };
  }
  if (cardsScanned > 0) {
    return {
      classification: 'NO_TARGETS_FOUND_WITH_CARDS',
      conclusion:
        'The token returned active cards, but none of the requested nmIDs are visible in this shop/token active cards list.',
    };
  }
  return {
    classification: 'NO_CARDS_SCANNED',
    conclusion:
      'The token may target the wrong shop, lack Content API permission, or have no active cards visible through this endpoint.',
  };
}

function errorClassification(status) {
  if (status === 401 || status === 403) {
    return {
      classification: 'TOKEN_REJECTED',
      conclusion:
        'The token is invalid, expired, revoked, or lacks Content API permission. Rotate it before retrying.',
    };
  }
  if (status === 429) {
    return {
      classification: 'RATE_LIMITED',
      conclusion:
        'Wildberries rate-limited the request. Retry later and do not loop aggressively.',
    };
  }
  return {
    classification: 'REQUEST_FAILED',
    conclusion:
      'The diagnostic could not complete. Review the safe HTTP status/error message before retrying.',
  };
}

async function fetchPage(apiKey, cursor) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        settings: {
          sort: { ascending: false },
          filter: { withPhoto: -1 },
          cursor,
        },
      }),
    });

    if (!response.ok) {
      const result = errorClassification(response.status);
      throw new SafeDiagnosticError(
        `Wildberries Content API returned HTTP ${response.status}.`,
        response.status,
        result.classification,
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new SafeDiagnosticError(
        'Wildberries Content API returned invalid JSON.',
        response.status,
        'INVALID_RESPONSE',
      );
    }

    if (!payload || !Array.isArray(payload.cards)) {
      throw new SafeDiagnosticError(
        'Wildberries Content API returned a malformed cards response.',
        response.status,
        'INVALID_RESPONSE',
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof SafeDiagnosticError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SafeDiagnosticError(
        `Wildberries Content API request timed out after ${REQUEST_TIMEOUT_MS} ms.`,
        null,
        'REQUEST_TIMEOUT',
      );
    }
    throw new SafeDiagnosticError(
      'Wildberries Content API communication failed.',
      null,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const requested = readTargets(process.argv.slice(2));
  const apiKey = process.env.WB_API_KEY?.trim();

  if (!apiKey) {
    throw new SafeDiagnosticError(
      'WB_API_KEY is missing. Rotate the previously shared token, then export the rotated token only as WB_API_KEY.',
      null,
      'MISSING_WB_API_KEY',
    );
  }

  const requestedSet = new Set(requested);
  const foundByNmId = new Map();
  const seenCursors = new Set();
  let pagesScanned = 0;
  let cardsScanned = 0;
  let cursor = { limit: PAGE_LIMIT };
  let stopReason = 'MAX_PAGES_REACHED';

  while (pagesScanned < MAX_PAGES) {
    const payload = await fetchPage(apiKey, cursor);
    const cards = payload.cards;
    const nextCursor = payload.cursor ?? {};

    pagesScanned += 1;
    cardsScanned += cards.length;

    for (const card of cards) {
      const nmId = card?.nmID == null ? '' : String(card.nmID);
      if (requestedSet.has(nmId) && !foundByNmId.has(nmId)) {
        foundByNmId.set(nmId, safeFoundCard(card));
      }
    }

    if (foundByNmId.size === requested.length) {
      stopReason = 'ALL_TARGETS_FOUND';
      break;
    }
    if (cards.length === 0) {
      stopReason = 'NO_CARDS_RETURNED';
      break;
    }

    const pageTotal =
      nextCursor.total == null ? null : Number(nextCursor.total);
    if (Number.isFinite(pageTotal) && pageTotal < PAGE_LIMIT) {
      stopReason = 'LAST_PAGE';
      break;
    }
    if (nextCursor.updatedAt == null || nextCursor.nmID == null) {
      stopReason = 'CURSOR_CANNOT_ADVANCE';
      break;
    }

    const cursorKey = `${String(nextCursor.updatedAt)}|${String(nextCursor.nmID)}`;
    if (seenCursors.has(cursorKey)) {
      stopReason = 'CURSOR_REPEATED';
      break;
    }
    seenCursors.add(cursorKey);
    cursor = {
      limit: PAGE_LIMIT,
      updatedAt: nextCursor.updatedAt,
      nmID: nextCursor.nmID,
    };
  }

  const found = requested
    .filter((nmId) => foundByNmId.has(nmId))
    .map((nmId) => foundByNmId.get(nmId));
  const notFound = requested.filter((nmId) => !foundByNmId.has(nmId));
  const result = classificationFor(
    found.length,
    requested.length,
    cardsScanned,
  );

  console.log(
    JSON.stringify(
      {
        requested,
        pagesScanned,
        cardsScanned,
        foundCount: found.length,
        found,
        notFound,
        stopReason,
        classification: result.classification,
        conclusion: result.conclusion,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const safeError =
    error instanceof SafeDiagnosticError
      ? error
      : new SafeDiagnosticError('WB nmID diagnostic failed unexpectedly.');
  const result = errorClassification(safeError.httpStatus);

  console.error(
    JSON.stringify(
      {
        requested: process.argv.slice(2).length
          ? process.argv.slice(2).filter((value) => /^\d+$/.test(value))
          : DEFAULT_TARGETS,
        httpStatus: safeError.httpStatus,
        error: safeError.message,
        classification: safeError.classification ?? result.classification,
        conclusion:
          safeError.classification === 'MISSING_WB_API_KEY'
            ? 'Rotate the previously shared token and export the new token only through WB_API_KEY before running the diagnostic.'
            : result.conclusion,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
