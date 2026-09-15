import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const urls = [
  'https://www.un.org/actnow',
  'https://www.epa.gov/ghgemissions/household-carbon-footprint-calculator',
  'https://www.epa.gov/ghgemissions/assumptions-and-references-household-carbon-footprint-calculator',
  'https://ghgprotocol.org/standards-guidance',
  'https://ghgprotocol.org/corporate-value-chain-scope-3-standard',
  'https://ghgprotocol.org/scope-3-calculation-guidance-2'
];

async function fetchAndProcess() {
  const outputDir = path.join(process.cwd(), 'knowledge_base', 'official');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`Fetching: ${url}`);
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${url}: ${res.status}`);
        continue;
      }
      
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, navs, footer, ads, etc.
      $('script, style, noscript, nav, footer, header, aside, .sidebar, .menu, iframe').remove();
      
      const title = $('title').text().trim() || 'Official Document';
      let mainContent = $('main').text();
      if (!mainContent) {
        mainContent = $('body').text();
      }
      
      // Clean up whitespace
      const cleanedText = mainContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n\n');
        
      // Extract domain for sourceName
      const parsedUrl = new URL(url);
      let sourceName = parsedUrl.hostname.replace('www.', '');
      if (sourceName.includes('un.org')) sourceName = 'UN ActNow';
      if (sourceName.includes('epa.gov')) sourceName = 'US EPA';
      if (sourceName.includes('ghgprotocol.org')) sourceName = 'GHG Protocol';

      let topic = 'carbon footprint concepts';
      if (url.includes('actnow')) topic = 'practical reduction actions';
      if (url.includes('scope-3')) topic = 'emission accounting concepts';
      
      const frontmatter = `---
topic: ${topic}
subtopic: general
source_name: ${sourceName}
source_title: ${title.replace(/:/g, '-')}
source_url: ${url}
---
`;
      
      const filename = `doc_${i + 1}_${sourceName.toLowerCase().replace(/\s/g, '_')}.md`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, frontmatter + cleanedText, 'utf-8');
      console.log(`Saved to ${filepath}`);
    } catch (e) {
      console.error(`Error processing ${url}:`, e.message);
    }
  }
}

fetchAndProcess();
