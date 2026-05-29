-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable unaccent extension (search without accents)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Audit schema (immutable logs)
CREATE SCHEMA IF NOT EXISTS audit;
