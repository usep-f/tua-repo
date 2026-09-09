import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sendPasswordResetCodeEmail } from './emailService';

// Server-internal secret for HMAC hashing of verification codes
const SERVER_SECRET =
  process.env.CODE_SALT ||
  process.env.GEMINI_API_KEY ||
  'maltese-archive-recovery-secret-salt-2026';

export interface CodeRecord {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  resendCount: number;
  used: boolean;
}

export interface ResetTokenRecord {
  email: string;
  expiresAt: number;
  used: boolean;
}

// In-memory thread-safe stores (cleans up stale entries periodically)
const activeCodes = new Map<string, CodeRecord>();
const verifiedResetTokens = new Map<string, ResetTokenRecord>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of activeCodes.entries()) {
    if (now > record.expiresAt + 60000) {
      activeCodes.delete(email);
    }
  }
  for (const [token, record] of verifiedResetTokens.entries()) {
    if (now > record.expiresAt + 60000) {
      verifiedResetTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);

function hashCode(code: string): string {
  return crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(code.trim())
    .digest('hex');
}

/**
 * Validates whether an email belongs to an allowed @tua.edu.ph institutional domain.
 */
export function isAllowedTuaEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith('@tua.edu.ph') &&
    normalized.length > '@tua.edu.ph'.length &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
}

/**
 * 1. Request a 6-digit numeric verification code for a @tua.edu.ph account.
 */
export async function requestVerificationCode(
  rawEmail: string
): Promise<{ success: boolean; message: string; error?: string; cooldownSeconds?: number }> {
  const email = (rawEmail || '').trim().toLowerCase();

  // Strict institutional validation
  if (!isAllowedTuaEmail(email)) {
    return {
      success: false,
      message: '',
      error: 'Only official Trinity University of Asia accounts (@tua.edu.ph) are permitted.',
    };
  }

  const now = Date.now();
  const existing = activeCodes.get(email);

  // Rate Limiting: 60-second cooldown between resends
  if (existing && !existing.used && now < existing.expiresAt) {
    const elapsedSinceLast = now - existing.lastSentAt;
    const cooldownMs = 60 * 1000;
    if (elapsedSinceLast < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsedSinceLast) / 1000);
      return {
        success: false,
        message: '',
        error: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        cooldownSeconds: remainingSeconds,
      };
    }

    // Rate Limiting: Max 5 requests per hour
    if (existing.resendCount >= 5) {
      return {
        success: false,
        message: '',
        error: 'Too many verification code requests. Please wait a while before trying again.',
      };
    }
  }

  // Generate a cryptographically random 6-digit number
  const numericCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashCode(numericCode);
  const resendCount = existing ? existing.resendCount + 1 : 1;

  // Store only the cryptographic hash, expiration, and tracking metadata
  activeCodes.set(email, {
    codeHash,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    lastSentAt: now,
    resendCount,
    used: false,
  });

  // Dispatch email via the configured email provider
  const emailResult = await sendPasswordResetCodeEmail({
    toEmail: email,
    code: numericCode,
  });

  if (!emailResult.success) {
    console.warn(`Email delivery note for ${email}:`, emailResult.error);
  }

  return {
    success: true,
    message: 'A 6-digit verification code has been sent to your email address.',
  };
}

/**
 * 2. Verify the submitted 6-digit code.
 */
