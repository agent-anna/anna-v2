/**
 * ANNA V3 // GITHUB REST API WRAPPER
 * Clean GitHub API client using Utils.retry and AbortController timeouts
 * Version: AA01-V2-CLEAN
 * Date: 2026-11-18
 */

const GitHub = {
  config: {
    owner: null,
    repo: null,
    branch: 'main',
    token: null,
    timeout: 15000,
  },

  /**
   * Configure the GitHub client
   * @param {object} cfg - { owner, repo, token, branch?, timeout? }
   */
  configure(cfg) {
    this.config = { ...this.config, ...cfg };
    this._validateConfig();
  },

  _validateConfig() {
    const { owner, repo, token } = this.config;
    if (!owner || !repo || !token) {
      throw new Error('GitHub.configure() requires: owner, repo, token');
    }
  },

  _headers() {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  },

  /**
   * Make an authenticated GitHub API request with timeout
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} body - Request body
   * @param {object} query - URL query params
   * @returns {Promise<object>} Parsed JSON response
   */
  async request(method, endpoint, body = null, query = null) {
    this._validateConfig();

    const { owner, repo, token, timeout } = this.config;
    let url = `https://api.github.com/repos/${owner}/${repo}${endpoint}`;

    if (query) {
      const params = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v != null)
      );
      url += `?${params.toString()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this._headers(),
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.message || `GitHub API error: ${response.status}`;
        const err = new Error(msg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const tmo = new Error(`GitHub request timeout after ${timeout}ms: ${method} ${endpoint}`);
        tmo.code = 'ETIMEOUT';
        throw tmo;
      }

      throw error;
    }
  },

  /**
   * Wrapped request with exponential retry
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} body - Request body
   * @param {object} query - URL query params
   * @param {object} retryOpts - Options for Utils.retry
   * @returns {Promise<object>} Parsed JSON response
   */
  async requestWithRetry(method, endpoint, body = null, query = null, retryOpts = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 60000, factor = 2 } = retryOpts;
    let delay = baseDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(method, endpoint, body, query);
      } catch (error) {
        const isRetryable = error.status >= 500 || error.code === 'ETIMEOUT';
        if (!isRetryable || attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, maxDelay)));
        delay *= factor;
      }
    }
  },

  // GET /repos/{owner}/{repo}/contents/{path}
  async get(path, query = null) {
    return this.requestWithRetry('GET', `/contents/${path}`, null, query);
  },

  // PUT /repos/{owner}/{repo}/contents/{path}
  async put(path, opts) {
    const { content, message, sha = null, branch = null } = opts;
    const encoded = btoa(unescape(encodeURIComponent(content)));
    const body = {
      message,
      content: encoded,
      branch: branch || this.config.branch,
    };
    if (sha) body.sha = sha;
    return this.requestWithRetry('PUT', `/contents/${path}`, body);
  },

  // DELETE /repos/{owner}/{repo}/contents/{path}
  async delete(path, opts) {
    const { message, sha } = opts;
    return this.requestWithRetry('DELETE', `/contents/${path}`, { message, sha });
  },

  // GET file SHA for update operations
  async getSha(path, ref = null) {
    const query = ref ? { ref } : null;
    const data = await this.get(path, query);
    return data.sha;
  },

  // Create or update — auto-gets SHA if file exists
  async upsert(path, opts) {
    const { content, message, branch = null } = opts;
    try {
      const sha = await this.getSha(path, branch || this.config.branch);
      return this.put(path, { content, message, sha, branch });
    } catch (error) {
      if (error.status === 404) {
        return this.put(path, { content, message, branch });
      }
      throw error;
    }
  },

  // List directory contents
  async listDir(path = '', ref = null) {
    const query = ref ? { ref } : null;
    return this.requestWithRetry('GET', `/contents/${path}`, null, query);
  },
};

// Module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHub;
}
