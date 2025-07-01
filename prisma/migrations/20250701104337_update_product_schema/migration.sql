/*
  Warnings:

  - You are about to drop the column `reviews` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "reviews",
ADD COLUMN     "popular" INTEGER NOT NULL DEFAULT 0;
