const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardMessages = require('@app/messages/creator-card');
const CreatorCardModel = require('@app/models/creator-card'); // [PLACEHOLDER] update if needed
const { serializeCard } = require('./create-creator-card');

// ---------------------------------------------------------------------------
// Validator spec
// ---------------------------------------------------------------------------
const spec = `root {
  slug string<trim|minLength:1>
  creator_reference string<length:20>
}`;

const parsedSpec = validator.parse(spec);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

async function deleteCreatorCard(serviceData) {
  let response;

  const data = validator.validate(serviceData, parsedSpec);

  try {
    // 1. Verify card exists (non-deleted)
    const existing = await CreatorCardModel.findBySlug(data.slug);

    if (!existing) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, ERROR_CODE.NOTFOUND, 'NF01');
    }

    // 2. Soft-delete
    const deleted = await CreatorCardModel.softDeleteBySlug(data.slug);

    if (!deleted) {
      // Race condition: card was deleted between the check above and now
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, ERROR_CODE.NOTFOUND, 'NF01');
    }

    appLogger.info({ slug: deleted.slug }, 'creator-card-deleted');

    // Deletion response uses the same shape as the creation response (includes access_code)
    response = serializeCard(deleted, { includeAccessCode: true });
  } catch (error) {
    appLogger.errorX(error, 'delete-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = deleteCreatorCard;
