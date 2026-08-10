# Kasa Cue: Vercel deployment

## 1. Database

This project currently uses **MySQL** through Prisma. The quickest production
setup is a managed MySQL database such as Railway MySQL, Aiven for MySQL, or
TiDB Cloud. Do not use a local MySQL URL for Vercel.

Create an empty database and copy its public connection URL into:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

The `vercel-build` script runs `prisma migrate deploy` before the Next.js
build, so the committed migrations create the required tables automatically.

## 2. Required Vercel environment variables

Add these for Production and Preview before the first deployment:

```env
DATABASE_URL=
AUTH_SECRET=
AUTH_TRUST_HOST=true
AUTH_URL=https://YOUR-VERCEL-DOMAIN
NEXTAUTH_URL=https://YOUR-VERCEL-DOMAIN
NEXT_PUBLIC_APP_URL=https://YOUR-VERCEL-DOMAIN
OPENAI_API_KEY=
OPENAI_REPLY_MODEL=gpt-4o-mini
OPENAI_LIVE_REPLY_MODEL=gpt-4o-mini
OPENAI_SCREEN_ANALYSIS_MODEL=gpt-4o
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
```

Generate `AUTH_SECRET` locally with:

```bash
openssl rand -base64 32
```

## 3. Document upload storage

Resume and reference-document uploads use S3. Add these variables if document
upload must work in production:

```env
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
KASA_DOCUMENTS_S3_PREFIX=kasa-cue-documents
```

The AWS identity needs permission to put, get, and delete objects inside this
bucket/prefix.

## 4. Optional Google login

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Add this authorized redirect URI in Google Cloud:

```text
https://YOUR-VERCEL-DOMAIN/api/auth/callback/google
```

Email/password login works without the Google variables.

## 5. Deploy

1. Import the GitHub repository into Vercel.
2. Select the Next.js framework preset and repository root.
3. Add the environment variables above.
4. Deploy. Vercel will run the Prisma migrations and Next.js production build.
5. If the final domain changes, update `AUTH_URL`, `NEXTAUTH_URL`,
   `NEXT_PUBLIC_APP_URL`, and the Google redirect URI, then redeploy.

Never commit `.env`, database passwords, OpenAI keys, AWS keys, or OAuth
secrets. Only `.env.example` belongs in Git.
