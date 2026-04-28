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

export async function fetchXUsersMeUsername(accessToken: string): Promise<string | null> {
  for (const url of USER_ME_URLS) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        continue;
      }
      const json = (await response.json()) as XUserMeResponse;
      const username = json.data?.username?.trim();
      if (username) {
        return username;
      }
    } catch {
      continue;
    }
  }
  return null;
}
