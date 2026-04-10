/*
  Warnings:

  - Made the column `pickupLat` on table `deliveries` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pickupLng` on table `deliveries` required. This step will fail if there are existing NULL values in that column.
  - Made the column `dropoffLat` on table `deliveries` required. This step will fail if there are existing NULL values in that column.
  - Made the column `dropoffLng` on table `deliveries` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "payoutGcash" TEXT;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "payoutProcessed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "pickupLat" SET NOT NULL,
ALTER COLUMN "pickupLng" SET NOT NULL,
ALTER COLUMN "dropoffLat" SET NOT NULL,
ALTER COLUMN "dropoffLng" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "users" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "deliveries_riderId_status_idx" ON "deliveries"("riderId", "status");

-- CreateIndex
CREATE INDEX "orders_customerId_merchantId_status_placedAt_idx" ON "orders"("customerId", "merchantId", "status", "placedAt");

-- CreateIndex
CREATE INDEX "products_businessId_category_isActive_idx" ON "products"("businessId", "category", "isActive");
