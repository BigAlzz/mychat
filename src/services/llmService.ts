import { getServerUrl } from './serverConfig';

const LM_STUDIO_BASE_URL = getServerUrl();

// Google Search API configuration
const SEARCH_API_KEY = 'AIzaSyAVgJ3xAEgyLzkvxwOxkBFtOjgzW2LWqyY'; // Your actual API key
const SEARCH_ENGINE_ID = '543f4c49f44244e1b';

export interface LLMResponse {
  message: string;
  error?: string;
  searchResults?: WebSearchResult[];
}

export interface Model {
  id: string;
  object: string;
  owned_by: string;
}

export interface ModelsResponse {
  data: Model[];
  object: string;
}

export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  content: string;
}

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
}

interface WebSearchResponse {
  items: GoogleSearchItem[];
}

async function scrapeWebPage(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic HTML to text conversion
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();

    // Take first 2000 characters as a summary
    return text.slice(0, 2000);
  } catch (error) {
    console.error('Error scraping page:', url, error);
    return '';
  }
}

const performWebSearch = async (query: string): Promise<WebSearchResult[]> => {
  try {
    console.log('Performing web search for:', query);

    const url = `https://www.googleapis.com/customsearch/v1?key=${SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('Search API error:', data);
      throw new Error(data.error?.message || 'Search API error');
    }

    if (!data.items || !Array.isArray(data.items)) {
      console.log('No search results found');
      return [];
    }

    // Process results in parallel with content scraping
    const results = await Promise.all(data.items.slice(0, 5).map(async (item: GoogleSearchItem) => {
      const pageContent = await scrapeWebPage(item.link);
      return {
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        content: pageContent
      };
    }));

    console.log('Found search results:', results.length);
    return results;
  } catch (error) {
    console.error('Web search error:', error);
    throw error;
  }
};

export async function getAvailableModels(): Promise<Model[]> {
  try {
    const response = await fetch(`${getServerUrl()}/v1/models`);
    const data: ModelsResponse = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface StreamCallback {
  (chunk: StreamChunk): void;
}

export interface StreamController {
  stop: () => void;
  isStopped: boolean;
}

// Function to send a message to LM Studio
export async function sendMessage(
  message: string, 
  modelId: string,
  controller: AbortController,
  onChunk: (chunk: { content: string; done: boolean }) => void
): Promise<void> {
  try {
    let userQuery = message;
    let systemPrompt = 'You are a helpful assistant. Keep your responses concise and avoid repeating yourself.';
    let searchResults: WebSearchResult[] = [];

    // Check if message contains @web command
    if (message.toLowerCase().includes('@web')) {
      const searchQuery = message.replace(/@web/i, '').trim();
      const isPersonSearch = /who is|about person|find person|search person|person info|background|profile/.test(searchQuery.toLowerCase());
      const isSocialAnalysis = /social media|social analysis|deep analysis|online presence|digital footprint|social profile|social activity|social engagement|followers|social impact/.test(searchQuery.toLowerCase());
      
      try {
        console.log('Starting web search for:', searchQuery);
        
        // For person or social media searches, include comprehensive social media coverage
        if (isPersonSearch || isSocialAnalysis) {
          const targetName = extractNameFromQuery(searchQuery);
          console.log('Searching for person:', targetName);
          
          const socialQueries = [
            // Professional Networks
            `"${targetName}" site:linkedin.com`,
            
            // Major Social Platforms
            `"${targetName}" (site:twitter.com OR site:x.com)`,
            `"${targetName}" site:facebook.com`,
            `"${targetName}" site:instagram.com`,
            `"${targetName}" site:tiktok.com`,
            
            // Content Platforms
            `"${targetName}" site:youtube.com`,
            `"${targetName}" site:medium.com`,
            `"${targetName}" site:substack.com`,
            
            // Professional/Personal Sites
            `"${targetName}" (personal website OR blog)`,
            `"${targetName}" site:github.com`,
            
            // News and Media
            `"${targetName}" (news OR interview OR feature)`
          ];
          
          // Perform all searches in parallel
          const allResults = await Promise.all(socialQueries.map(q => performWebSearch(q)));
          
          // Filter and deduplicate results based on name similarity
          const relevantResults = allResults.flat().filter(result => {
            const titleAndSnippet = `${result.title} ${result.snippet}`.toLowerCase();
            return areNamesSimilar(targetName, result.title) || 
                   titleAndSnippet.includes(targetName.toLowerCase());
          });
          
          // Deduplicate by URL
          searchResults = Array.from(new Map(
            relevantResults.map(item => [item.link, item])
          ).values());
          
          // If we don't find any results with strict matching, try one general search
          if (searchResults.length === 0) {
            const generalResults = await performWebSearch(targetName);
            searchResults = generalResults.filter(result => 
              areNamesSimilar(targetName, result.title) ||
              result.snippet.toLowerCase().includes(targetName.toLowerCase())
            );
          }
        } else {
          searchResults = await performWebSearch(searchQuery);
        }
        
        console.log('Got search results:', searchResults.length);

        if (searchResults.length === 0) {
          throw new Error("I couldn't find any search results for your query. Please try a different search term.");
        }

        // Format search results with full content
        const formattedResults = searchResults.map(result => ({
          ...result,
          formattedContent: `
Source: ${result.title}
URL: ${result.link}
Summary: ${result.snippet}
Content: ${result.content || 'No additional content available'}`
        }));

        if (isSocialAnalysis) {
          systemPrompt = `You are an AI assistant performing a comprehensive social media analysis. You MUST structure your response exactly as follows:

## Basic Information
- Name/Entity: [Full name or entity name]
- Type: [Individual/Brand/Organization]
- Primary Focus: [Main area of activity/influence]

## Social Media Presence Overview
[Overall summary of digital footprint and influence]

## Platform-Specific Analysis

### Professional Networks (LinkedIn)
- Profile Overview
- Professional History
- Connections and Influence
- Content Focus
- Engagement Patterns

### Twitter/X
- Handle and Followers
- Post Frequency
- Content Themes
- Engagement Metrics
- Notable Interactions
- Hashtag Usage

### Instagram
- Account Type (Personal/Business)
- Follower Demographics
- Content Style
- Visual Themes
- Story/Reel Usage
- Engagement Patterns

### TikTok
- Account Focus
- Content Style
- Viral Content
- Hashtag Strategy
- Engagement Metrics

### YouTube
- Channel Overview
- Content Categories
- Subscriber Base
- Video Performance
- Engagement Style

### Facebook
- Page/Profile Type
- Content Strategy
- Community Engagement
- Event Participation
- Group Involvement

### Other Platforms
[Analysis of presence on Medium, Substack, GitHub, etc.]

## Content Analysis
- Primary Topics
- Content Style
- Posting Frequency
- Peak Activity Times
- Cross-Platform Strategy

## Engagement Metrics
- Follower Growth
- Engagement Rates
- Platform Performance
- Audience Demographics
- Peak Engagement Times

## Brand Voice & Messaging
- Communication Style
- Key Messages
- Consistency
- Evolution Over Time

## Notable Campaigns/Moments
[Significant social media activities or viral moments]

## Verification & Authenticity
- Verified Accounts
- Cross-Platform Consistency
- Potential Red Flags
- Information Reliability

## Recommendations
[Suggested areas for investigation or notable patterns to watch]

Important:
1. ALWAYS include all sections above
2. Provide specific metrics where available
3. Note platform-specific strengths/weaknesses
4. Include relevant handles and links
5. Highlight verified information
6. Note any data gaps or uncertainties`;
        } else if (isPersonSearch) {
          systemPrompt = `You are an AI assistant analyzing search results about a person. You MUST structure your response exactly as follows:

## Identity
- Full Name: [State the person's full name]
- Gender: [Explicitly state the person's gender, with pronouns]
- Current Role/Occupation: [List current position(s)]

## Professional Background
[Summarize career history and achievements]

## Social Media Presence
[Detailed analysis of each platform found:

### LinkedIn
- Profile Overview
- Current Position
- Career History
- Notable Connections
- Content Focus

### Twitter/X
- Handle
- Follower Count
- Tweet Focus
- Notable Interactions
- Hashtag Usage

### Instagram
- Account Type
- Content Style
- Engagement Level
- Notable Posts
- Themes

### TikTok
- Content Style
- Following
- Viral Posts
- Key Topics

### Facebook
- Public Presence
- Community Engagement
- Notable Activities

### Other Platforms
(YouTube, Medium, Substack, GitHub, etc.)]

## Notable Information
[Key facts, achievements, or newsworthy items]

## Online Activity Patterns
- Posting Frequency
- Platform Preferences
- Content Themes
- Engagement Style
- Cross-Platform Presence

## Verification Status
[Indicate confidence level in the information:
- Which facts are verified across multiple sources
- Which information needs verification
- Any conflicting information found
- Account verification status on each platform]

Important:
1. ALWAYS include all sections above
2. Be explicit about gender identification and pronouns
3. Cite sources for key claims
4. Note any uncertainty
5. Include all social media handles/links found
6. Highlight verified accounts`;
        } else {
          systemPrompt = `You are an AI assistant analyzing web search results. You MUST structure your response exactly as follows:

## Summary
[Provide a clear, concise overview of the key findings]

## Details
[List key information with direct quotes]

## Analysis
[Your interpretation of the findings]

## Gaps
[Note any missing information]

## Recommendations
[Suggest next steps]

Important:
1. ALWAYS include all sections above
2. Use markdown formatting
3. Include quotes from sources
4. Keep it clear and organized`;
        }

        userQuery = `Analyze these search results for: "${searchQuery}"

${formattedResults.map(r => r.formattedContent).join('\n\n---\n\n')}

YOU MUST include all sections as specified in the prompt above.
The Sources section will be added automatically.`;
      } catch (error) {
        console.error('Error in web search processing:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Sorry, I encountered an error while searching: ${errorMessage}. Please try again later.`);
      }
    }

    console.log('Sending request to model');
    const response = await fetch(`${getServerUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userQuery
          }
        ],
        stream: true,
        model: modelId,
        temperature: 0.3,
        max_tokens: 2000,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        top_p: 1
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    try {
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            if (buffer) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const content = processLine(line, accumulatedContent);
                  if (content !== accumulatedContent) {
                    accumulatedContent = content;
                    onChunk({ content: accumulatedContent, done: false });
                  }
                }
              }
            }

            // Add source attribution for search results
            if (searchResults.length > 0) {
              accumulatedContent += '\n\n## Sources\n';
              searchResults.forEach(result => {
                accumulatedContent += `- [${result.title}](${result.link})\n`;
              });
              onChunk({ content: accumulatedContent, done: false });
            }

            onChunk({ content: accumulatedContent, done: true });
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') continue;
            if (!line.startsWith('data: ')) continue;

            const content = processLine(line, accumulatedContent);
            if (content !== accumulatedContent) {
              accumulatedContent = content;
              onChunk({ content: accumulatedContent, done: false });
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            onChunk({ content: accumulatedContent, done: true });
            break;
          }
          throw error;
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore errors during cleanup
      }
      reader.releaseLock();
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    } else {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }
}

// Calculate string similarity using Levenshtein distance
function getLevenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  return track[str2.length][str1.length];
}

// Check if names are similar enough (allowing for minor typos)
function areNamesSimilar(name1: string, name2: string): boolean {
  const normalize = (name: string) => name.toLowerCase().trim();
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  // For very short names (1-2 chars), require exact match
  if (n1.length <= 2 || n2.length <= 2) {
    return n1 === n2;
  }
  
  // For longer names, allow small Levenshtein distance based on name length
  const maxDistance = Math.floor(Math.min(n1.length, n2.length) * 0.2); // Allow 20% difference
  const distance = getLevenshteinDistance(n1, n2);
  
  return distance <= maxDistance;
}

// Extract name from search query
function extractNameFromQuery(query: string): string {
  // Remove common search prefixes
  const cleanQuery = query.replace(/@web|who is|about|find|search|person info|background|profile/gi, '').trim();
  
  // If the query has quotes, extract the quoted part
  const quotedMatch = cleanQuery.match(/"([^"]+)"|'([^']+)'/);
  if (quotedMatch) {
    return quotedMatch[1] || quotedMatch[2];
  }
  
  return cleanQuery;
}

function processLine(line: string, existingContent: string): string {
  try {
    const jsonData = JSON.parse(line.replace('data: ', ''));
    if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content) {
      return existingContent + jsonData.choices[0].delta.content;
    }
    return existingContent;
  } catch (e) {
    return existingContent;
  }
}

// Function to test if a model is ready by sending a minimal request
export const testModelAvailability = async (modelId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${getServerUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
        max_tokens: 1
      })
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error testing model:', error);
    return false;
  }
};

// Clean up duplicated text in a stream-friendly way
function cleanStreamText(text: string): string {
  // Split into words while preserving punctuation
  const tokens = text.match(/\w+|\W+/g) || [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const key = token.toLowerCase();
    
    // Always keep punctuation and whitespace
    if (!/^\w+$/.test(token)) {
      result.push(token);
      continue;
    }
    
    // For words, only keep first instance
    if (!seen.has(key)) {
      seen.add(key);
      result.push(token);
    }
  }

  return result.join('');
}
