-- CreateTable
CREATE TABLE "agent" (
    "id" TEXT NOT NULL,
    "agentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "policyTypeCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'A',
    "maxRisks" INTEGER NOT NULL DEFAULT 5,
    "sourceManualId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_view" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "userClassList" TEXT NOT NULL DEFAULT 'ALL',
    "quoteCodeList" TEXT NOT NULL DEFAULT 'A',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "navigation" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,

    CONSTRAINT "manual_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_page" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "heading" TEXT,
    "subHeading" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "disableCode" TEXT,
    "notes" TEXT,

    CONSTRAINT "manual_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_view_page" (
    "id" SERIAL NOT NULL,
    "viewId" INTEGER NOT NULL,
    "pageId" INTEGER NOT NULL,
    "pageOrder" INTEGER NOT NULL DEFAULT 0,
    "progressMilestone" BOOLEAN NOT NULL DEFAULT true,
    "buttonText" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "restrict" TEXT,

    CONSTRAINT "manual_view_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_section" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "heading" TEXT,
    "subHeading" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "disableCode" TEXT,
    "notes" TEXT,

    CONSTRAINT "manual_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_page_section" (
    "id" SERIAL NOT NULL,
    "pageId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "sectionOrder" INTEGER NOT NULL DEFAULT 0,
    "areaNum" INTEGER NOT NULL DEFAULT 1,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "restrict" TEXT,

    CONSTRAINT "manual_page_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_question" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "questionOrder" INTEGER NOT NULL DEFAULT 0,
    "questionText" TEXT,
    "questionTypeCode" TEXT NOT NULL,
    "fieldName" TEXT,
    "fieldType" TEXT,
    "riskSpecific" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minValue" DECIMAL(65,30),
    "maxValue" DECIMAL(65,30),
    "placeholder" TEXT,
    "userHelp" TEXT,
    "disableCode" TEXT,
    "leftCols" INTEGER NOT NULL DEFAULT 4,
    "rightCols" INTEGER NOT NULL DEFAULT 8,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,

    CONSTRAINT "manual_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_choice" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "choiceValue" TEXT NOT NULL,
    "choiceText" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "disableCode" TEXT,

    CONSTRAINT "manual_choice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_step" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "rateOrder" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "description" TEXT,
    "rateMode" TEXT NOT NULL,
    "rateParameters" TEXT,
    "rateConditions" TEXT,
    "rateApplyTo" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'RISK',
    "coverageCode" TEXT,
    "displayOrder" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "rate_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_factor" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "key1" TEXT NOT NULL DEFAULT 'x',
    "key2" TEXT NOT NULL DEFAULT 'x',
    "key3" TEXT NOT NULL DEFAULT 'x',
    "key4" TEXT NOT NULL DEFAULT 'x',
    "key5" TEXT NOT NULL DEFAULT 'x',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT '1900-01-01'::timestamp,
    "numericValue" DECIMAL(65,30),
    "stringValue" TEXT,

    CONSTRAINT "rate_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_band" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "key1" TEXT NOT NULL DEFAULT 'x',
    "key2" TEXT NOT NULL DEFAULT 'x',
    "key3" TEXT NOT NULL DEFAULT 'x',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT '1900-01-01'::timestamp,
    "upTo" DECIMAL(65,30) NOT NULL,
    "numericValue" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "rate_band_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" SERIAL NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "manualId" INTEGER NOT NULL,
    "viewId" INTEGER,
    "currentPageId" INTEGER,
    "furthestPageOrder" INTEGER NOT NULL DEFAULT 0,
    "quoteCode" TEXT NOT NULL DEFAULT 'A',
    "statusCode" TEXT NOT NULL DEFAULT 'P',
    "statusDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentId" TEXT,
    "userId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "applicantName" TEXT,
    "applicantMobile" TEXT,
    "applicantEmail" TEXT,
    "registrationNumber" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "ratingValid" BOOLEAN NOT NULL DEFAULT false,
    "totalPremium" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_rating_result" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "risk" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "description" TEXT,
    "coverageCode" TEXT,
    "premiumAmount" DECIMAL(65,30) NOT NULL,
    "runningBase" DECIMAL(65,30) NOT NULL,
    "adjustBase" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quote_rating_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_rate_flow" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "risk" INTEGER NOT NULL,
    "rateOrder" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "rateMode" TEXT NOT NULL,
    "flowValue" TEXT,
    "flowInfo" TEXT,
    "flowPremium" DECIMAL(65,30),

    CONSTRAINT "quote_rate_flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy" (
    "id" SERIAL NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "totalPremium" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template" (
    "id" SERIAL NOT NULL,
    "manualId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "condition" TEXT,
    "body" JSONB NOT NULL DEFAULT '{}',
    "signerRoles" TEXT NOT NULL DEFAULT 'INSURED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esign_authorization" (
    "id" TEXT NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "signerRole" TEXT NOT NULL DEFAULT 'INSURED',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "signatureText" TEXT,
    "initialsText" TEXT,
    "statusCode" TEXT NOT NULL DEFAULT 'N',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "esign_authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esign_document" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'N',
    "unsignedPdf" BYTEA,
    "signedPdf" BYTEA,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esign_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esign_signature" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "documentRole" TEXT NOT NULL DEFAULT 'INSURED',
    "statusCode" TEXT NOT NULL DEFAULT 'N',
    "signedAt" TIMESTAMP(3),
    "ipAddress" TEXT,

    CONSTRAINT "esign_signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "agentId" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_agentCode_key" ON "agent"("agentCode");

-- CreateIndex
CREATE INDEX "manual_view_manualId_idx" ON "manual_view"("manualId");

-- CreateIndex
CREATE INDEX "manual_page_manualId_idx" ON "manual_page"("manualId");

-- CreateIndex
CREATE INDEX "manual_view_page_viewId_pageOrder_idx" ON "manual_view_page"("viewId", "pageOrder");

-- CreateIndex
CREATE UNIQUE INDEX "manual_view_page_viewId_pageId_key" ON "manual_view_page"("viewId", "pageId");

-- CreateIndex
CREATE INDEX "manual_section_manualId_idx" ON "manual_section"("manualId");

-- CreateIndex
CREATE INDEX "manual_page_section_pageId_sectionOrder_idx" ON "manual_page_section"("pageId", "sectionOrder");

-- CreateIndex
CREATE INDEX "manual_question_sectionId_questionOrder_idx" ON "manual_question"("sectionId", "questionOrder");

-- CreateIndex
CREATE INDEX "manual_choice_questionId_sortOrder_idx" ON "manual_choice"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "rate_step_manualId_rateOrder_idx" ON "rate_step"("manualId", "rateOrder");

-- CreateIndex
CREATE INDEX "rate_factor_manualId_fieldName_key1_key2_key3_idx" ON "rate_factor"("manualId", "fieldName", "key1", "key2", "key3");

-- CreateIndex
CREATE INDEX "rate_band_manualId_fieldName_key1_key2_key3_idx" ON "rate_band"("manualId", "fieldName", "key1", "key2", "key3");

-- CreateIndex
CREATE UNIQUE INDEX "quote_quoteNumber_key" ON "quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "quote_userId_idx" ON "quote"("userId");

-- CreateIndex
CREATE INDEX "quote_agentId_idx" ON "quote"("agentId");

-- CreateIndex
CREATE INDEX "quote_statusCode_idx" ON "quote"("statusCode");

-- CreateIndex
CREATE INDEX "quote_rating_result_quoteId_seq_idx" ON "quote_rating_result"("quoteId", "seq");

-- CreateIndex
CREATE INDEX "quote_rate_flow_quoteId_seq_idx" ON "quote_rate_flow"("quoteId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reference_key" ON "payment"("reference");

-- CreateIndex
CREATE INDEX "payment_quoteId_idx" ON "payment"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_policyNumber_key" ON "policy"("policyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "policy_quoteId_key" ON "policy"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "document_template_manualId_code_key" ON "document_template"("manualId", "code");

-- CreateIndex
CREATE INDEX "esign_authorization_quoteId_idx" ON "esign_authorization"("quoteId");

-- CreateIndex
CREATE INDEX "esign_document_quoteId_idx" ON "esign_document"("quoteId");

-- CreateIndex
CREATE INDEX "esign_signature_documentId_idx" ON "esign_signature"("documentId");

-- CreateIndex
CREATE INDEX "esign_signature_authorizationId_idx" ON "esign_signature"("authorizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- AddForeignKey
ALTER TABLE "manual_view" ADD CONSTRAINT "manual_view_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_page" ADD CONSTRAINT "manual_page_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_view_page" ADD CONSTRAINT "manual_view_page_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "manual_view"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_view_page" ADD CONSTRAINT "manual_view_page_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "manual_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_section" ADD CONSTRAINT "manual_section_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_page_section" ADD CONSTRAINT "manual_page_section_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "manual_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_page_section" ADD CONSTRAINT "manual_page_section_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "manual_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_question" ADD CONSTRAINT "manual_question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "manual_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_choice" ADD CONSTRAINT "manual_choice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "manual_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_step" ADD CONSTRAINT "rate_step_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_factor" ADD CONSTRAINT "rate_factor_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_band" ADD CONSTRAINT "rate_band_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_rating_result" ADD CONSTRAINT "quote_rating_result_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_rate_flow" ADD CONSTRAINT "quote_rate_flow_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "manual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_authorization" ADD CONSTRAINT "esign_authorization_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_document" ADD CONSTRAINT "esign_document_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_document" ADD CONSTRAINT "esign_document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_signature" ADD CONSTRAINT "esign_signature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "esign_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_signature" ADD CONSTRAINT "esign_signature_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "esign_authorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
