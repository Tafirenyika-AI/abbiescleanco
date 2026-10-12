-- General business document vault: agreements/contracts, insurance, licenses, receipts,
-- statements, legal paperwork, and manually-logged correspondence. Purely additive.

CREATE TYPE "DocumentCategory" AS ENUM ('AGREEMENT', 'INSURANCE', 'LICENSE', 'RECEIPT', 'STATEMENT', 'TAX', 'LEGAL', 'CORRESPONDENCE', 'OTHER');
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED', 'ARCHIVED');

CREATE TABLE "business_documents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
  "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "reference" TEXT,
  "counterpartyName" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "expirationDate" TIMESTAMP(3),
  "notes" TEXT,
  "correspondenceLog" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "business_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_documents_reference_key" ON "business_documents"("reference");
CREATE INDEX "business_documents_category_idx" ON "business_documents"("category");
CREATE INDEX "business_documents_status_idx" ON "business_documents"("status");

ALTER TABLE "business_documents" ADD CONSTRAINT "business_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "business_document_files" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_document_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_document_files_fileId_key" ON "business_document_files"("fileId");

ALTER TABLE "business_document_files" ADD CONSTRAINT "business_document_files_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "business_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
