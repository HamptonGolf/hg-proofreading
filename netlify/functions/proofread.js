exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, apiKey, model } = JSON.parse(event.body);
    
    // Use the model from the request, or default to opus
    const modelToUse = model || 'claude-opus-4-1-20250805';
    
    console.log('Using model:', modelToUse); // Debug log
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15'
      },
        body: JSON.stringify({
        model: modelToUse,  // Use the variable here
        max_tokens: 4000,
        temperature: 0,
        system: "You are an experienced proofreader specializing in professional documents. Analyze only the specific text provided in this message following the instructions given. Do not reference any other documents or previous conversations.",
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

