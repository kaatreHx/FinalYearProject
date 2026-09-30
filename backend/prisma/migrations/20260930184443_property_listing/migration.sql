-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('PENDING', 'DISPATCHED', 'VERIFIED', 'REJECTED', 'MINTING', 'MINTED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "PropertyFileKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- AlterTable
ALTER TABLE "KycApplication" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGovernment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "areaSqFt" DOUBLE PRECISION NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "landRegistrationNumber" TEXT NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'PENDING',
    "dispatchedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "governmentRefNumber" TEXT,
    "verificationNotes" TEXT,
    "rejectReason" TEXT,
    "ownerWalletAddress" TEXT,
    "tokenId" TEXT,
    "contractAddress" TEXT,
    "mintTxHash" TEXT,
    "mintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyFile" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "PropertyFileKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyStatusLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromStatus" "PropertyStatus",
    "toStatus" "PropertyStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_sellerId_idx" ON "Property"("sellerId");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_landRegistrationNumber_idx" ON "Property"("landRegistrationNumber");

-- CreateIndex
CREATE INDEX "PropertyFile_propertyId_idx" ON "PropertyFile"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyStatusLog_propertyId_idx" ON "PropertyStatusLog"("propertyId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFile" ADD CONSTRAINT "PropertyFile_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyStatusLog" ADD CONSTRAINT "PropertyStatusLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
