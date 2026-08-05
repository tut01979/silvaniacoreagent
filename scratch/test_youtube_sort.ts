import axios from "axios";

async function testYoutubeSort(query: string) {
  console.log(`=== Searching chronologically for: ${query} ===`);
  const encodedQuery = encodeURIComponent(query);
  // sp=CAI%253D sorts by upload date
  const url = `https://www.youtube.com/results?search_query=${encodedQuery}&sp=CAI%253D`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      }
    });
    
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (match) {
      const json = JSON.parse(match[1]);
      const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (!contents) {
        console.log("No contents");
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
            const lengthText = video.lengthText?.simpleText;
            console.log(`${++count}. ${title} [${lengthText || ''}]`);
            console.log(`   URL: https://www.youtube.com/watch?v=${videoId}`);
            console.log(`   Published: ${publishTime || 'N/A'}`);
            if (count >= 5) break;
          }
        }
        if (count >= 5) break;
      }
    } else {
      console.log("No ytInitialData match");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

async function run() {
  await testYoutubeSort("líderes sin causa");
  console.log("");
  await testYoutubeSort("alejavi rivera");
}

run().catch(console.error);
