/** User-facing copy for OAuth callback `?error=` codes (xChat guest panel + signed-in banner). */
export const oauthAuthErrorMessages: Record<string, string> = {
  google_link_email_mismatch:
    "Google account email does not match your signed-in aTx Advisor email. Use the Google account tied to the same email as your profile, or sign out first.",
  email_belongs_to_other_account:
    "That email is already on another account. Sign in with the original method for that email — we will not attach this X login to it."
};
