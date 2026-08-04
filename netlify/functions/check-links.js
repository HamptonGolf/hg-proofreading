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

    const checkOne = async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        let response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HamptonGolfLinkChecker/1.0)' }
        });

        // Some servers don't support HEAD properly — retry with GET
        if (response.status === 405 || response.status === 501) {
          response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HamptonGolfLinkChecker/1.0)' }
          });
        }

        clearTimeout(timeout);
        return { url, status: response.status, ok: response.ok, finalUrl: response.url };
      } catch (err) {
        clearTimeout(timeout);
        return { url, status: null, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
      }
    };

    // Simple concurrency pool — 6 requests in flight at a time
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