-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "phoneHash" TEXT,
    "phoneRaw" TEXT,
    "profileSummary" TEXT,
    "usualAddress" TEXT,
    "preferencesJson" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "source" TEXT NOT NULL,
    "whatsappChatName" TEXT,
    "lastMessageAt" DATETIME,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderName" TEXT,
    "messageText" TEXT NOT NULL,
    "timestamp" DATETIME,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price" REAL,
    "description" TEXT,
    "availabilityJson" TEXT,
    "customOptionsJson" TEXT,
    "minimumNoticeHours" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "conversationId" TEXT,
    "status" TEXT NOT NULL,
    "itemsJson" TEXT,
    "deliveryDate" DATETIME,
    "deliveryTime" TEXT,
    "address" TEXT,
    "paymentMethod" TEXT,
    "paymentStatus" TEXT,
    "customRequestsJson" TEXT,
    "missingFieldsJson" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suggested_replies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT,
    "orderId" TEXT,
    "replyText" TEXT NOT NULL,
    "replyType" TEXT,
    "reason" TEXT,
    "wasInserted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suggested_replies_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "suggested_replies_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brand_style_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toneSummary" TEXT,
    "commonPhrasesJson" TEXT,
    "doRulesJson" TEXT,
    "dontRulesJson" TEXT,
    "exampleRepliesJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "customers_displayName_idx" ON "customers"("displayName");

-- CreateIndex
CREATE INDEX "conversations_customerId_idx" ON "conversations"("customerId");

-- CreateIndex
CREATE INDEX "conversations_source_idx" ON "conversations"("source");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "messages"("timestamp");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_conversationId_idx" ON "orders"("conversationId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_deliveryDate_idx" ON "orders"("deliveryDate");

-- CreateIndex
CREATE INDEX "suggested_replies_conversationId_idx" ON "suggested_replies"("conversationId");

-- CreateIndex
CREATE INDEX "suggested_replies_orderId_idx" ON "suggested_replies"("orderId");

-- CreateIndex
CREATE INDEX "customer_notes_customerId_idx" ON "customer_notes"("customerId");
