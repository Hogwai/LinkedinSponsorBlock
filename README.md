# LinkedinSponsorBlock

This script for Tampermonkey removes sponsored posts, suggestions, and partnered content from the linkedin.com news feed.

Available in two flavors: browser extensions and userscript

## Installing

### Firefox Extension
<a href="https://addons.mozilla.org/fr/firefox/addon/linkedin-sponsor-block/" target="_blank"><img src="https://user-images.githubusercontent.com/585534/107280546-7b9b2a00-6a26-11eb-8f9f-f95932f4bfec.png" alt="Get LinkedIn Sponsor Block for Firefox"></a> 

### Chrome Extension
<a href="https://chromewebstore.google.com/detail/linkedin-sponsor-block/dmgglmnbmokkdocpamjkcgjfjceoocbh" target="_blank"><img src="https://user-images.githubusercontent.com/585534/107280622-91a8ea80-6a26-11eb-8d07-77c548b28665.png" alt="Get LinkedIn Suggested Posts Remover for Chromium"></a>

### Userscript
#### Prerequisites

- A compatible web browser (Google Chrome, Firefox, Edge, etc.).
- The **Tampermonkey** extension installed.

#### Installing Tampermonkey

- **Google Chrome**: Go to the [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?pli=1) and click "Add to Chrome".
- **Firefox**: Go to [Mozilla Add-ons](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/) and click "Add to Firefox".
- **Other browsers**: Search for "Tampermonkey" in your browser's extension store (Edge, Opera, etc.).

#### Installing the LinkedinSponsorBlock script

1. **From Greasyfork:**

- Go to the script page: [LinkedinSponsorBlock](https://greasyfork.org/fr/scripts/546877-linkedinsponsorblock)
- Click "Install this script" and confirm

2. **From Github:**

- Click here: [LinkedinSponsorBlock.user.js](https://github.com/Hogwai/LinkedinSponsorBlock/raw/refs/heads/main/LinkedinSponsorBlock.user.js) and confirm.

3. **Verify that the script is enabled:**

- In the Tampermonkey dashboard (click the icon > "Dashboard"), ensure that the `LinkedinSponsorBlock` script is enabled (switch to "On").

#### Usage

- Visit [linkedin.com/feed](https://www.linkedin.com/feed/)
- Open the browser console (`F12` > Console) to view logs (e.g., how many ads were removed).

#### Troubleshooting

**Script not working?**
- Verify that Tampermonkey is enabled and that the script is correctly installed.
- Ensure that the site URL matches the script's `@match` patterns (`https://www.linkedin.com/feed/*`).
- Check the browser console for error messages.

**Persistent issues?**
- Open an issue via [GitHub](https://github.com/Hogwai/LinkedinSponsorBlock/issues) or try to update the script.

## License

This project is licensed under the MIT License.
