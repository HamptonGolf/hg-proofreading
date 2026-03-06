exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { contextStr, prompt, text, pdfBase64, apiKey, model } = JSON.parse(event.body);
    
    const modelToUse = model || 'claude-sonnet-4-6';
    
    console.log('Using model:', modelToUse);
    console.log('Input type:', pdfBase64 ? 'PDF (base64)' : 'text');

    // Build the message content based on input type
    let messageContent;

    if (pdfBase64) {
      // PDF mode: send document visually to Claude
      messageContent = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
        },
        {
          type: 'text',
          text: contextStr + prompt
        }
      ];
    } else {
      // Text mode: send extracted/direct text as before
      messageContent = contextStr + prompt + text;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: 4000,
        temperature: 0,
        system: "You are an experienced proofreader specializing in professional documents. Analyze only the specific text provided in this message following the instructions given. Do not reference any other documents or previous conversations.",
        messages: [{
          role: 'user',
          content: messageContent
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
