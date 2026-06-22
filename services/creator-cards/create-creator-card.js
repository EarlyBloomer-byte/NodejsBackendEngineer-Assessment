const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { ulid } = require('@app-core/randomness');
const CreatorCardMessages = require('@app/messages/creator-card');
const CreatorCardModel = require('@app/models/creator-card'); // [PLACEHOLDER] update path if models live elsewhere

// ---------------------------------------------------------------------------
// Validator spec (VSL)
// ---------------------------------------------------------------------------
const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description? string<maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`;

const parsedSpec = validator.parse(spec);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random 6-character alphanumeric suffix.
 */
function randomSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Derive a slug from a title.
 * Rules:
 *   1. Lowercase
 *   2. Replace whitespace with hyphens
 *   3. Remove chars that are not letters, numbers, hyphens, or underscores
 */
function slugifyTitle(title) {
  let slug = title.toLowerCase();

  // Replace whitespace runs with a single hyphen
  const words = slug.split(' ');
  slug = words.join('-');

  // Remove disallowed characters (keep letters, digits, hyphens, underscores)
  const allowed = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
  let clean = '';
  for (let i = 0; i < slug.length; i++) {
    if (allowed.includes(slug[i])) {
      clean += slug[i];
    }
  }
  return clean;
}

/**
 * Validate that access_code contains only alphanumeric characters.
 * The VSL already enforces length:6; we do the character check here.
 */
function isAlphanumeric(str) {
  const valid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < str.length; i++) {
    if (!valid.includes(str[i])) return false;
  }
  return true;
}

/**
 * Validate that a slug contains only allowed characters.
 */
function isValidSlugChars(slug) {
  const allowed = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let i = 0; i < slug.length; i++) {
    if (!allowed.includes(slug[i])) return false;
  }
  return true;
}

/**
 * Serialize a MongoDB document to an API-safe object:
 *   - renames _id → id
 *   - omits access_code (for retrieval responses only, controlled by caller)
 */
function serializeCard(doc, { includeAccessCode = false } = {}) {
  const card = {
    id: doc._id,
    title: doc.title,
    description: doc.description ?? null,
    slug: doc.slug,
    creator_reference: doc.creator_reference,
    links: doc.links ?? [],
    service_rates: doc.service_rates ?? null,
    status: doc.status,
    access_type: doc.access_type,
    access_code: includeAccessCode ? (doc.access_code ?? null) : undefined,
    created: doc.created,
    updated: doc.updated,
    deleted: doc.deleted ?? null,
  };

  // Remove undefined keys
  if (!includeAccessCode) {
    delete card.access_code;
  }

  return card;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

async function createCreatorCard(serviceData, options = {}) {
  let response;

  // 1. Validate input with VSL
  const data = validator.validate(serviceData, parsedSpec);

  try {
    const effectiveAccessType = data.access_type ?? 'public';

    // 2. Business rule: access_code required when access_type is private
    if (effectiveAccessType === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, ERROR_CODE.INVLDDATA, 'AC01');
    }

    // 3. Business rule: access_code must NOT be set on public cards
    if (effectiveAccessType === 'public' && data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_NOT_ALLOWED, ERROR_CODE.INVLDDATA, 'AC05');
    }

    // 4. Validate access_code characters (alphanumeric only)
    if (data.access_code && !isAlphanumeric(data.access_code)) {
      throwAppError(
        'access_code must contain only letters and numbers',
        ERROR_CODE.INVLDDATA,
        'AC01'
      );
    }

    // 5. Validate service_rates.rates amounts are integers
    if (data.service_rates?.rates) {
      const invalidRate = data.service_rates.rates.find((rate) => !Number.isInteger(rate.amount));
      if (invalidRate) {
        throwAppError('Rate amount must be a positive integer (no decimals)', ERROR_CODE.INVLDDATA);
      }
    }

    // 6. Determine slug
    let slug;
    if (data.slug) {
      // Validate slug character set
      if (!isValidSlugChars(data.slug)) {
        throwAppError(
          'slug may only contain letters, numbers, hyphens, and underscores',
          ERROR_CODE.INVLDDATA
        );
      }
      // Business rule SL02: client-provided slug must be unique
      const taken = await CreatorCardModel.slugExists(data.slug);
      if (taken) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, ERROR_CODE.DUPLRCRD, 'SL02');
      }
      slug = data.slug;
    } else {
      // Auto-generate slug from title
      let generated = slugifyTitle(data.title);

      if (generated.length < 5 || (await CreatorCardModel.slugExists(generated))) {
        generated = `${generated}-${randomSuffix()}`;
      }
      slug = generated;
    }

    // 7. Build document
    const now = Date.now();
    const doc = {
      _id: ulid(),
      title: data.title,
      description: data.description ?? null,
      slug,
      creator_reference: data.creator_reference,
      links: data.links ?? [],
      service_rates: data.service_rates ?? null,
      status: data.status,
      access_type: effectiveAccessType,
      access_code: data.access_code ?? null,
      created: now,
      updated: now,
      deleted: null,
    };

    // 8. Persist
    await CreatorCardModel.insertCard(doc);

    appLogger.info({ slug: doc.slug, id: doc._id }, 'creator-card-created');

    // 9. Serialize (creation response INCLUDES access_code)
    response = serializeCard(doc, { includeAccessCode: true });
  } catch (error) {
    appLogger.errorX(error, 'create-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = createCreatorCard;
module.exports.serializeCard = serializeCard; // exported for use by other services
