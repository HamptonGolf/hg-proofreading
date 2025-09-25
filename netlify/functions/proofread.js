exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, apiKey } = JSON.parse(event.body);
    
    // Create a fresh message each time with explicit instructions
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15'  // Add this for better isolation
      },
      body: JSON.stringify({
        CLAUDE_MODEL: 'claude-opus-4-1-20250805',
        max_tokens: 4000,
        temperature: 0,  // Add this for more consistent results
        system: "You are a proofreader. Only analyze the specific text provided in this message. Do not reference any other documents or previous conversations.",
        messages: [{
          role: 'user',
          content: text
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: data.error?.message || 'Claude API error',
          details: data 
        })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        type: 'function_error' 
      })
    };
  }
};

