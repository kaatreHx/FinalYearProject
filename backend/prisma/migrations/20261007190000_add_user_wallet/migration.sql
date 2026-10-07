ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "encryptedPrivateKey" TEXT;
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
