CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create shadow database for Prisma migrations
CREATE DATABASE task_api_shadow;
GRANT ALL PRIVILEGES ON DATABASE task_api_shadow TO task;

\c task_api_shadow
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create test database
\c postgres
CREATE DATABASE task_api_test;
GRANT ALL PRIVILEGES ON DATABASE task_api_test TO task;

\c task_api_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
