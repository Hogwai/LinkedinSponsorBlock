# LinkedinSponsorBlock

This script for Tampermonkey removes sponsored posts, suggestions, and partnered content from the linkedin.com news feed.

Available in two flavors: [Firefox extension](https://addons.mozilla.org/fr/firefox/addon/linkedin-sponsor-block/) and [userscript](https://greasyfork.org/fr/scripts/546877-linkedinsponsorblock)

## Installing

### Extension
Go to [Linkedin Sponsor Block](https://addons.mozilla.org/fr/firefox/addon/linkedin-sponsor-block/) and install the extension

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
