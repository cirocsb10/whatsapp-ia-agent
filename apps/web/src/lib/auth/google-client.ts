export function isGoogleAuthConfigured(
  clientId: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
): boolean {
  return Boolean(clientId?.trim());
}
