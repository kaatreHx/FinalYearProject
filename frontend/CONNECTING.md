# Frontend <-> backend connection notes

1. `.env.local` in the frontend root:
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
2. Backend must be running with the property module + migrated schema (see backend README).
3. To use the government console (/admin/properties) mark an officer in the DB:
   UPDATE "User" SET "isGovernment" = true WHERE email = 'officer@example.com';
4. Backend fix needed for a usable session (auth.service.ts, loginUser):
   const expiresIn = keepSignedIn ? "30d" : "20s";   // "20s" logs everyone out after 20 seconds -> use e.g. "1d"
