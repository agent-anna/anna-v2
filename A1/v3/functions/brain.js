/**
 * ANNA V3 // BRAIN MANAGER
 * Load and cache the soul brain.json identity file from GitHub
 * Version: AA01-V2-CLEAN
 * Date: 2026-11-18
 */

const Brain = {
  config: {
    path: 'A1/v3/soul/brain.json',
    branch: null, // defaults to repo default
  },

  // In-memory cache
  _cache: null,

  // Default brain returned on first boot or 404
  _default: {
    name: 'Agent Anna',
    version: 'V3',
    mission: '',
    goals: [],
    settings: {},
  },

  /**
   * Configure brain path
   * @param {object} cfg - { path?, branch? }
   */
  configure(cfg) {
    this.config = { ...this.config, ...cfg };
  },

  /**
   * Decode GitHub Base64 content with full UTF-8 support
   * @param {object|string} data - GitHub API file object or raw string
   * @returns {string} Decoded string
   */
  _decode(data) {
    const raw = typeof data === 'string' ? data : data.content || '';
    const cleaned = raw.replace(/\s/g, '');
    const binary = atob(cleaned);
    return decodeURIComponent(escape(binary));
  },

  /**
   * Load brain.json from GitHub (uses cache unless force=true)
   * @param {boolean} force - Bypass cache
   * @returns {Promise<object>} Parsed brain object
   */
  async load(force = false) {
    if (!force && this._cache !== null) {
      return this._cache;
    }

    const { path } = this.config;
    try {
      const data = await GitHub.get(path);
      const decoded = this._decode(data);
      const parsed = Utils.safeParse(decoded, { ...this._default });
      this._cache = parsed;
      return parsed;
    } catch (error) {
      // First boot: file doesn't exist yet — return clean default
      if (error.status === 404) {
        this._cache = { ...this._default };
        return this._cache;
      }
      throw error;
    }
  },

  /**
   * Reload brain from GitHub, bypassing cache
   * @returns {Promise<object>} Fresh brain object
   */
  async reload() {
    return this.load(true);
  },

  /**
   * Clear in-memory cache — next load() hits GitHub
   */
  clearCache() {
    this._cache = null;
  },

  /**
   * Return a compact token-light summary string for system prompts
   * @returns {Promise<string>} Summary line
   */
  async getSummary() {
    const brain = await this.load();
    const name = brain.name || 'Agent Anna';
    const version = brain.version || 'V3';
    const mission = brain.mission || 'No mission set.';
    const goalCount = Array.isArray(brain.goals) ? brain.goals.length : 0;
    return `[BRAIN] ${name} ${version} | ${mission} | ${goalCount} active goal${goalCount !== 1 ? 's' : ''}`;
  },

  /**
   * Get a specific field from brain (dot-notation safe)
   * @param {string} key - Field path e.g. 'settings.voice'
   * @returns {Promise<any>} Field value or undefined
   */
  async get(key) {
    const brain = await this.load();
    return key.split('.').reduce((obj, k) => obj && obj[k], brain);
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Brain;
}
