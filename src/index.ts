import { readConfig, setUser } from "./config";
import {
  createUser,
  deleteAllUsers,
  getUserByName,
  getUsers,
} from "./lib/db/queries/users";
import { createFeed, getFeeds, getFeedByUrl,getNextFeedToFetch, markFeedFetched } from "./lib/db/queries/feeds";
import { feeds, users } from "./lib/db/schema";
import { fetchFeed } from "./rss";
import {
  createFeedFollow,
  getFeedFollowsForUser,
} from "./lib/db/queries/feed_follows";
import { deleteFeedFollow } from "./lib/db/queries/feed_follows";
import { scrapeFeeds } from "./aggregator";
import {
  createPost,
  getPostsForUser,
} from "./lib/db/queries/posts";

type Feed = typeof feeds.$inferSelect;
type User = typeof users.$inferSelect;

function printFeed(feed: Feed, user: User) {
  console.log(`ID: ${feed.id}`);
  console.log(`Name: ${feed.name}`);
  console.log(`URL: ${feed.url}`);
  console.log(`User: ${user.name}`);
}

async function handlerFeeds(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const results = await getFeeds();

  for (const result of results) {
    console.log(`* ${result.feed.name}`);
    console.log(`  URL: ${result.feed.url}`);
    console.log(`  User: ${result.user.name}`);
  }
}

type CommandHandler = (
  cmdName: string,
  ...args: string[]
) => Promise<void>;
type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

type CommandsRegistry = Record<string, CommandHandler>;

async function handlerLogin(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("username is required");
  }

  const username = args[0];
  const user = await getUserByName(username);

  if (!user) {
    throw new Error(`User "${username}" does not exist`);
  }

  const config = readConfig();
  setUser(config, username);

  console.log(`User set to ${username}`);
}

async function handlerRegister(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("username is required");
  }

  const username = args[0];
  const existingUser = await getUserByName(username);

  if (existingUser) {
    throw new Error(`User "${username}" already exists`);
  }

  const user = await createUser(username);

  const config = readConfig();
  setUser(config, username);

  console.log(`User ${username} created successfully!`);
  console.log(user);
}
async function handlerReset(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  await deleteAllUsers();
  console.log("Database reset successfully");
}

async function handlerUsers(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const users = await getUsers();
  const config = readConfig();

  for (const user of users) {
    if (user.name === config.currentUserName) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`* ${user.name}`);
    }
  }
}
function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);

  if (!match) {
    throw new Error("invalid duration");
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    default:
      throw new Error("invalid duration");
  }
}

async function handlerAgg(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("time_between_reqs is required");
  }

  const timeBetweenRequests = parseDuration(args[0]);

  console.log(`Collecting feeds every ${args[0]}`);

  await scrapeFeeds();

  const interval = setInterval(() => {
    scrapeFeeds().catch((err) => {
      console.error(err);
    });
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}
async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 2) {
    throw new Error("name and url are required");
  }

  const name = args[0];
  const url = args[1];

  const feed = await createFeed(name, url, user.id);
  const feedFollow = await createFeedFollow(user.id, feed.id);

console.log(
  `User ${feedFollow.userName} is now following ${feedFollow.feedName}`,
);
  printFeed(feed, user);
}


async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("url is required");
  }

  const url = args[0];

  if (!user) {
    throw new Error("current user does not exist");
  }

  const feed = await getFeedByUrl(url);

  if (!feed) {
    throw new Error(`Feed with URL "${url}" does not exist`);
  }

  const result = await createFeedFollow(user.id, feed.id);

  console.log(
    `User ${result.userName} is now following ${result.feedName}`,
  );
}

async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {

  const feedFollows = await getFeedFollowsForUser(user.id);

  for (const feedFollow of feedFollows) {
    console.log(`* ${feedFollow.feedName}`);
  }
}
function middlewareLoggedIn(
  handler: UserCommandHandler,
): CommandHandler {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const config = readConfig();
    const user = await getUserByName(config.currentUserName);

    if (!user) {
      throw new Error(`User ${config.currentUserName} not found`);
    }

    await handler(cmdName, user, ...args);
  };
}

async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("url is required");
  }

  const url = args[0];

  const feed = await getFeedByUrl(url);

  if (!feed) {
    throw new Error(`Feed with URL "${url}" does not exist`);
  }

  await deleteFeedFollow(user.id, feed.id);

  console.log(`User ${user.name} unfollowed ${feed.name}`);
}


async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  let limit = 2;

  if (args.length > 0) {
    limit = parseInt(args[0], 10);

    if (isNaN(limit)) {
      throw new Error("limit must be a number");
    }
  }

  const posts = await getPostsForUser(user.id, limit);

  for (const post of posts) {
    console.log(`* ${post.title}`);
    console.log(`  ${post.url}`);
  }
}





function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler,
): void {
  registry[cmdName] = handler;
}

async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  await handler(cmdName, ...args);
}

async function main(): Promise<void> {
  const registry: CommandsRegistry = {};

  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "users", handlerUsers);
  registerCommand(registry, "agg", handlerAgg);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "feeds", handlerFeeds);
  registerCommand(registry, "follow",  middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "following",  middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "unfollow",  middlewareLoggedIn(handlerUnfollow)); 
  registerCommand(registry, "browse",  middlewareLoggedIn(handlerBrowse));	 
const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Not enough arguments");
    process.exit(1);
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  try {
    await runCommand(registry, cmdName, ...cmdArgs);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
}

main();
