exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, apiKey } = JSON.parse(event.body);
    
    console.log('Received request, making call to Claude API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: text
        }]
      })
    });

    const data = await response.json();
    
    // Log the response for debugging
    console.log('Claude API response status:', response.status);
    
    if (!response.ok) {
      console.error('Claude API error:', data);
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
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        type: 'function_error' 
      })
    };
  }
};
