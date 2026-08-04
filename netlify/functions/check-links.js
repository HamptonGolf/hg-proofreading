exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { links } = JSON.parse(event.body);
    if (!Array.isArray(links) || links.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ results: [] }) };
    }

    // Cap how many we check in one request — protects against runaway emails
    const toCheck = links.slice(0, 60);

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const attempt = async (url, method) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(url, {
          method,
          redirect: 'follow',
          signal: controller.signal,
          headers: browserHeaders
        });
        clearTimeout(timeout);
        return { status: response.status, ok: response.ok };
      } catch (err) {
        clearTimeout(timeout);
        return { status: null, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
      }
    };

    const checkOne = async (url) => {
      // HEAD first (cheaper). If it's anything other than a clean 2xx, confirm
      // with a real GET before trusting the result — a lot of sites mishandle
      // or block HEAD requests (bot protection, misconfigured servers) in ways
      // that don't reflect whether the page actually exists. We only ever
      // report a link as broken when a GET-confirmed request returns 404 —
      // everything else (403, 406, 500, timeouts, etc.) is left unflagged
      // rather than risk a false positive.
      let result = await attempt(url, 'HEAD');
      if (!result.ok) {
        result = await attempt(url, 'GET');
      }
      return { url, status: result.status };
    };

    const results = [];
    const concurrency = 6;
    let index = 0;
    async function worker() {
      while (index < toCheck.length) {
        const current = toCheck[index++];
        results.push(await checkOne(current));
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, toCheck.length) }, worker));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, type: 'function_error' })
    };
  }
};
