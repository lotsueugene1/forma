import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createPersonalWorkspace } from '@/lib/workspace-auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { sendWelcomeEmail } from '@/lib/email';
import { auditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/api-rate-limit';
import { grantSignupPremiumIfEnabled } from '@/lib/entitlements';
import { verifyRecaptchaV2 } from '@/lib/recaptcha';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password requirements
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = getClientIp(request);

    const rateLimitResult = checkRateLimit(`register:${ip}`, { maxPerMinute: 3, maxPerHour: 5 });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { name, email, password, recaptchaToken } = await request.json();

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate email length
    if (email.length > 254) {
      return NextResponse.json(
        { error: 'Email address is too long' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      );
    }

    // Validate name if provided
    if (name) {
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Name must be 100 characters or less' },
          { status: 400 }
        );
      }
      if (name.length < 1) {
        return NextResponse.json(
          { error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Verify the browser-generated token before any database or bcrypt work.
    // When SIGNUP_RECAPTCHA_SECRET_KEY is absent (for example in local development),
    // verification is intentionally skipped.
    const recaptcha = await verifyRecaptchaV2({
      token: recaptchaToken,
      remoteIp: ip,
      secretKey: process.env.SIGNUP_RECAPTCHA_SECRET_KEY,
    });

    if (!recaptcha.success) {
      console.warn('[Register] reCAPTCHA rejected signup:', {
        reason: recaptcha.reason,
        errorCodes: recaptcha.errorCodes,
      });

      const unavailable = recaptcha.reason === 'service_unavailable';
      return NextResponse.json(
        {
          error: unavailable
            ? 'Security verification is temporarily unavailable. Please try again.'
            : 'Security verification failed. Please try again.',
        },
        { status: unavailable ? 503 : 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Unable to create account. Please try a different email or sign in.' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with lowercase email
    const user = await prisma.user.create({
      data: {
        name: name?.trim() || null,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    // Auto-create personal workspace for new user
    const workspace = await createPersonalWorkspace(user.id, user.name || undefined, user.email!);

    // Audit log. OAuth signups are logged via the NextAuth events.createUser
    // callback; credentials signups don't pass through that, so we log here
    // to keep the audit trail complete across both paths.
    auditLog({
      action: 'auth.register',
      userId: user.id,
      ip: getClientIp(request),
      details: { email: user.email, method: 'credentials' },
    });

    try {
      await grantSignupPremiumIfEnabled(user.id);
    } catch (err) {
      console.error('[Register] Signup premium grant failed (non-fatal):', err);
    }

    // Fire-and-forget welcome email — failures here must never block signup
    // (Resend outage, missing API key in dev, template error, etc.).
    sendWelcomeEmail({ to: user.email!, name: user.name }).catch((err) => {
      console.error('[Register] Welcome email failed (non-fatal):', err);
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
