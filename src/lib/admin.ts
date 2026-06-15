export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  
  // Read admin emails from environment variables.
  // Using both server-side and client-side (NEXT_PUBLIC_) to support verification on both sides.
  const adminEmailsEnv = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsEnv
    ? adminEmailsEnv.split(',').map((e) => e.trim().toLowerCase())
    : [];
  
  const lowerEmail = email.toLowerCase();
  return adminEmails.includes(lowerEmail);
}
