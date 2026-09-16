/*
  Warnings:

  - You are about to drop the column `fullLegalName` on the `KycApplication` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `KycApplication` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `KycApplication` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KycApplication" DROP COLUMN "fullLegalName",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "middleName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "middleName" TEXT;
