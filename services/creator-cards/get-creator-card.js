const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardMessages = require('@app/messages/creator-card');
const CreatorCardModel = require('@app/models/creator-card'); // [PLACEHOLDER] update if needed
const { serializeCard } = require('./create-creator-card');

// ---------------------------------------------------------------------------
// Validator spec — only the path param + optional query param are inputs
// ---------------------------------------------------------------------------
const spec = `root {
  slug string<trim|minLength:1>
  access_code? string
}`;

const parsedSpec = validator.parse(spec);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

async function getCreatorCard(serviceData) {
  let response;

  const data = validator.validate(serviceData, parsedSpec);

  try {
    // 1. Fetch card (non-deleted only)
    const card = await CreatorCardModel.findBySlug(data.slug);

    // Rule 1: card does not exist
    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, ERROR_CODE.NOTFOUND, 'NF01');
    }

    // Rule 2: card is a draft
    if (card.status === 'draft') {
      throwAppError(CreatorCardMessages.CARD_IS_DRAFT, ERROR_CODE.NOTFOUND, 'NF02');
    }

    // Rules 3 & 4: private card access control
    if (card.access_type === 'private') {
      if (!data.access_code) {
        throwAppError(
          CreatorCardMessages.ACCESS_CODE_MISSING_FOR_RETRIEVAL,
          ERROR_CODE.PERMERR,
          'AC03'
        );
      }
      if (data.access_code !== card.access_code) {
        throwAppError(CreatorCardMessages.ACCESS_CODE_INVALID, ERROR_CODE.PERMERR, 'AC04');
      }
    }

    appLogger.info({ slug: card.slug }, 'creator-card-retrieved');

    // Retrieval response NEVER includes access_code
    response = serializeCard(card, { includeAccessCode: false });
  } catch (error) {
    appLogger.errorX(error, 'get-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = getCreatorCard;
