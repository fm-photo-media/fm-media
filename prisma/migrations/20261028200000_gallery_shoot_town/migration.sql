-- Batch 5: optional portfolio grouping fields on GalleryImage. Additive and nullable:
-- existing rows keep working and show as one ungrouped set until shoot/town are filled in.
ALTER TABLE "GalleryImage" ADD COLUMN "shoot" VARCHAR(80);
ALTER TABLE "GalleryImage" ADD COLUMN "town" VARCHAR(60);
