import config from '../config';

/**
 * Service for redirecting to Langflow with automatic authentication
 */
class LangflowRedirectService {
  constructor() {
    this.LANGFLOW_EXTERNAL_URL = process.env.REACT_APP_LANGFLOW_EXTERNAL_URL || 'http://localhost:7860';
  }

  /**
   * Redirect to Langflow with automatic login
   * @param {string} targetPath - Path within Langflow (e.g., "/flows", "/components")
   * @param {boolean} openInNewTab - Whether to open in new tab (default: false)
   */
  async redirectToLangflow(targetPath = '/', openInNewTab = false) {
    try {
      const redirectUrl = `${this.LANGFLOW_EXTERNAL_URL}${targetPath}`;
      const backendUrl = `${config.api.getRedirectLangflowUrl()}?redirect_url=${encodeURIComponent(redirectUrl)}`;

      if (openInNewTab) {
        window.open(backendUrl, '_blank');
      } else {
        window.location.href = backendUrl;
      }

    } catch (error) {
      console.error('Langflow redirect failed:', error);
      this.handleRedirectError(targetPath, openInNewTab);
    }
  }

  /**
   * Handle redirect errors by falling back to direct Langflow URL
   * @param {string} targetPath - Original target path
   * @param {boolean} openInNewTab - Whether to open in new tab
   */
  handleRedirectError(targetPath, openInNewTab) {
    console.warn('Falling back to direct Langflow URL without automatic login');

    const fallbackUrl = `${this.LANGFLOW_EXTERNAL_URL}${targetPath}`;

    if (openInNewTab) {
      window.open(fallbackUrl, '_blank');
    } else {
      window.location.href = fallbackUrl;
    }
  }
}


const langflowRedirectService = new LangflowRedirectService();
export default langflowRedirectService;