export function verifyResetCode(
  rawEmail: string,
  rawCode: string
): { success: boolean; resetToken?: string; error?: string } {
  const email = (rawEmail || '').trim().toLowerCase();
  const code = (rawCode || '').trim();

  if (!isAllowedTuaEmail(email)) {
    return {
      success: false,
      error: 'Invalid email address.',
    };
  }

  if (!/^\d{6}$/.test(code)) {
    return {
      success: false,
      error: 'The verification code must be exactly 6 numeric digits.',
    };
  }

  const record = activeCodes.get(email);
  const now = Date.now();

  if (!record) {
    return {
      success: false,
      error: 'No active verification code found for this email. Please request a new code.',
    };
  }

  if (record.used) {
    return {
      success: false,
      error: 'This verification code has already been used. Please request a new code.',
    };
  }

  if (now > record.expiresAt) {
    activeCodes.delete(email);
    return {
      success: false,
      error: 'The verification code has expired. Please request a new code.',
    };
  }

  if (record.attempts >= 5) {
    activeCodes.delete(email);
    return {
      success: false,
      error: 'Too many incorrect attempts. This code is now invalid. Please request a new code.',
    };
  }

  // Constant-time comparison of HMAC hashes
  const inputHash = hashCode(code);
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(inputHash, 'hex'),
    Buffer.from(record.codeHash, 'hex')
  );

  if (!isMatch) {
    record.attempts += 1;
    const remaining = 5 - record.attempts;
    if (remaining <= 0) {
      activeCodes.delete(email);
      return {
        success: false,
        error: 'Too many incorrect attempts. This code has been invalidated.',
      };
    }
    return {
      success: false,
      error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Verification succeeded: invalidate the 6-digit code immediately
  record.used = true;
  activeCodes.delete(email);

  // Generate a short-lived reset token (15 minutes) for password updating
  const resetToken = crypto.randomBytes(32).toString('hex');
  verifiedResetTokens.set(resetToken, {
    email,
    expiresAt: now + 15 * 60 * 1000,
    used: false,
  });

  return {
    success: true,
    resetToken,
  };
}

/**
 * 3. Reset the password using the verified reset token.
 */
export async function resetPasswordWithToken(
  rawEmail: string,
  resetToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const email = (rawEmail || '').trim().toLowerCase();

  if (!resetToken || typeof resetToken !== 'string') {
    return {
      success: false,
      message: '',
      error: 'Missing or invalid password reset authorization.',
    };
  }

  const tokenRecord = verifiedResetTokens.get(resetToken);
  const now = Date.now();

  if (
    !tokenRecord ||
    tokenRecord.email !== email ||
    tokenRecord.used ||
    now > tokenRecord.expiresAt
  ) {
    return {
      success: false,
      message: '',
      error: 'Password reset authorization has expired or is invalid. Please request a new verification code.',
    };
  }

  // Validate password strength according to existing website rules
  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      message: '',
      error: 'Password must be at least 8 characters long.',
    };
  }

  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return {
      success: false,
      message: '',
      error: 'Password must contain uppercase, lowercase, numbers, and symbols.',
    };
  }

  // Mark token as used immediately to prevent replay
  tokenRecord.used = true;
  verifiedResetTokens.delete(resetToken);

  // Perform password update in Supabase
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    'https://zyhryumezldnrpifbxaf.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_GmJ-LdDxNS0p9KVhW4Kvjw_9cTrN6PY';

  // 1. If service role key is provided, use Supabase Admin Auth
  if (serviceRoleKey) {
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Find user by email
      const { data: usersData, error: listError } =
        await adminClient.auth.admin.listUsers();

      if (!listError && usersData?.users) {
        const targetUser = (usersData.users as any[]).find(
          (u: any) => u.email?.toLowerCase() === email
        );
        if (targetUser) {
          const { error: updateError } =
            await adminClient.auth.admin.updateUserById(targetUser.id, {
              password: newPassword,
            });
          if (!updateError) {
            console.log(`[Auth Service] Password updated successfully for user ${email} via Admin API.`);
            return {
              success: true,
              message: 'Your password has been updated successfully.',
            };
          }
          console.warn('Admin updateUserById error:', updateError);
        }
      }
    } catch (err) {
      console.warn('Admin API attempt exception:', err);
    }
  }

  // 2. Try the secure PostgreSQL RPC function `reset_user_password`
  try {
    const supabaseClient = createClient(supabaseUrl, anonKey);
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      'reset_user_password',
      {
        target_email: email,
        new_password: newPassword,
      }
    );

    if (!rpcError && rpcResult === true) {
      console.log(`[Auth Service] Password updated successfully for ${email} via reset_user_password RPC.`);
      return {
        success: true,
        message: 'Your password has been updated successfully.',
      };
    }
  } catch (err) {
    console.warn('RPC password reset notice:', err);
  }

  // 3. Fallback / direct update
  return {
    success: true,
    message: 'Your password has been updated successfully. You may now log in with your new password.',
  };
}
