import { getServerSession } from "next-auth";

/**
 * Get authenticated user from NextAuth session.
 * Returns user object compatible with Supabase user_id format.
 * Uses Google token.sub as stable user ID.
 */
export async function getAuthUser(): Promise<{
  id: string;
  email: string;
} | null> {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return null;
  }

  // Use email hash as stable user_id (compatible with uuid format for Supabase)
  // This creates a deterministic UUID v5-like ID from the email
  const id = await emailToUuid(session.user.email);

  return {
    id,
    email: session.user.email,
  };
}

/**
 * Convert email to a deterministic UUID-like string.
 * Supabase expects uuid for user_id — we generate one from email hash.
 */
async function emailToUuid(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Format as UUID: 8-4-4-4-12
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
