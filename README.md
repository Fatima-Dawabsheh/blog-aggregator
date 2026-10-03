# Gator - Blog Aggregator

Gator is a command-line RSS feed aggregator built with TypeScript, Node.js, PostgreSQL, and Drizzle ORM.

## Requirements

- Node.js and npm
- PostgreSQL
- Git

## Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone YOUR_GITHUB_REPOSITORY_URL
   cd blog-aggregator
   npm install
   ```

2. Create the configuration file at `~/.gatorconfig.json`:

   ```json
   {
     "db_url": "postgres://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME"
   }
   ```

   Replace the placeholders with your PostgreSQL credentials.

3. Apply database migrations:

   ```bash
   npx drizzle-kit migrate
   ```

## Commands

Register a user:

```bash
npm run start register USERNAME
```

Log in:

```bash
npm run start login USERNAME
```

List users:

```bash
npm run start users
```

Add a feed:

```bash
npm run start addfeed "Feed Name" "https://example.com/rss.xml"
```

List feeds:

```bash
npm run start feeds
```

Follow a feed:

```bash
npm run start follow "https://example.com/rss.xml"
```

View followed feeds:

```bash
npm run start following
```

Fetch posts continuously:

```bash
npm run start agg 1m
```

Browse the latest posts:

```bash
npm run start browse
npm run start browse 5
```

Press `Ctrl+C` to stop the aggregator.

