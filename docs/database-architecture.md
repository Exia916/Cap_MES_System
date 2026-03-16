# Database Architecture

The platform uses PostgreSQL as the primary operational database.

## Infrastructure

Database Host

PostgreSQL hosted on an internal Windows VM.

Application Layer

Next.js application hosted on Vercel.

File Storage

Amazon S3 for attachments and documents.

## Design Principles

Normalized schema

Clear entity relationships

Consistent naming conventions

Audit tracking

## Key Entity Types

Operational Records

Examples

maintenance tickets  
production entries  
recut requests  

Reference Data

Examples

assets  
locations  
departments  
machines  

Platform Services

Examples

activity_history  
comments  
attachments  

Attachment records store metadata and the S3 object key.

## Audit Fields

Most tables include:

created_at  
created_by  
updated_at  
updated_by  

## Soft Deletes

Some records may support soft deletion using:

deleted_at  
deleted_by  