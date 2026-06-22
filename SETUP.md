# Creator Cards Assessment — Setup Guide

## 1. Clone the Template

```bash
git clone https://github.com/the17thstudio/node-template.git creator-cards-api
cd creator-cards-api
npm install
```

---

## 2. Copy the Assessment Files

Place the files from this bundle into the cloned repo **exactly** at these paths:

```
messages/creator-card.js
models/creator-card.js
services/creator-cards/create-creator-card.js
services/creator-cards/get-creator-card.js
services/creator-cards/delete-creator-card.js
endpoints/creator-cards/create.js
endpoints/creator-cards/get.js
endpoints/creator-cards/delete.js
```

---

## 3. Register in messages/index.js

Open `messages/index.js` and add:

```js
module.exports = {
  // ...existing entries...
  CreatorCardMessages: require('./creator-card'),
};
```

---

## 4. Register the Endpoint Folder in app.js

Open `app.js` and find the `ENDPOINT_CONFIGS` array. Add the creator-cards folder:

```js
const ENDPOINT_CONFIGS = [
  // ...existing entries...
  { path: './endpoints/creator-cards/' },
];
```

---

## 5. Set Up MongoDB

1. Create a free cluster at [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database (e.g. `creator_cards_db`) with a collection named `creator_cards`
3. Add a **unique index on the `slug` field** to enforce DB-level uniqueness:
   - In Atlas UI: Collections → creator_cards → Indexes → Create Index
   - Index: `{ slug: 1 }`, Options: `{ unique: true, partialFilterExpression: { deleted: null } }`
   - Or run in the MongoDB shell:
     ```js
     db.creator_cards.createIndex({ slug: 1 }, { unique: true, partialFilterExpression: { deleted: null } })
     ```

---

## 6. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```
# [PLACEHOLDER] MongoDB connection string from Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/creator_cards_db

# [PLACEHOLDER] Port (default is usually 3000)
PORT=3000

# [PLACEHOLDER] Node environment
NODE_ENV=development
```

---

## 7. Fix the Model Import (IMPORTANT)

Open `models/creator-card.js` and update the DB import at the top to match the template's actual database helper. Check how other models in the `models/` folder import the DB connection, then mirror it. The placeholder is:

```js
const { getDB } = require('@app-core/database'); // [PLACEHOLDER] update this line
```

Also verify that `findOneAndUpdate` returns the updated document correctly for your MongoDB driver version. If `result.value` is undefined, try `result` directly (the driver changed behavior in v5+).

---

## 8. Run Locally

```bash
npm run dev
```

Test with curl:

```bash
# Create a card
curl -X POST http://localhost:3000/creator-cards \
  -H "Content-Type: application/json" \
  -d '{
    "title": "George Cooks",
    "description": "George Cooks is a weekly cooking podcast",
    "slug": "george-cooks",
    "creator_reference": "crt_8f2k1m9x4p7w3q5z",
    "status": "published"
  }'

# Retrieve it
curl http://localhost:3000/creator-cards/george-cooks

# Delete it
curl -X DELETE http://localhost:3000/creator-cards/george-cooks \
  -H "Content-Type: application/json" \
  -d '{"creator_reference": "crt_8f2k1m9x4p7w3q5z"}'
```

---

## 9. Deploy to Render (or Heroku)

### Render (recommended, free tier available)
1. Push your repo to GitHub (make it public)
2. Go to [https://render.com](https://render.com) and create a new **Web Service**
3. Connect your GitHub repo
4. Set Build Command: `npm install`
5. Set Start Command: `npm start` (verify this matches your `Procfile` or `package.json`)
6. Add the environment variable `MONGODB_URI` under Environment
7. Deploy — your base URL will be something like `https://your-service.onrender.com`

### Heroku
1. Install the Heroku CLI and log in
2. `heroku create your-app-name`
3. `heroku config:set MONGODB_URI=<your-atlas-uri>`
4. `git push heroku main`

---

## 10. Submit

Fill in the Google Form with:
- Your **public GitHub repository URL**
- Your **deployed base URL only** (e.g. `https://your-service.onrender.com`)
  - No `/v1`, no `/api`, no endpoint paths

---

## Checklist Before Submitting

- [ ] `id` appears in responses, never `_id`
- [ ] `access_code` is returned on create/delete but NEVER on GET
- [ ] Draft cards return 404 NF02
- [ ] Deleted cards return 404 NF01
- [ ] Private cards without access_code return 403 AC03
- [ ] Private cards with wrong access_code return 403 AC04
- [ ] Duplicate slug (client-provided) returns 400 SL02
- [ ] `access_code` on a public card returns 400 AC05
- [ ] `access_type: private` without `access_code` returns 400 AC01
- [ ] Endpoints are at `/creator-cards`, not `/v1/creator-cards`
- [ ] No auth headers required to call your endpoints
- [ ] All test cases from the assessment pass
