import dotenv from "dotenv";
dotenv.config();

console.log({
  TWITTER_API_KEY: {
    val: process.env.TWITTER_API_KEY,
    len: process.env.TWITTER_API_KEY?.length
  },
  TWITTER_API_SECRET: {
    val: process.env.TWITTER_API_SECRET,
    len: process.env.TWITTER_API_SECRET?.length
  },
  TWITTER_ACCESS_TOKEN: {
    val: process.env.TWITTER_ACCESS_TOKEN,
    len: process.env.TWITTER_ACCESS_TOKEN?.length
  },
  TWITTER_ACCESS_SECRET: {
    val: process.env.TWITTER_ACCESS_SECRET,
    len: process.env.TWITTER_ACCESS_SECRET?.length
  }
});
