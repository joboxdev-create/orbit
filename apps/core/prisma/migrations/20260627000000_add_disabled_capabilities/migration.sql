-- AlterTable
ALTER TABLE "ConnectorInstance" ADD COLUMN "disabledCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];
