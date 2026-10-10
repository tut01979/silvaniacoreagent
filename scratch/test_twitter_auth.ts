import { TwitterApi } from 'twitter-api-v2';

const combos = [
  {
    name: 'Combo 1: screenshot appKey + latest user pasted token',
    appKey: '0RUzPqKkbNTvTR41GgJ195wg3',
    appSecret: 'c8pGmGf8haS9ajvvH5TRkBrnNNwau9jaOoCon6hYsnr02Pvs2V',
    accessToken: '2099626611993673728-EfttLS5Z3MEUe8zn5g17Ra6OYAGkBJ',
    accessSecret: 'OOPmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpbllLBs',
  },
  {
    name: 'Combo 2: screenshot appKey + previous screenshot token',
    appKey: '0RUzPqKkbNTvTR41GgJ195wg3',
    appSecret: 'c8pGmGf8haS9ajvvH5TRkBrnNNwau9jaOoCon6hYsnr02Pvs2V',
    accessToken: '2099626611993673728-3P62gW7yfuPY7mne5uuqtQT138FcBW',
    accessSecret: 'rUuZkJSijqWNj tmdsyLzATuPSRaHLNn59jQ0u0STYakI3'.replace(/\s+/g, ''),
  }
];

async function main() {
  for (const c of combos) {
    console.log(`\n--- Testing ${c.name} ---`);
    const client = new TwitterApi({
      appKey: c.appKey,
      appSecret: c.appSecret,
      accessToken: c.accessToken,
      accessSecret: c.accessSecret,
    });
    try {
      const me = await client.v2.me();
      console.log('✅ SUCCESS!', me.data);
      return;
    } catch (err: any) {
      console.log('❌ Failed:', err.code, err.message, err.data?.detail || err.data?.title || '');
    }
  }
}

main();
