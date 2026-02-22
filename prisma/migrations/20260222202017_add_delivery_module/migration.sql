-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('FTP', 'SFTP', 'WEBHOOK');

-- AlterTable
ALTER TABLE "render_jobs" ADD COLUMN     "deliveryDestinationId" TEXT;

-- CreateTable
CREATE TABLE "delivery_destinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeliveryType" NOT NULL,
    "host" TEXT,
    "port" INTEGER,
    "username" TEXT,
    "password" TEXT,
    "path" TEXT,
    "webhookUrl" TEXT,
    "webhookHeaders" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_deliveries" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "deliveryDestinationId" TEXT NOT NULL,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "clientLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_deliveries_templateId_deliveryDestinationId_key" ON "template_deliveries"("templateId", "deliveryDestinationId");

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_deliveryDestinationId_fkey" FOREIGN KEY ("deliveryDestinationId") REFERENCES "delivery_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_deliveries" ADD CONSTRAINT "template_deliveries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_deliveries" ADD CONSTRAINT "template_deliveries_deliveryDestinationId_fkey" FOREIGN KEY ("deliveryDestinationId") REFERENCES "delivery_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
