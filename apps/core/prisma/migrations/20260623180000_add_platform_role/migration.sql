-- ORBIT owns its own identity: add a platform-wide role so an admin (seeded
-- from env) can administer the platform. Local password auth (passwordHash,
-- provider='local') is already provided by the add_auth migration.

-- AddColumn
ALTER TABLE "User" ADD COLUMN "platformRole" TEXT NOT NULL DEFAULT 'member';
