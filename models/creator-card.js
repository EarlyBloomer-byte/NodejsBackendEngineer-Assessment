const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creator_cards';

const schemaConfig = {
  _id: { type: SchemaTypes.ULID, required: true },
  title: { type: SchemaTypes.String, required: true },
  description: { type: SchemaTypes.String },
  slug: { type: SchemaTypes.String, required: true, unique: true },
  creator_reference: { type: SchemaTypes.String, required: true },
  links: { type: SchemaTypes.Mixed },
  service_rates: { type: SchemaTypes.Mixed },
  status: { type: SchemaTypes.String, required: true },
  access_type: { type: SchemaTypes.String, required: true },
  access_code: { type: SchemaTypes.String },
  created: { type: SchemaTypes.Number, required: true },
  updated: { type: SchemaTypes.Number, required: true },
  deleted: { type: SchemaTypes.Number },
};

const modelSchema = new ModelSchema(schemaConfig, { collection: modelName });

/** @type {DatabaseModel} */
const CreatorCard = DatabaseModel.model(modelName, modelSchema);

// --- Query helpers ---

async function insertCard(doc) {
  const record = new CreatorCard(doc);
  await record.save();
  return record.toObject();
}

async function findBySlug(slug) {
  return CreatorCard.findOne({ slug, deleted: null }).lean();
}

async function slugExists(slug) {
  const count = await CreatorCard.countDocuments({ slug, deleted: null });
  return count > 0;
}

async function softDeleteBySlug(slug) {
  const now = Date.now();
  return CreatorCard.findOneAndUpdate(
    { slug, deleted: null },
    { $set: { deleted: now, updated: now } },
    { new: true, lean: true }
  );
}

module.exports = {
  CreatorCard,
  insertCard,
  findBySlug,
  slugExists,
  softDeleteBySlug,
};
