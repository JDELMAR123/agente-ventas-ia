-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'MESSENGER');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CLIENTE', 'AGENTE', 'HUMANO');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NUEVO', 'CONTACTADO', 'NEGOCIANDO', 'GANADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVA', 'PAUSADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'Mi negocio',
    "brandTone" TEXT NOT NULL DEFAULT 'cercano y profesional, sin exagerar con emojis',
    "aiProvider" TEXT NOT NULL DEFAULT 'rules',
    "aiApiKey" TEXT,
    "aiModel" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
    "aiBusinessContext" TEXT NOT NULL DEFAULT '',
    "maxDescuentoPct" INTEGER NOT NULL DEFAULT 0,
    "slackWebhookUrl" TEXT,
    "escalationEmail" TEXT,
    "metaVerifyToken" TEXT,
    "waToken" TEXT,
    "waPhoneId" TEXT,
    "igToken" TEXT,
    "igAccountId" TEXT,
    "messengerToken" TEXT,
    "messengerPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "sku" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "whatsappId" TEXT,
    "instagramId" TEXT,
    "messengerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVA',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "sender" "MessageSender" NOT NULL DEFAULT 'CLIENTE',
    "body" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NUEVO',
    "interes" TEXT,
    "valorEst" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDIENTE',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCallLog" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "engine" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "args" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_whatsappId_key" ON "Contact"("whatsappId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_instagramId_key" ON "Contact"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_messengerId_key" ON "Contact"("messengerId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channel_externalId_key" ON "Conversation"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_contactId_key" ON "Lead"("contactId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "FollowUp_status_scheduledFor_idx" ON "FollowUp"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ToolCallLog_conversationId_createdAt_idx" ON "ToolCallLog"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolCallLog_toolName_idx" ON "ToolCallLog"("toolName");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCallLog" ADD CONSTRAINT "ToolCallLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
