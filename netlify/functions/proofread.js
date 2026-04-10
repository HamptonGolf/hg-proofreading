exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { contextStr, prompt, text, pdfBase64, apiKey, model } = JSON.parse(event.body);
    const modelToUse = model || 'claude-sonnet-4-6';

    let messageContent;
    if (pdfBase64) {
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
        },
        { type: 'text', text: (contextStr || '') + (prompt || '') }
      ];
    } else {
      messageContent = (contextStr || '') + (prompt || '') + (text || '');
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };

    if (pdfBase64) {
        headers['anthropic-beta'] = 'pdfs-2024-09-25';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: 4000,
        temperature: 0,
        stream: true,
        system: "You are an experienced proofreader specializing in professional documents. Analyze only the specific text provided in this message following the instructions given. Do not reference any other documents or previous conversations.",
        messages: [{ role: 'user', content: messageContent }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: errorData.error?.message || 'Claude API error' })
      };
    }

    // Collect the full streamed response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
          }
        } catch (e) {
          // skip malformed chunks
        }
      }
    }

    if (!fullText) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Empty response received from Claude stream' })
      };
    }

    return {
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Netlify-CDN-Cache-Control': 'no-store',
        'Netlify-Vary': 'query,body'
    },
    body: JSON.stringify({
        content: [{ type: 'text', text: fullText }]
    })
};

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, type: 'function_error' })
    };
  }
};
