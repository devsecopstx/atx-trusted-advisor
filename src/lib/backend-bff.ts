import { getAtxfinanceBackendOrigin } from "@/lib/env";

type BffHttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

type BffRouteDefinition = {
  pathTemplate: string;
  methods: readonly BffHttpMethod[];
};

/**
 * Next.js BFF surface that can proxy to atxfinance-backend when
 * `ATXFINANCE_BACKEND_ORIGIN` is set.
 */
export const nextBffApi = {
  portfolio: {
    byId: {
      pathTemplate: "/api/portfolios/{portfolioId}",
      methods: ["GET", "PATCH"]
    },
    default: {
      pathTemplate: "/api/portfolios/default",
      methods: ["GET", "POST"]
    },
    current: {
      pathTemplate: "/api/portfolios/current",
      methods: ["GET"]
    },
    accounts: {
      pathTemplate: "/api/portfolios/{portfolioId}/accounts",
      methods: ["GET", "POST"]
    },
    accountById: {
      pathTemplate: "/api/portfolios/{portfolioId}/accounts/{accountId}",
      methods: ["PATCH"]
    },
    watchlist: {
      pathTemplate: "/api/portfolios/{portfolioId}/watchlist",
      methods: ["GET", "PATCH"]
    }
  },
  positions: {
    index: {
      pathTemplate: "/api/positions",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/positions/{positionId}",
      methods: ["DELETE"]
    }
  },
  recommendations: {
    index: {
      pathTemplate: "/api/recommendations",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/recommendations/{recommendationId}",
      methods: ["GET"]
    }
  },
  portfolioRecommendations: {
    index: {
      pathTemplate: "/api/portfolios/{portfolioId}/recommendations",
      methods: ["GET", "POST"]
    }
  },
  strategyOptions: {
    chain: {
      pathTemplate: "/api/strategy-options",
      methods: ["GET"]
    },
    expirations: {
      pathTemplate: "/api/strategy-options/expirations",
      methods: ["GET"]
    }
  },
  feedback: {
    post: {
      pathTemplate: "/api/feedback",
      methods: ["POST"]
    }
  },
  admin: {
    bootstrapStatus: {
      pathTemplate: "/api/admin/bootstrap-status",
      methods: ["GET"]
    },
    audit: {
      pathTemplate: "/api/admin/audit",
      methods: ["GET"]
    },
    accessRequestsIndex: {
      pathTemplate: "/api/admin/access-requests",
      methods: ["GET", "POST"]
    },
    accessRequestsById: {
      pathTemplate: "/api/admin/access-requests/{requestId}",
      methods: ["GET", "PATCH", "PUT", "DELETE"]
    },
    usersIndex: {
      pathTemplate: "/api/admin/users",
      methods: ["GET", "POST"]
    },
    usersApproved: {
      pathTemplate: "/api/admin/users/approved",
      methods: ["GET"]
    },
    userById: {
      pathTemplate: "/api/admin/users/{userId}",
      methods: ["GET", "PUT", "DELETE"]
    },
    userRole: {
      pathTemplate: "/api/admin/users/{userId}/role",
      methods: ["PATCH"]
    },
    userPlan: {
      pathTemplate: "/api/admin/users/{userId}/plan",
      methods: ["PATCH"]
    },
    userEmail: {
      pathTemplate: "/api/admin/users/{userId}/email",
      methods: ["PATCH"]
    },
    userSettings: {
      pathTemplate: "/api/admin/users/{userId}/settings",
      methods: ["GET", "PUT"]
    }
  },
  rag: {
    files: {
      pathTemplate: "/api/rag/files",
      methods: ["GET", "POST"]
    }
  },
  accessRequests: {
    self: {
      pathTemplate: "/api/access-requests",
      methods: ["POST"]
    }
  },
  personas: {
    index: {
      pathTemplate: "/api/personas",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/personas/{personaId}",
      methods: ["GET", "PUT", "DELETE"]
    }
  }
} as const satisfies Record<string, Record<string, BffRouteDefinition>>;

/**
 * When `ATXFINANCE_BACKEND_ORIGIN` is set, forward the incoming request to Spring (same path + query).
 * Browser stays same-origin on Next; session cookie is forwarded. No CORS on the backend for this path.
 */
export async function proxyRequestToBackend(request: Request): Promise<Response | null> {
  const base = getAtxfinanceBackendOrigin();
  if (!base) {
    return null;
  }
  const u = new URL(request.url);
  const target = `${base}${u.pathname}${u.search}`;
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual"
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  return fetch(target, init);
}
