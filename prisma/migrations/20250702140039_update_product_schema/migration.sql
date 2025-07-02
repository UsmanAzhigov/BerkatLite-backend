/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `ProductProperties` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `description` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `city` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ProductProperties" DROP CONSTRAINT "ProductProperties_productId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "imageUrl",
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "properties" JSONB,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "city" SET NOT NULL;

-- DropTable
DROP TABLE "ProductProperties";
