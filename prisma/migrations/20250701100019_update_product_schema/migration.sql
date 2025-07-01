-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "phone" TEXT[];

-- CreateTable
CREATE TABLE "ProductProperties" (
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductProperties_pkey" PRIMARY KEY ("productId","name")
);

-- AddForeignKey
ALTER TABLE "ProductProperties" ADD CONSTRAINT "ProductProperties_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
