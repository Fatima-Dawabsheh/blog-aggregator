import { fetchFeed } from "./rss";
import {
  getNextFeedToFetch,
  markFeedFetched,
} from "./lib/db/queries/feeds";
import { createPost } from "./lib/db/queries/posts";
export async function scrapeFeeds() {
  
  const feed = await getNextFeedToFetch();

  if (!feed) {
    throw new Error("No feeds found");
  }

  console.log(`Fetching feed: ${feed.name}`);

  const rssFeed = await fetchFeed(feed.url);

  await markFeedFetched(feed.id);

  for (const item of rssFeed.channel.item) {
    let publishedAt: Date | null = null;

    if (item.pubDate) {
      const parsedDate = new Date(item.pubDate);

      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate;
      }
    }

    await createPost(
      item.title,
      item.link,
      item.description,
      publishedAt,
      feed.id,
    );
  }

  console.log(`Fetched ${rssFeed.channel.item.length} posts from ${feed.name}`);
}
