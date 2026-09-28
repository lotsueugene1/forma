# Forma

Open-source form builder with payments, bookings, automations, and analytics.

**Live at [withforma.io](https://withforma.io)**

## Features

- **Drag-and-drop form builder** with 18+ field types including payments, bookings, file uploads, ratings, and terms & conditions
- **Conversational mode** - Typeform-style one-question-at-a-time experience
- **API endpoints** - POST any JSON data, no predefined fields required
- **Payments via Stripe Connect** - Accept payments directly in forms
- **Booking system** - Calendar with availability rules, time-off, and shareable booking links
- **Email automations** - Auto-reply and follow-up sequences triggered on submission
- **Broadcast emails** - Send marketing emails to form respondents
- **AI form generation** - Describe what you need, get a complete form (powered by Claude via Amazon Bedrock)
- **Analytics dashboard** - Submission trends, conversion rates, drop-off analysis, peak hours
- **Team workspaces** - Role-based access control (owner, manager, editor, viewer)
- **Custom domains** - Point your domain to Forma and serve forms from it
- **Webhook integrations** - Slack, Google Sheets, custom webhooks
- **Embeddable** - Embed forms on any website via iframe
- **Custom branding** - Colors, logos, thank-you pages

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js (credentials, Google, GitHub)
- **Payments:** Stripe (subscriptions + Connect for form payments)
- **Email:** Resend
- **File storage:** Amazon S3
- **AI:** Amazon Bedrock (Claude Haiku 4.5)
- **Styling:** Tailwind CSS v4

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Clone the repo
git clone https://github.com/lotsueugene/forma.git
cd forma

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your values (see .env.example for descriptions)

# Set up the database
npx prisma db push
npx prisma generate

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required Environment Variables

Only `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` are required to run the app. Everything else enables optional features:

| Variable | Required | Enables |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `NEXTAUTH_URL` | Yes | Auth base URL |
| `NEXTAUTH_SECRET` | Yes | Session encryption |
| `GOOGLE_CLIENT_*` | No | Google OAuth login |
| `GITHUB_CLIENT_*` | No | GitHub OAuth login |
| `STRIPE_*` | No | Subscriptions & payments |
| `RESEND_API_KEY` | No | Email automations & broadcasts |
| `AWS_S3_*` | No | File uploads |
| `RECAPTCHA_*` | No | reCAPTCHA v3 for hosted forms |
| `SIGNUP_RECAPTCHA_*` | No | Visible reCAPTCHA v2 checkbox for email signup |

## Project Structure

```
src/
  app/
    (admin)/admin/    # Platform admin panel
    (auth)/           # Login, signup pages
    (dashboard)/      # User dashboard
    api/              # API routes
    f/[id]/           # Public form renderer
    book/[id]/        # Public booking page
  components/
    dashboard/        # Dashboard components
    forms/            # Form field components
    ui/               # Reusable UI (ConfirmModal, Pagination, etc.)
  lib/                # Server utilities (auth, stripe, email, etc.)
  contexts/           # React contexts (workspace)
  types/              # TypeScript types
prisma/
  schema.prisma       # Database schema
```

## Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

See `.env.example` for all configuration options.

## License

[MIT](LICENSE)
