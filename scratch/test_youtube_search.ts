import axios from "axios";
import * as cheerio from "cheerio";

async function testDDG() {
  console.log("=== Testing DDG with site:youtube.com ===");
  const query = "site:youtube.com/watch alejavi rivera";
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const $ = cheerio.load(html);
    $(".result__body").each((i, el) => {
      const title = $(el).find(".result__a").text().trim();
      const href = $(el).find(".result__url").attr("href") || "";
      let realUrl = href;
      try {
        const ddgUrl = new URL(href);
        realUrl = ddgUrl.searchParams.get('uddg') || href;
      } catch {}
      console.log(`${i+1}. ${title} -> ${realUrl}`);
    });
  } catch (err: any) {
    console.error("DDG Error:", err.message);
  }
}

async function testYoutubeScrape() {
  console.log("\n=== Testing YouTube Search Scrape ===");
  const query = "alejavi rivera";
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.youtube.com/results?search_query=${encodedQuery}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      }
    });
    // YouTube results are stored in ytInitialData JSON inside a script tag
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (match) {
      const json = JSON.parse(match[1]);
      const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (!contents) {
        console.log("No contents found in ytInitialData");
        return;
      }
      
      let count = 0;
      for (const section of contents) {
        const itemSection = section.itemSectionRenderer;
        if (!itemSection?.contents) continue;
        for (const item of itemSection.contents) {
          const video = item.videoRenderer;
          if (video) {
            const title = video.title?.runs?.[0]?.text || video.title?.accessibility?.accessibilityData?.label;
            const videoId = video.videoId;
            const publishTime = video.publishedTimeText?.simpleText;
            const viewCount = video.viewCountText?.simpleText;
            const lengthText = video.lengthText?.simpleText;
            console.log(`${++count}. ${title} [${lengthText || ''}]`);
            console.log(`   URL: https://www.youtube.com/watch?v=${videoId}`);
            console.log(`   Published: ${publishTime || 'N/A'} | Views: ${viewCount || 'N/A'}`);
            if (count >= 5) break;
          }
        }
        if (count >= 5) break;
      }
    } else {
      console.log("ytInitialData not found");
    }
  } catch (err: any) {
    console.error("YouTube Scrape Error:", err.message);
  }
}

async function run() {
  await testDDG();
  await testYoutubeScrape();
}

run().catch(console.error);
