const MsgReader = require('@kenjiuno/msgreader').default;
const { decompressRTF } = require('@kenjiuno/decompressrtf');
const { deEncapsulateSync } = require('rtf-stream-parser');
const iconvLite = require('iconv-lite');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { msgBase64 } = JSON.parse(event.body);
    if (!msgBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No .msg file data received' }) };
    }

    const msgBuffer = Buffer.from(msgBase64, 'base64');
    const reader = new MsgReader(msgBuffer);
    const data = reader.getFileData();

    if (data.error) {
      return { statusCode: 400, body: JSON.stringify({ error: `Could not read .msg file: ${data.error}` }) };
    }

    // Get the cleanest available HTML body, in order of preference.
    // Outlook stores this three different ways depending on how the message was
    // authored/exported — bodyHtml (rare), raw PidTagHtml bytes, or (most common
    // for marketing/SharpSpring-style HTML emails) HTML encapsulated inside RTF.
    let html = null;

    if (data.bodyHtml) {
      html = data.bodyHtml;
    } else if (data.html) {
      html = iconvLite.decode(Buffer.from(data.html), `cp${data.internetCodepage || data.messageCodepage || 1252}`);
    } else if (data.compressedRtf) {
      const rtfBytes = decompressRTF(data.compressedRtf);
      const result = deEncapsulateSync(Buffer.from(rtfBytes), { decode: iconvLite.decode });
      if (result.mode === 'html') {
        html = result.text;
      }
    }

    const recipients = (data.recipients || [])
      .map(r => r.smtpAddress || r.email || r.name)
      .filter(Boolean);

    if (!html) {
      // No HTML body available (plain-text-only email) — proofread the text, skip link checks
      return {
        statusCode: 200,
        body: JSON.stringify({
          subject: data.subject || '',
          senderName: data.senderName || '',
          senderEmail: data.senderEmail || '',
          recipients,
          plainText: data.body || '',
          links: [],
          checkableLinks: [],
          linkIssues: []
        })
      };
    }

    const $ = cheerio.load(html);
    $('style, script, head').remove();

    const rawText = $('body').length ? $('body').text() : $.root().text();
    const plainText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');

    const anchors = $('a[href]').toArray();
    const links = anchors.map(el => ({
      href: ($(el).attr('href') || '').trim(),
      text: $(el).text().replace(/\s+/g, ' ').trim()
    }));

    const isSkippable = (href) =>
      !href || href === '#' || href.toLowerCase().startsWith('javascript:');

    const linkIssues = [];

    // --- Split-link check ---
    // Only fires on TRUE zero-gap adjacency (no nodes at all between the two
    // anchors — not even an empty text node) with non-empty, single-token text
    // on both sides. This is deliberately strict: HTML emails are full of
    // benign adjacent anchors (nav dividers, spacer images, whitespace-only
    // links) that look similar but aren't split-link mistakes.
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = $(anchors[i]);
      const b = $(anchors[i + 1]);
      const hrefA = (a.attr('href') || '').trim();
      const hrefB = (b.attr('href') || '').trim();
      if (isSkippable(hrefA) || isSkippable(hrefB)) continue;

      const textA = a.text().trim();
      const textB = b.text().trim();
      if (!textA || !textB) continue;
      if (/\s/.test(textA) || /\s/.test(textB)) continue;

      const trueAdjacent = anchors[i].nextSibling === anchors[i + 1];
      if (!trueAdjacent) continue;

      const combined = textA + textB;
      linkIssues.push({
        location: 'Link check',
        error: `"${textA}" + "${textB}"`,
        correction: hrefA === hrefB
          ? `single link: "${combined}"`
          : `verify — two adjacent links with no space ("${combined}") likely meant to be one`,
        type: 'splitlink',
        explanation: hrefA === hrefB
          ? `These two links point to the same destination (${hrefA}) and sit directly next to each other with no space — almost certainly one link that got accidentally split into two.`
          : `These two links sit directly next to each other with no space between them but point to different destinations (${hrefA} vs ${hrefB}) — check whether this was meant to be a single link.`
      });
    }

    // --- Mailto text / URL text checks ---
    anchors.forEach(el => {
      const $el = $(el);
      const href = ($el.attr('href') || '').trim();
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (isSkippable(href) || !text) return;

      if (href.toLowerCase().startsWith('mailto:')) {
        if (/mailto:/i.test(text)) {
          linkIssues.push({
            location: 'Link check',
            error: text,
            correction: text.replace(/mailto:/gi, '').trim(),
            type: 'mailtomismatch',
            explanation: `The visible link text includes the literal "mailto:" prefix — it should show only the email address, with "mailto:" kept in the href behind it.`
          });
        }
        return;
      }

      if (href.toLowerCase().startsWith('tel:')) return;

      const looksLikeUrl = /^(https?:\/\/|www\.)[^\s]+$/i.test(text) ||
        /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(text);

      if (looksLikeUrl) {
        const normalize = (u) => u
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split(/[?#]/)[0]
          .replace(/\/$/, '')
          .toLowerCase();

        if (normalize(text) !== normalize(href)) {
          linkIssues.push({
            location: 'Link check',
            error: text,
            correction: `destination: ${href}`,
            type: 'urlmismatch',
            explanation: `The link text reads as a web address ("${text}") but the link actually goes to "${href}" — the displayed URL and the real destination don't match.`
          });
        }
      }
    });

    const checkableLinks = [...new Set(
      links
        .map(l => l.href)
        .filter(href => !isSkippable(href) && !/^(mailto:|tel:)/i.test(href))
    )];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: data.subject || '',
        senderName: data.senderName || '',
        senderEmail: data.senderEmail || '',
        recipients,
        plainText,
        links,
        checkableLinks,
        linkIssues
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, type: 'function_error' })
    };
  }
};