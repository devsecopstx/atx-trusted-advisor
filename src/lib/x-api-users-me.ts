export type XUserMe = {
  id: string;
  username: string;
  name?: string;
};

type XUserMeResponse = {
  data?: {
    id: string;
    username: string;
    name?: string;
  };
};

const USER_ME_URLS = [
  "https://api.x.com/2/users/me?user.fields=id,name,username",
  "https://api.twitter.com/2/users/me?user.fields=id,name,username"
];

/** Fetch the numeric id + username for the authenticated token owner. Returns both when successful. */
export async function fetchXUserMe(accessToken: string): Promise<XUserMe | null> {
  for (const url of USER_ME_URLS) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        continue;
      }
      const json = (await response.json()) as XUserMeResponse;
      const id = json.data?.id?.trim();
      const username = json.data?.username?.trim();
      if (id && username) {
        return {
          id,
          username,
          name: json.data?.name?.trim() || undefined
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** @deprecated Prefer fetchXUserMe which returns id + username. */
export async function fetchXUsersMeUsername(accessToken: string): Promise<string | null> {
  const me = await fetchXUserMe(accessToken);
  return me?.username ?? null;
}
