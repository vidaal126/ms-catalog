ALTER TABLE "items"
  ADD CONSTRAINT "items_weight_kg_positive" CHECK ("weightKg" > 0),
  ADD CONSTRAINT "items_length_cm_positive" CHECK ("lengthCm" > 0),
  ADD CONSTRAINT "items_width_cm_positive"  CHECK ("widthCm"  > 0),
  ADD CONSTRAINT "items_height_cm_positive" CHECK ("heightCm" > 0);
