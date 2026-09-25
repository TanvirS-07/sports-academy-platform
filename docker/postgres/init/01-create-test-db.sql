-- Runs automatically the first time the PostgreSQL container starts with an empty volume.
-- The development database (academy) is created by the POSTGRES_DB setting;
-- this adds a separate database that the automated tests use.
CREATE DATABASE academy_test;
