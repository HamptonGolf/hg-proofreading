const MsgReader = require('@kenjiuno/msgreader').default;
const { decompressRTF } = require('@kenjiuno/decompressrtf');
const { deEncapsulateSync } = require('rtf-stream-parser');
const iconvLite = require('iconv-lite');
const cheerio = require('cheerio');

// Figure out where a link "is" in human terms, for display in the results list.
// Tries, in order: the link's own visible text; an enclosed image's alt text
// (common for logo/social/CTA-button links); the nearest preceding text in the
// document. Falls back to null if none of that turns anything up.
function getLinkContext($, el) {
  const $el = $(el);
  const ownText = $el.text().replace(/\s+/g, ' ').trim();
  if (ownText && ownText.length > 0 && ownText.length <= 80) {
    return `Link text: "${ownText}"`;
  }

  const img = $el.find('img').first();
  if (img.length) {
    const alt = (img.attr('alt') || '').trim();
    if (alt) return `Image link: "${alt}"`;
  }

  let node = el.previousSibling;
  let current = el;
  let hops = 0;
  while (hops < 40) {
    if (!node) {
      const parent = current.parent;
      if (!parent) break;
      node = parent.previousSibling;
      current = parent;
      hops++;
      continue;
    }
    const rawText = node.type === 'text' ? (node.data || '') : $(node).text();
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (text && text.length > 1) {
      const snippet = text.length > 60 ? text.slice(0, 57) + '...' : text;
      return `Near: "${snippet}"`;
    }
    node = node.previousSibling;
    hops++;
  }

  return null;
}

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
    const links = anchors.map((el, idx) => {
      const context = getLinkContext($, el);
      return {
        href: ($(el).attr('href') || '').trim(),
        text: $(el).text().replace(/\s+/g, ' ').trim(),
        location: context || `Link #${idx + 1} in email`
      };
    });

    const isSkippable = (href) =>
      !href || href === '#' || href.toLowerCase().startsWith('javascript:');

    const linkIssues = [];

    // --- Split-link check ---
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
        location: links[i].location,
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
    anchors.forEach((el, idx) => {
      const $el = $(el);
      const href = ($el.attr('href') || '').trim();
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (isSkippable(href) || !text) return;

      if (href.toLowerCase().startsWith('mailto:')) {
        if (/mailto:/i.test(text)) {
          linkIssues.push({
            location: links[idx].location,
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
            location: links[idx].location,
            error: text,
            correction: `destination: ${href}`,
            type: 'urlmismatch',
            explanation: `The link text reads as a web address ("${text}") but the link actually goes to "${href}" — the displayed URL and the real destination don't match.`
          });
        }
      }
    });

    // Dedupe by href for the live checker, keeping the first location seen for each
    const seen = new Set();
    const checkableLinks = [];
    links.forEach(l => {
      if (isSkippable(l.href) || /^(mailto:|tel:)/i.test(l.href)) return;
      if (seen.has(l.href)) return;
      seen.add(l.href);
      checkableLinks.push({ href: l.href, location: l.location });
    });

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
