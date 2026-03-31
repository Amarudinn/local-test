/**
 * API Route: Fetch Tweet Content
 * 
 * Fetches tweet content from a tweet URL using multiple methods:
 * 1. FxTwitter API (full text, no auth needed, no truncation)
 * 2. VxTwitter API (fallback, also full text)
 * 3. Twitter oEmbed API (last resort, may truncate)
 * 
 * Returns tweet text content for use as debate topic.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Extract tweet ID from various URL formats
function extractTweetId(url: string): string | null {
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i,
    /(?:twitter\.com|x\.com)\/\w+\/statuses\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract username from tweet URL
function extractUsername(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/i);
  return match ? match[1] : null;
}

// Clean tweet text: remove t.co links, pic links, preserve paragraph breaks
function cleanTweetText(text: string): string {
  return text
    .replace(/https?:\/\/t\.co\/\w+/gi, '')      // Remove t.co links
    .replace(/pic\.twitter\.com\/\w+/gi, '')      // Remove pic.twitter.com links
    .replace(/\n{3,}/g, '\n\n')                   // Collapse 3+ newlines to double (paragraph break)
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Tweet URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    const tweetId = extractTweetId(url);
    const username = extractUsername(url);

    if (!tweetId) {
      return NextResponse.json(
        { error: 'Invalid tweet URL. Please use a valid Twitter/X post URL.' },
        { status: 400 }
      );
    }

    // Normalize the URL to x.com format
    const normalizedUrl = `https://x.com/${username}/status/${tweetId}`;

    // ──────────────────────────────────────────────────
    // Method 1: FxTwitter API (full text, no truncation)
    // ──────────────────────────────────────────────────
    try {
      const fxUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;

      const response = await fetch(fxUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RuangDebat/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.tweet?.text) {
          const tweetText = cleanTweetText(data.tweet.text);
          const authorName = data.tweet.author?.name || username || 'Unknown';
          const authorHandle = data.tweet.author?.screen_name
            ? `@${data.tweet.author.screen_name}`
            : `@${username}`;

          return NextResponse.json({
            success: true,
            tweet: {
              id: tweetId,
              text: tweetText,
              author_name: authorName,
              author_handle: authorHandle,
              url: normalizedUrl,
            },
          });
        }
      }
    } catch (fxError) {
      console.warn('FxTwitter API failed, trying VxTwitter:', fxError);
    }

    // ──────────────────────────────────────────────────
    // Method 2: VxTwitter API (full text, no truncation)
    // ──────────────────────────────────────────────────
    try {
      const vxUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`;

      const response = await fetch(vxUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RuangDebat/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.text) {
          const tweetText = cleanTweetText(data.text);
          const authorName = data.user_name || username || 'Unknown';
          const authorHandle = data.user_screen_name
            ? `@${data.user_screen_name}`
            : `@${username}`;

          return NextResponse.json({
            success: true,
            tweet: {
              id: tweetId,
              text: tweetText,
              author_name: authorName,
              author_handle: authorHandle,
              url: normalizedUrl,
            },
          });
        }
      }
    } catch (vxError) {
      console.warn('VxTwitter API failed, trying oEmbed:', vxError);
    }

    // ──────────────────────────────────────────────────
    // Method 3: Twitter oEmbed API (may truncate long tweets)
    // ──────────────────────────────────────────────────
    try {
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}&omit_script=true&hide_media=true&hide_thread=true`;
      
      const response = await fetch(oembedUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        let tweetText = '';
        
        if (data.html) {
          tweetText = data.html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–')
            .trim();

          // Remove trailing "— Author (@handle) Date" attribution
          const dashNewlineIndex = tweetText.lastIndexOf('\n—');
          if (dashNewlineIndex !== -1) {
            tweetText = tweetText.substring(0, dashNewlineIndex).trim();
          } else {
            const dashIndex = tweetText.lastIndexOf('—');
            if (dashIndex > 0) {
              const afterDash = tweetText.substring(dashIndex);
              if (afterDash.includes('@') || /\d{4}$/.test(afterDash.trim())) {
                tweetText = tweetText.substring(0, dashIndex).trim();
              }
            }
          }

          tweetText = cleanTweetText(tweetText);
        }

        const authorName = data.author_name || username || 'Unknown';
        const authorHandle = data.author_url 
          ? data.author_url.replace('https://twitter.com/', '@').replace('https://x.com/', '@')
          : `@${username}`;

        return NextResponse.json({
          success: true,
          tweet: {
            id: tweetId,
            text: tweetText,
            author_name: authorName,
            author_handle: authorHandle,
            url: normalizedUrl,
          },
        });
      }
    } catch (oembedError) {
      console.warn('oEmbed fetch failed:', oembedError);
    }

    // ──────────────────────────────────────────────────
    // Fallback: Return basic info from URL parsing
    // ──────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      tweet: {
        id: tweetId,
        text: '',
        author_name: username || 'Unknown',
        author_handle: `@${username}`,
        url: normalizedUrl,
      },
      warning: 'Could not auto-fetch tweet content. Please paste the tweet text manually.',
    });

  } catch (error) {
    console.error('Error fetching tweet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tweet. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}
